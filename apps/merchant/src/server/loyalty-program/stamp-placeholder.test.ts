import { describe, expect, it } from "vitest";
import {
  PLACEHOLDER_COLOR,
  PLACEHOLDER_EDGE,
  stampInitial,
  stampPlaceholderPng,
  stampPlaceholderSvg,
} from "./stamp-placeholder";

/** Los 8 primeros bytes de todo PNG (RFC 2083 §3.1). */
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe("stampInitial (spec 0069 §D5)", () => {
  it.each([
    ["Ángel", "Á"],
    // La misma palabra escrita con A + combinante: la segmentación por grafemas la
    // devuelve ENTERA. Un `charAt(0)` devolvería "A" y perdería el acento.
    ["Ángel", "Á".normalize("NFC")],
    ["la farmacia", "L"],
    // El primer grafema no es una letra: se salta hasta la primera que sí lo es.
    ["7 Sellos", "S"],
    ["  Café Central", "C"],
    ["ñandú", "Ñ"],
  ])("la inicial de %j es %j", (name, expected) => {
    expect(stampInitial(name)).toBe(expected);
  });

  it.each([
    ["東京餐厅", "un nombre sin ninguna letra latina"],
    ["Кафе", "cirílico"],
    ["123", "solo dígitos"],
    ["", "vacío"],
    ["☕️", "solo un emoji"],
  ])("%j (%s) cae al placeholder •", (name) => {
    expect(stampInitial(name)).toBe("•");
  });
});

describe("stampPlaceholderSvg (spec 0069 §D5)", () => {
  it("usa #1A1A1A —negro NO puro— y no pinta ningún fondo", () => {
    const svg = stampPlaceholderSvg("La Farmacia");
    expect(PLACEHOLDER_COLOR).toBe("#1A1A1A");
    expect(svg).toContain(`fill="${PLACEHOLDER_COLOR}"`);
    expect(svg).toContain(">L<");
    // Fondo transparente: no hay `<rect>` ni ningún `fill` que no sea el de la letra.
    expect(svg).not.toContain("<rect");
    expect(svg.match(/fill="/g)).toHaveLength(1);
    expect(svg).toContain(
      `viewBox="0 0 ${PLACEHOLDER_EDGE} ${PLACEHOLDER_EDGE}"`,
    );
  });

  it("escapa la inicial: un nombre con `<` no puede inyectar markup", () => {
    // `<` no es letra latina, así que la inicial es la `s`; el XML igual queda sano.
    const svg = stampPlaceholderSvg("<script>alert(1)</script>");
    expect(svg).toContain(">S<");
    expect(svg).not.toContain("<script");
  });
});

describe("stampPlaceholderPng (spec 0069 §D5)", () => {
  it("rasteriza a un PNG cuadrado con el magic number", async () => {
    const png = await stampPlaceholderPng("La Farmacia");
    expect(png.subarray(0, 8)).toEqual(PNG_MAGIC);
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(png).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(PLACEHOLDER_EDGE);
    expect(metadata.height).toBe(PLACEHOLDER_EDGE);
    expect(metadata.hasAlpha).toBe(true);
  }, 30_000);

  it("la LETRA se dibuja de verdad: hay píxeles opacos, y el fondo es transparente", async () => {
    // Sin este oráculo un SVG con la fuente ausente rasterizaría a un cuadrado vacío y
    // el test del magic number pasaría igual. Se cuentan píxeles con alfa.
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(await stampPlaceholderPng("La Farmacia"))
      .raw()
      .toBuffer({ resolveWithObject: true });
    let opaque = 0;
    for (let i = 3; i < data.length; i += info.channels) {
      if (data[i] > 10) opaque += 1;
    }
    const total = info.width * info.height;
    expect(opaque).toBeGreaterThan(total * 0.01);
    // Y NO es un cuadrado lleno: el fondo sigue siendo transparente.
    expect(opaque).toBeLessThan(total * 0.5);
    // La esquina superior izquierda es transparente (alfa 0).
    expect(data[3]).toBe(0);
  }, 30_000);
});
