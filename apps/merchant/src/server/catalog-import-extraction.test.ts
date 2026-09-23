import { describe, expect, it } from "vitest";
import {
  MAX_EXTRACTED_PRODUCTS,
  sanitizeText,
  validateProviderExtraction,
} from "./catalog-import/validation";

/**
 * Spec 0091 §5/§10 — EL ESQUEMA CERRADO `v2` con el que se valida **siempre** la salida del
 * proveedor, aunque prometa JSON Schema.
 *
 * Lo que cambio respecto de la 0090: el producto trae `priceText` y **el modelo ya no decide
 * el precio**; y lo que no cumple **ya no tumba la extraccion entera**, se DESCARTA y se
 * lista. Aparte de la matriz de archivos por el hook `file-size`.
 *
 * ORACULO DE M5: los dos casos de abajo —el nombre vacio y el nombre de 500 caracteres—
 * aseveran que el item **NO llega a `categories`** y **SI llega a `discarded`**. Crear el
 * item ilegible en vez de descartarlo pone los dos en rojo.
 */
describe("esquema cerrado de la salida del proveedor (spec 0091 §5)", () => {
  const producto = (overrides: Record<string, unknown> = {}) => ({
    sourceId: "p1",
    name: "Café",
    priceText: "$3,50",
    ...overrides,
  });

  const extraccion = (overrides: Record<string, unknown> = {}) => ({
    categories: [{ sourceId: "c1", name: "Bebidas", products: [producto()] }],
    warnings: [],
    usage: { inputTokens: 1, outputTokens: 2 },
    providerRequestId: "req_1",
    ...overrides,
  });

  const conProductos = (...products: unknown[]) =>
    extraccion({
      categories: [{ sourceId: "c1", name: "Bebidas", products }],
    });

  it("el `priceText` viaja CRUDO: el esquema no lo interpreta ni lo normaliza", () => {
    const out = validateProviderExtraction(extraccion());
    expect(out.categories[0].products[0]).toEqual({
      sourceId: "p1",
      name: "Café",
      priceText: "$3,50",
    });
    expect(out.discarded).toEqual([]);
  });

  it("sin precio impreso, `priceText` es null (y un no-string también)", () => {
    const out = validateProviderExtraction(
      conProductos(
        producto({ priceText: null }),
        producto({ sourceId: "p2", priceText: 350 }),
        producto({ sourceId: "p3", priceText: "   " }),
      ),
    );
    expect(out.categories[0].products.map((p) => p.priceText)).toEqual([
      null,
      null,
      null,
    ]);
  });

  /** ORACULO DE M5 — el nombre ilegible NO entra al catálogo y SÍ entra al resumen. */
  it("un nombre que queda vacío se DESCARTA como `unreadable_name`", () => {
    const out = validateProviderExtraction(
      conProductos(
        producto(),
        producto({ sourceId: "p2", name: "  \u0000 " }),
        producto({ sourceId: "p3", name: "" }),
      ),
    );
    expect(out.categories[0].products).toHaveLength(1);
    expect(out.categories[0].products[0].name).toBe("Café");
    expect(out.discarded).toEqual([
      { text: "", reason: "unreadable_name" },
      { text: "", reason: "unreadable_name" },
    ]);
  });

  /** ORACULO DE M5 — el nombre que pasa el tope se DESCARTA, **no se recorta**: un nombre
   * cortado a la mitad es un producto inventado. */
  it("un nombre que supera 120 se DESCARTA con el texto que se vio", () => {
    const out = validateProviderExtraction(
      conProductos(producto({ name: "y".repeat(500) })),
    );
    expect(out.categories[0].products).toHaveLength(0);
    expect(out.discarded).toEqual([
      { text: "y".repeat(120), reason: "unreadable_name" },
    ]);
    // Exactamente 120 SÍ entra: el borde se mide, no se supone.
    expect(
      validateProviderExtraction(
        conProductos(producto({ name: "y".repeat(120) })),
      ).categories[0].products,
    ).toHaveLength(1);
  });

  it("una fila que no cumple el esquema es `invalid_row`, y no tumba el resto", () => {
    const out = validateProviderExtraction(
      conProductos(
        producto(),
        "no soy un objeto",
        { sourceId: "p2", name: 42 },
        { name: "Sin sourceId" },
        producto({ sourceId: "p1", name: "sourceId repetido" }),
      ),
    );
    expect(out.categories[0].products.map((p) => p.name)).toEqual(["Café"]);
    expect(out.discarded.map((d) => d.reason)).toEqual([
      "invalid_row",
      "invalid_row",
      "invalid_row",
      "invalid_row",
    ]);
    expect(out.discarded[0].text).toBe("no soy un objeto");
    expect(out.discarded[2].text).toBe("Sin sourceId");
  });

  /** §5 — «una categoría entera inválida descarta sus productos con `invalid_row`». */
  it("una categoría inválida descarta SUS productos, uno por uno", () => {
    const out = validateProviderExtraction(
      extraccion({
        categories: [
          {
            sourceId: "c1",
            name: "   ",
            products: [producto(), producto({ sourceId: "p2", name: "Té" })],
          },
          {
            sourceId: "c2",
            name: "Buena",
            products: [producto({ sourceId: "p3", name: "Agua" })],
          },
        ],
      }),
    );
    expect(out.categories.map((c) => c.name)).toEqual(["Buena"]);
    expect(out.discarded).toEqual([
      { text: "Café", reason: "invalid_row" },
      { text: "Té", reason: "invalid_row" },
    ]);
  });

  it("recorta el nombre de la categoría al límite del catálogo (60)", () => {
    const out = validateProviderExtraction(
      extraccion({
        categories: [
          { sourceId: "c1", name: "x".repeat(200), products: [producto()] },
        ],
      }),
    );
    expect(out.categories[0].name).toHaveLength(60);
  });

  it("más de 250 productos FALLA, no trunca", () => {
    const muchos = Array.from({ length: MAX_EXTRACTED_PRODUCTS + 1 }, (_, i) =>
      producto({ sourceId: `p${i}`, name: `Producto ${i}` }),
    );
    expect(() => validateProviderExtraction(conProductos(...muchos))).toThrow(
      /too_many_products/,
    );
    expect(
      validateProviderExtraction(conProductos(...muchos.slice(0, 250)))
        .categories[0].products,
    ).toHaveLength(250);
  });

  it("lo que no es una extracción se rechaza antes de persistir", () => {
    expect(() => validateProviderExtraction(null)).toThrow();
    expect(() => validateProviderExtraction({ categories: "no" })).toThrow();
  });

  it("el texto del documento se sanea: sin caracteres de control ni espacios de más", () => {
    expect(sanitizeText("  Café\u0000\u0007  con   leche ", 120)).toBe(
      "Café con leche",
    );
    expect(sanitizeText("a".repeat(10), 4)).toBe("aaaa");
  });
});
