import { describe, expect, it } from "vitest";
import {
  MAX_DRAFT_PRODUCTS,
  normalizeForDuplicate,
  sanitizeText,
  validateProviderExtraction,
} from "./catalog-import/validation";

/**
 * Spec 0090 §4 — EL ESQUEMA CERRADO con el que se valida **siempre** la salida del
 * proveedor, aunque prometa JSON Schema. Aparte de la matriz de archivos por el hook
 * `file-size`.
 */
describe("esquema cerrado de la salida del proveedor (spec 0090 §4)", () => {
  const extraccion = (overrides: Record<string, unknown> = {}) => ({
    categories: [
      {
        sourceId: "c1",
        name: "Bebidas",
        products: [
          {
            sourceId: "p1",
            name: "Café",
            unitPrice: "3.5",
            priceStatus: "detected",
            sourceText: "Café 3,5",
          },
        ],
      },
    ],
    warnings: [],
    usage: { inputTokens: 1, outputTokens: 2 },
    providerRequestId: "req_1",
    ...overrides,
  });

  it("normaliza el precio con la MISMA función del catálogo: 2 decimales", () => {
    const out = validateProviderExtraction(extraccion());
    expect(out.categories[0].products[0].unitPrice).toBe("3.50");
  });

  /** ORACULO DE M5 en su forma pura: un `ambiguous` **nunca** trae un número. */
  it("un `ambiguous` nace con `unitPrice` null aunque el modelo mande un valor", () => {
    const out = validateProviderExtraction(
      extraccion({
        categories: [
          {
            sourceId: "c1",
            name: "Bebidas",
            products: [
              {
                sourceId: "p1",
                name: "Café",
                unitPrice: "3.50",
                priceStatus: "ambiguous",
                sourceText: "Café ¿3,5?",
              },
            ],
          },
        ],
      }),
    );
    expect(out.categories[0].products[0]).toMatchObject({
      unitPrice: null,
      priceStatus: "ambiguous",
    });
  });

  it("un `detected` sin precio legible se DEGRADA a ambiguo, no inventa un cero", () => {
    const out = validateProviderExtraction(
      extraccion({
        categories: [
          {
            sourceId: "c1",
            name: "Bebidas",
            products: [
              {
                sourceId: "p1",
                name: "Café",
                unitPrice: "s/d",
                priceStatus: "detected",
                sourceText: null,
              },
            ],
          },
        ],
      }),
    );
    expect(out.categories[0].products[0]).toMatchObject({
      unitPrice: null,
      priceStatus: "ambiguous",
    });
  });

  it("recorta a los límites del catálogo: producto 120, categoría 60", () => {
    const out = validateProviderExtraction(
      extraccion({
        categories: [
          {
            sourceId: "c1",
            name: "x".repeat(200),
            products: [
              {
                sourceId: "p1",
                name: "y".repeat(500),
                unitPrice: null,
                priceStatus: "ambiguous",
                sourceText: null,
              },
            ],
          },
        ],
      }),
    );
    expect(out.categories[0].name).toHaveLength(60);
    expect(out.categories[0].products[0].name).toHaveLength(120);
  });

  it("más de 250 productos FALLA, no trunca", () => {
    const muchos = Array.from({ length: MAX_DRAFT_PRODUCTS + 1 }, (_, i) => ({
      sourceId: `p${i}`,
      name: `Producto ${i}`,
      unitPrice: null,
      priceStatus: "ambiguous",
      sourceText: null,
    }));
    expect(() =>
      validateProviderExtraction(
        extraccion({
          categories: [{ sourceId: "c1", name: "Todo", products: muchos }],
        }),
      ),
    ).toThrow(/too_many_products/);
    // Y exactamente 250 sí entra.
    expect(
      validateProviderExtraction(
        extraccion({
          categories: [
            { sourceId: "c1", name: "Todo", products: muchos.slice(0, 250) },
          ],
        }),
      ).categories[0].products,
    ).toHaveLength(250);
  });

  it("lo no conforme se rechaza antes de persistir", () => {
    expect(() => validateProviderExtraction(null)).toThrow();
    expect(() => validateProviderExtraction({ categories: "no" })).toThrow();
    expect(() =>
      validateProviderExtraction(
        extraccion({ categories: [{ sourceId: "c1" }] }),
      ),
    ).toThrow();
    // sourceId repetido: es opaco pero tiene que ser único dentro del resultado.
    expect(() =>
      validateProviderExtraction(
        extraccion({
          categories: [
            { sourceId: "c1", name: "A", products: [] },
            { sourceId: "c1", name: "B", products: [] },
          ],
        }),
      ),
    ).toThrow(/duplicate_source_id/);
  });

  it("el texto del documento se sanea: sin caracteres de control ni espacios de más", () => {
    expect(sanitizeText("  Café\u0000\u0007  con   leche ", 120)).toBe(
      "Café con leche",
    );
    expect(sanitizeText("a".repeat(10), 4)).toBe("aaaa");
  });

  it("la normalización de duplicados es la del ÍNDICE: lower(trim(name))", () => {
    expect(normalizeForDuplicate("  Bebidas Calientes ")).toBe(
      "bebidas calientes",
    );
    expect(normalizeForDuplicate("BEBIDAS")).toBe(
      normalizeForDuplicate("bebidas"),
    );
  });
});
