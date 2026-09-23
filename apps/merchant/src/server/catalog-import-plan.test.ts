import { describe, expect, it } from "vitest";
import { buildAdditivePlan, type CatalogSnapshot } from "./catalog-import/plan";
import type { ProviderExtraction } from "./catalog-import/types";

/**
 * Spec 0091 §3 — EL PLAN ADITIVO, ASEVERADO SIN BASE.
 *
 * Todo lo que decide que se crea y que se omite es una funcion pura, y por eso se puede
 * pinnear por valor exacto. Lo que Postgres tiene que confirmar —el rollback, el lock, el
 * 23505— vive en `catalog-import-write.neon.integration.test.ts`; la clave canonica y el
 * precio, en `catalog-import-price.test.ts`.
 */
const extraccion = (
  categories: {
    sourceId: string;
    name: string;
    products: { sourceId: string; name: string; priceText: string | null }[];
  }[],
  discarded: ProviderExtraction["discarded"] = [],
): ProviderExtraction => ({
  categories,
  discarded,
  warnings: [],
  usage: { inputTokens: null, outputTokens: null },
  providerRequestId: null,
});

const producto = (name: string, priceText: string | null = null) => ({
  sourceId: `p-${name}`,
  name,
  priceText,
});

const vacio: CatalogSnapshot = { categories: [], products: [] };

const fecha = (iso: string) => new Date(iso);

describe("el plan aditivo (§3)", () => {
  it("con el catálogo vacío crea todo, en orden de primera aparición", () => {
    const plan = buildAdditivePlan(
      extraccion([
        {
          sourceId: "c1",
          name: "Bebidas",
          products: [producto("Café", "$3,50"), producto("Té")],
        },
        { sourceId: "c2", name: "Postres", products: [producto("Flan", "5")] },
      ]),
      vacio,
    );
    expect(plan.categories.map((c) => [c.name, c.existingId])).toEqual([
      ["Bebidas", null],
      ["Postres", null],
    ]);
    expect(plan.categories[0].products).toEqual([
      { name: "Café", unitPrice: "3.50" },
      { name: "Té", unitPrice: null },
    ]);
    expect(plan.categoriesReused).toBe(0);
    expect(plan.productsSkipped).toBe(0);
    expect(plan.productsWithoutPrice).toBe(1);
  });

  it("una categoría que ya existe se REUSA por clave canónica", () => {
    const plan = buildAdditivePlan(
      extraccion([
        { sourceId: "c1", name: "bebidas", products: [producto("Agua")] },
      ]),
      {
        categories: [
          { id: "cat-1", name: "Bebidas", createdAt: fecha("2026-01-01") },
        ],
        products: [],
      },
    );
    expect(plan.categories).toHaveLength(1);
    expect(plan.categories[0].existingId).toBe("cat-1");
    expect(plan.categoriesReused).toBe(1);
  });

  /** §3 — el empate lo gana la **más vieja**: reusar nunca destruye nada. */
  it("con dos categorías existentes que empatan, gana la de `createdAt` menor", () => {
    const plan = buildAdditivePlan(
      extraccion([
        { sourceId: "c1", name: "Coca-Cola", products: [producto("Lata")] },
      ]),
      {
        categories: [
          { id: "nueva", name: "coca cola", createdAt: fecha("2026-06-01") },
          { id: "vieja", name: "Coca-Cola", createdAt: fecha("2024-01-01") },
        ],
        products: [],
      },
    );
    expect(plan.categories[0].existingId).toBe("vieja");
  });

  it("dos categorías extraídas con la misma clave se agrupan en una", () => {
    const plan = buildAdditivePlan(
      extraccion([
        { sourceId: "c1", name: "Bebidas", products: [producto("Agua")] },
        { sourceId: "c2", name: "BEBIDAS", products: [producto("Soda")] },
      ]),
      vacio,
    );
    expect(plan.categories).toHaveLength(1);
    expect(plan.categories[0].name).toBe("Bebidas");
    expect(plan.categories[0].products.map((p) => p.name)).toEqual([
      "Agua",
      "Soda",
    ]);
  });

  it("una categoría NUEVA sin un solo producto a crear no se crea", () => {
    const plan = buildAdditivePlan(
      extraccion([{ sourceId: "c1", name: "Vacía", products: [] }]),
      vacio,
    );
    expect(plan.categories).toEqual([]);
  });

  it("un producto que ya existe en la categoría conciliada se OMITE", () => {
    const plan = buildAdditivePlan(
      extraccion([
        {
          sourceId: "c1",
          name: "Bebidas",
          products: [producto("Café", "9,99"), producto("Agua")],
        },
      ]),
      {
        categories: [
          { id: "cat-1", name: "Bebidas", createdAt: fecha("2026-01-01") },
        ],
        products: [{ id: "p-1", name: "café", categoryId: "cat-1" }],
      },
    );
    expect(plan.categories[0].products.map((p) => p.name)).toEqual(["Agua"]);
    expect(plan.productsSkipped).toBe(1);
  });

  /**
   * ORACULO DE M2 — **comparar productos globalmente en vez de por categoría**.
   *
   * «Agua» existe en Bebidas; la importación la trae en Postres. Son dos productos legítimos
   * y el de Postres SE CREA. Un plan que comparara contra todo el catálogo lo omitiría y
   * `productsSkipped` pasaría a 1: las dos aserciones se ponen rojas.
   */
  it("el mismo nombre en OTRA categoría SÍ se crea", () => {
    const plan = buildAdditivePlan(
      extraccion([
        { sourceId: "c1", name: "Postres", products: [producto("Agua")] },
      ]),
      {
        categories: [
          { id: "cat-1", name: "Bebidas", createdAt: fecha("2026-01-01") },
          { id: "cat-2", name: "Postres", createdAt: fecha("2026-01-02") },
        ],
        products: [{ id: "p-1", name: "Agua", categoryId: "cat-1" }],
      },
    );
    expect(plan.categories[0].existingId).toBe("cat-2");
    expect(plan.categories[0].products.map((p) => p.name)).toEqual(["Agua"]);
    expect(plan.productsSkipped).toBe(0);
  });

  /** El mismo vector, con la categoría NUEVA: no se compara con nada de otras categorías. */
  it("el producto de una categoría NUEVA no se compara con otras categorías", () => {
    const plan = buildAdditivePlan(
      extraccion([
        { sourceId: "c1", name: "Recién nacida", products: [producto("Agua")] },
      ]),
      {
        categories: [
          { id: "cat-1", name: "Bebidas", createdAt: fecha("2026-01-01") },
        ],
        products: [{ id: "p-1", name: "Agua", categoryId: "cat-1" }],
      },
    );
    expect(plan.categories[0].products.map((p) => p.name)).toEqual(["Agua"]);
    expect(plan.productsSkipped).toBe(0);
  });

  it("un producto SIN categoría en el catálogo no bloquea nada", () => {
    const plan = buildAdditivePlan(
      extraccion([
        { sourceId: "c1", name: "Bebidas", products: [producto("Agua")] },
      ]),
      {
        categories: [
          { id: "cat-1", name: "Bebidas", createdAt: fecha("2026-01-01") },
        ],
        products: [{ id: "p-1", name: "Agua", categoryId: null }],
      },
    );
    expect(plan.categories[0].products).toHaveLength(1);
  });

  it("el mismo producto repetido DENTRO de la importación se crea una sola vez", () => {
    const plan = buildAdditivePlan(
      extraccion([
        {
          sourceId: "c1",
          name: "Bebidas",
          products: [producto("Agua", "1"), producto("AGUA", "2")],
        },
      ]),
      vacio,
    );
    expect(plan.categories[0].products).toEqual([
      { name: "Agua", unitPrice: "1.00" },
    ]);
    expect(plan.productsSkipped).toBe(1);
  });

  /** §3/§1 — la operación es SOLO aditiva: un precio distinto no actualiza nada. */
  it("un precio distinto del existente no genera ninguna escritura sobre él", () => {
    const plan = buildAdditivePlan(
      extraccion([
        { sourceId: "c1", name: "Bebidas", products: [producto("Café", "99")] },
      ]),
      {
        categories: [
          { id: "cat-1", name: "Bebidas", createdAt: fecha("2026-01-01") },
        ],
        products: [{ id: "p-1", name: "Café", categoryId: "cat-1" }],
      },
    );
    expect(plan.categories[0].products).toEqual([]);
    expect(JSON.stringify(plan)).not.toContain("99");
  });

  /**
   * §3 — EL EMPATE DE `createdAt` LO DESEMPATA EL `id` MENOR.
   *
   * No es teorico y no hace falta una carrera: la clave canonica es MAS agresiva que el
   * indice unico de la base (el indice es `lower(name)`; `matchKey` ademas saca acentos y
   * puntuacion), asi que «Bebidas» y «Bebidas!» **conviven** en el catalogo y la importacion
   * las ve como la misma. Y si las creo la misma importacion, comparten `created_at`
   * EXACTO: el writer las inserta en una sola transaccion y `now()` en Postgres es el
   * instante en que la transaccion arranco, no el de cada fila.
   *
   * Sin el desempate, a que categoria van los productos depende del orden en que Postgres
   * devolvio las filas. Nada se destruye —las dos son del merchant y las dos se reusan—
   * pero el plan dejaria de ser una funcion del catalogo.
   */
  it("con `createdAt` empatado gana el `id` menor, no el orden de las filas", () => {
    const empatadas = (orden: "asc" | "desc"): CatalogSnapshot => {
      const filas = [
        { id: "aaa", name: "Bebidas", createdAt: fecha("2026-01-01") },
        { id: "zzz", name: "Bebidas!", createdAt: fecha("2026-01-01") },
      ];
      return {
        categories: orden === "asc" ? filas : [...filas].reverse(),
        products: [],
      };
    };
    const conAsc = buildAdditivePlan(
      extraccion([
        { sourceId: "c1", name: "bebidas", products: [producto("Agua")] },
      ]),
      empatadas("asc"),
    );
    const conDesc = buildAdditivePlan(
      extraccion([
        { sourceId: "c1", name: "bebidas", products: [producto("Agua")] },
      ]),
      empatadas("desc"),
    );

    // Ninguna se crea: la extraida concilia contra una que ya existe.
    expect(conAsc.categories.filter((c) => c.existingId === null)).toEqual([]);
    expect(conAsc.categoriesReused).toBe(1);
    // Y el producto cae SIEMPRE en la del `id` menor, venga como venga la lectura.
    expect(conAsc.categories[0].existingId).toBe("aaa");
    expect(conDesc.categories[0].existingId).toBe("aaa");
    expect(conDesc).toEqual(conAsc);
  });

  it("los descartes se pasan al resumen: 50 listados y el total contado", () => {
    const muchos = Array.from({ length: 63 }, (_, i) => ({
      text: `roto ${i}`,
      reason: "invalid_row" as const,
    }));
    const plan = buildAdditivePlan(extraccion([], muchos), vacio);
    expect(plan.discardedCount).toBe(63);
    expect(plan.discarded).toHaveLength(50);
    expect(plan.discarded[0]).toEqual({
      text: "roto 0",
      reason: "invalid_row",
    });
  });
});
