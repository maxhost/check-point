import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AiInputError } from "./errors";
import { type AiImageLimits, readAiImages } from "./image-input";

/**
 * Spec 0224 §5 — las fotos de un `multipart` que van a la IA: cantidad, tamaños, tipo por BYTES y
 * la normalizacion del dominio (`normalizeImageToJpeg`). Absorbe los casos de
 * `stock/photo-input.test.ts` (spec 0223); el de 2000 px pasa a 2048 (la normalizacion es la del
 * menu, spec 0224 §5).
 *
 * Declarado: un HEIC real de iPhone (HEVC) no tiene fixture y `sharp` no lo codifica; AVIF usa el
 * MISMO contenedor (ISO base media, el que reconoce `sniffKind`) y prueba ese camino.
 */
const LIMITES: AiImageLimits = {
  field: "photos",
  min: 1,
  max: 3,
  maxBytes: 4 * 1024 * 1024,
  maxTotalBytes: Math.floor(4.4 * 1024 * 1024),
};

const image = (
  format: "png" | "jpeg" | "avif",
  width: number,
  height: number,
): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: "#c33" } })
    .toFormat(format)
    .toBuffer();

function multipart(parts: (Buffer | string)[]): Request {
  const form = new FormData();
  parts.forEach((part, i) =>
    form.append(
      "photos",
      typeof part === "string"
        ? part
        : new File([new Uint8Array(part)], `foto-${i}.jpg`, {
            // El `content-type` del cliente miente a proposito: no es autoridad.
            type: "image/jpeg",
          }),
    ),
  );
  return new Request("http://x.test", { method: "POST", body: form });
}

async function rejection(promise: Promise<unknown>): Promise<AiInputError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AiInputError);
  return error as AiInputError;
}

describe("readAiImages (spec 0224 §5)", () => {
  it("0 o 4 fotos → 422 invalid_photos", async () => {
    const png = await image("png", 10, 10);
    for (const parts of [[], [png, png, png, png]]) {
      const error = await rejection(readAiImages(multipart(parts), LIMITES));
      expect([error.status, error.code, error.message]).toEqual([
        422,
        "invalid_photos",
        "Mandá entre 1 y 3 fotos.",
      ]);
    }
  });

  it("3 fotos pasan", async () => {
    const png = await image("png", 10, 10);
    expect(
      await readAiImages(multipart([png, png, png]), LIMITES),
    ).toHaveLength(3);
  });

  it("una foto de mas de 4 MB, o el total de mas de 4,4 MB → 413 photos_too_large", async () => {
    const big = Buffer.alloc(LIMITES.maxBytes + 1);
    const error = await rejection(readAiImages(multipart([big]), LIMITES));
    expect([error.status, error.code]).toEqual([413, "photos_too_large"]);
    const third = Buffer.alloc(Math.floor(1.5 * 1024 * 1024));
    const total = await rejection(
      readAiImages(multipart([third, third, third]), LIMITES),
    );
    expect(total.code).toBe("photos_too_large");
  });

  it("el tipo sale de los BYTES: PDF, texto, SVG y GIF con `content-type: image/jpeg` → 415 unsupported_image", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    const gif = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "#000" },
    })
      .gif()
      .toBuffer();
    // Control: `sharp` abre los dos; los frena el chequeo por bytes (y, detras, el formato del dominio).
    expect((await sharp(svg).metadata()).format).toBe("svg");
    expect((await sharp(gif).metadata()).format).toBe("gif");
    for (const bytes of [
      Buffer.from("%PDF-1.7\n1 0 obj"),
      Buffer.from("hola, esto no es una foto"),
      svg,
      gif,
    ]) {
      const error = await rejection(readAiImages(multipart([bytes]), LIMITES));
      expect([error.status, error.code, error.message]).toEqual([
        415,
        "unsupported_image",
        "No pudimos abrir la foto. Probá con JPG, PNG o HEIC.",
      ]);
    }
  });

  it("una cabecera JPEG con basura detras (no se puede abrir) → 415", async () => {
    const truncated = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(64, 7),
    ]);
    const error = await rejection(
      readAiImages(multipart([truncated]), LIMITES),
    );
    expect(error.code).toBe("unsupported_image");
  });

  it("PNG y AVIF (contenedor HEIF) salen JPEG, con el lado mayor en 2048 px y sin agrandar", async () => {
    const [large, avif, small] = await readAiImages(
      multipart([
        await image("png", 3000, 1500),
        await image("avif", 2400, 3200),
        await image("png", 800, 600),
      ]),
      LIMITES,
    );
    for (const [out, width, height] of [
      [large, 2048, 1024],
      [avif, 1536, 2048],
      [small, 800, 600],
    ] as const) {
      expect(out.kind).toBe("image");
      const meta = await sharp(out.jpeg).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual([
        "jpeg",
        width,
        height,
      ]);
    }
  });

  it("rota por EXIF: una foto con orientacion 6 sale en vertical", async () => {
    const rotated = await sharp({
      create: { width: 400, height: 200, channels: 3, background: "#33c" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const [out] = await readAiImages(multipart([rotated]), LIMITES);
    const meta = await sharp(out.jpeg).metadata();
    expect([meta.width, meta.height]).toEqual([200, 400]);
  });

  it("un cuerpo que no es multipart → 422 invalid_photos", async () => {
    const request = new Request("http://x.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "harina" }),
    });
    expect((await rejection(readAiImages(request, LIMITES))).code).toBe(
      "invalid_photos",
    );
  });

  it("una parte `photos` que es texto → 422", async () => {
    const png = await image("png", 50, 40);
    expect(
      (await rejection(readAiImages(multipart(["no soy un archivo"]), LIMITES)))
        .code,
    ).toBe("invalid_photos");
    // Mezclada con una foto valida, tambien.
    expect(
      (await rejection(readAiImages(multipart([png, "texto"]), LIMITES))).code,
    ).toBe("invalid_photos");
  });
});
