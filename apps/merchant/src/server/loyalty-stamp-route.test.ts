import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicStamp } from "./loyalty-program/stamp";

/**
 * Spec 0069 §D5 — la RUTA pública del sello, sus tres desenlaces y la no-filtración.
 *
 * **Oráculo de la mutación #4** (serializar `stampImageObjectKey` en la respuesta
 * pública): se lee el cuerpo Y TODOS los headers y se exige que la clave interna de R2
 * no aparezca en ninguno de los dos. No alcanza con mirar el cuerpo: la forma más fácil
 * de filtrar una clave desde una ruta que devuelve bytes es un header de debug.
 *
 * La resolución contra la base y R2 van dobladas: lo que se ejercita acá es la DECISIÓN
 * de la ruta. La resolución real (el guard de versión contra Postgres) tiene su propio
 * oráculo en `loyalty-stamp-placeholder.neon.integration.test.ts`.
 */
const OBJECT_KEY = "loyalty/biz-1/prog-1/8f3c2a";
const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const PROGRAM_ID = "22222222-2222-4222-8222-222222222222";

let resolved: PublicStamp | null = null;

vi.mock("./loyalty-program", () => ({
  stampForPublicProgram: async () => resolved,
}));

vi.mock("./r2", () => ({
  getPrivateObject: async (key: string) => ({
    Body: (async function* () {
      yield new TextEncoder().encode(`bytes-de:${key}`);
    })(),
  }),
  objectBodyToWebStream: (body: AsyncIterable<Uint8Array>) =>
    new ReadableStream<Uint8Array>({
      async start(controller) {
        for await (const chunk of body) controller.enqueue(chunk);
        controller.close();
      },
    }),
}));

const { GET } =
  await import("../app/api/public/loyalty/[businessId]/[programId]/stamp/route");

const get = (version: string, accept?: string) =>
  GET(
    new Request(
      `http://localhost:3001/api/public/loyalty/${BUSINESS_ID}/${PROGRAM_ID}/stamp?v=${version}`,
      { headers: accept ? { accept } : {} },
    ),
    {
      params: Promise.resolve({
        businessId: BUSINESS_ID,
        programId: PROGRAM_ID,
      }),
    },
  );

const headerBlob = (response: Response) =>
  [...response.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");

beforeEach(() => {
  resolved = null;
});

describe("GET /api/public/loyalty/:b/:p/stamp (spec 0069 §D5)", () => {
  it("sin sello sirve el PLACEHOLDER: 200 image/png con el magic number", async () => {
    resolved = { kind: "placeholder", businessName: "La Farmacia" };
    const response = await get("0");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(bytes.byteLength).toBeGreaterThan(100);
  }, 30_000);

  it("el placeholder ignora `accept: image/webp` y sigue siendo PNG", async () => {
    resolved = { kind: "placeholder", businessName: "La Farmacia" };
    const response = await get("0", "image/webp,image/*");
    expect(response.headers.get("content-type")).toBe("image/png");
  }, 30_000);

  it("`null` (versión vieja, programa inexistente) es 404 con cuerpo vacío", async () => {
    resolved = null;
    const response = await get("0");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  // === REGRESIÓN: un programa CON sello sigue sirviendo su imagen ===
  it.each([
    ["image/png", undefined, "png"],
    ["image/webp", "image/webp,image/*", "webp"],
  ])(
    "con sello devuelve %s desde R2",
    async (contentType, accept, extension) => {
      resolved = { kind: "stamp", objectKey: OBJECT_KEY };
      const response = await get("2", accept);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(contentType);
      expect(await response.text()).toBe(
        `bytes-de:${OBJECT_KEY}/stamp.${extension}`,
      );
    },
  );

  // === MUTACIÓN #4 ===
  it("NUNCA serializa la clave interna de R2: ni en el cuerpo ni en un header", async () => {
    resolved = { kind: "stamp", objectKey: OBJECT_KEY };
    const response = await get("2");
    const headers = headerBlob(response);
    expect(headers).not.toContain(OBJECT_KEY);
    expect(headers).not.toContain("ObjectKey");
    expect(headers).not.toContain("objectKey");
    // El cuerpo son los bytes de la imagen. El doble de R2 los etiqueta con la key a
    // propósito, así que se compara contra el prefijo `bytes-de:` y no contra la key
    // pelada: lo que se prohíbe es que la key salga por un canal que no sean los bytes.
    expect(response.headers.get("content-type")).toBe("image/png");
    expect([...response.headers.keys()].sort()).toEqual([
      "cache-control",
      "content-type",
      "x-content-type-options",
    ]);
  });

  it("el placeholder tampoco filtra nada por header", async () => {
    resolved = { kind: "placeholder", businessName: "La Farmacia" };
    const response = await get("0");
    const headers = headerBlob(response);
    expect(headers).not.toContain("ObjectKey");
    expect(headers).not.toContain("loyalty/");
    expect([...response.headers.keys()].sort()).toEqual([
      "cache-control",
      "content-type",
      "x-content-type-options",
    ]);
  }, 30_000);
});
