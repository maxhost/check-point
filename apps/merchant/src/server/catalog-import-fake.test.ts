import { describe, expect, it } from "vitest";
import {
  catalogExtractionProviderFromEnv,
  ProviderUnavailableError,
} from "./catalog-import/providers/provider";
import { FakeCatalogExtractionProvider } from "./catalog-import/providers/fake";
import type {
  CatalogExtractionInput,
  CatalogExtractionProvider,
} from "./catalog-import/types";

/**
 * Spec 0091 §10 — EL ADAPTADOR `fake`, que es lo que permite desarrollar y testear el arco
 * entero sin una clave y sin gastar un centavo.
 *
 * Aparte de `catalog-import-provider.test.ts` por el hook `file-size`: ese archivo ya estaba
 * en 332 lineas antes de esta spec, y la regla del repo es **dividir, no extender**.
 */
/** Un entorno parcial: `catalogExtractionProviderFromEnv` lee tres claves y `ProcessEnv`
 * exige `NODE_ENV`, que no tiene nada que ver con esta decision. */
const env = (valores: Record<string, string>) =>
  valores as unknown as NodeJS.ProcessEnv;

const entrada = (bytes = "menu"): CatalogExtractionInput => ({
  importId: "i-1",
  sourceKind: "images",
  pages: [
    { bytes: Buffer.from(bytes), contentType: "image/jpeg", position: 0 },
  ],
});

describe("adaptador `fake` (specs 0090 §4 / 0091 §10)", () => {
  it("contesta `completed` y es determinista por contenido", async () => {
    const provider = new FakeCatalogExtractionProvider();
    const a = await provider.start(entrada());
    const b = await provider.start(entrada());
    expect(a.kind).toBe("completed");
    expect(a).toEqual(b);
  });

  /**
   * §10 — el fake refleja el contrato `v2` **incluidos los dos casos que importan**: un
   * `priceText` que no parsea y un item ilegible. Sin ellos, los dos caminos solo se podrian
   * probar gastando dinero en el proveedor real.
   */
  it("devuelve `priceText` crudo, uno que NO parsea y un item DESCARTADO", async () => {
    const result = await new FakeCatalogExtractionProvider().start(entrada());
    if (result.kind !== "completed") throw new Error("esperaba completed");
    const productos = result.extraction.categories.flatMap((c) => c.products);
    expect(productos.map((p) => p.priceText)).toContain("$3,25");
    // Un rango: el servidor lo va a dejar sin precio, y eso es deliberado.
    expect(productos.find((p) => p.name === "Té de hierbas")?.priceText).toBe(
      "2,5 - 3,5",
    );
    expect(result.extraction.discarded).toEqual([
      { text: "", reason: "unreadable_name" },
    ]);
    // El ilegible NO llegó a `categories`.
    expect(productos.some((p) => !p.name.trim())).toBe(false);
  });

  it("implementa SOLO `start`: la forma diferida es opcional", () => {
    const provider: CatalogExtractionProvider =
      new FakeCatalogExtractionProvider();
    expect(provider.poll).toBeUndefined();
    expect(provider.verifyCallback).toBeUndefined();
  });
});

describe("resolución del proveedor por configuración (specs 0090 §4 / 0091 §10)", () => {
  it("`fake` es el default y no necesita nada", () => {
    expect(catalogExtractionProviderFromEnv(env({})).id).toBe("fake");
  });

  /** **NO HAY FALLBACK SILENCIOSO**: caer al `fake` en producción le daría al merchant un
   * menú inventado con cara de análisis real. */
  it("`openai` SIN clave tira, no cae al fake", () => {
    expect(() =>
      catalogExtractionProviderFromEnv(
        env({ CATALOG_EXTRACTION_PROVIDER: "openai" }),
      ),
    ).toThrow(ProviderUnavailableError);
  });

  it("un proveedor desconocido tira, no cae al fake", () => {
    expect(() =>
      catalogExtractionProviderFromEnv(
        env({ CATALOG_EXTRACTION_PROVIDER: "kimi" }),
      ),
    ).toThrow(ProviderUnavailableError);
  });

  it("con clave, `openai` se construye con el modelo de la env", () => {
    const provider = catalogExtractionProviderFromEnv(
      env({
        CATALOG_EXTRACTION_PROVIDER: "openai",
        OPENAI_API_KEY: "sk-test",
        CATALOG_EXTRACTION_MODEL: "gpt-x",
      }),
    );
    expect({ id: provider.id, model: provider.model }).toEqual({
      id: "openai",
      model: "gpt-x",
    });
  });
});
