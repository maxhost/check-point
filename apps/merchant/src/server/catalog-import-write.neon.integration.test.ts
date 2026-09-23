import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  categoriasDe,
  importIntegrationEnabled as enabled,
  leerImport,
  limpiarNegocio,
  productosDe,
  seedImport,
  seedNegocio,
  sembrarCategoria,
  sembrarProducto,
  type SeedImport,
} from "./catalog-import-integration-support";
import type { ProviderExtraction } from "./catalog-import/types";

vi.mock("./r2", async () => {
  const real = await vi.importActual<typeof import("./r2")>("./r2");
  return { ...real, deleteObjectKeys: async () => undefined };
});

const { writeImportedCatalog } = await import("./catalog-import/write");

/**
 * Spec 0091 §3/§6 — EL WRITER CONTRA LA BASE.
 *
 * Lo que solo se puede medir acá: que las filas quedan escritas con los valores exactos,
 * que la conciliacion corre contra el catalogo **releido**, y que el aislamiento por negocio
 * vale para las DOS consultas de la relectura. Las carreras viven en
 * `catalog-import-write-races.neon.integration.test.ts`.
 */
const extraccion = (
  categories: ProviderExtraction["categories"],
  discarded: ProviderExtraction["discarded"] = [],
): ProviderExtraction => ({
  categories,
  discarded,
  warnings: [],
  usage: { inputTokens: 1, outputTokens: 2 },
  providerRequestId: "req_w",
});

const prod = (name: string, priceText: string | null = null) => ({
  sourceId: `p-${name}`,
  name,
  priceText,
});

describe.skipIf(!enabled)("el writer contra Neon (spec 0091 §6)", () => {
  let a: SeedImport;
  let b: SeedImport;

  beforeAll(async () => {
    a = await seedNegocio("Writer QA");
    b = await seedNegocio("Writer QA ajeno");
  });

  afterAll(async () => {
    await limpiarNegocio(a);
    await limpiarNegocio(b);
  });

  const analizando = (seed: SeedImport) =>
    seedImport({
      businessId: seed.businessId,
      userId: seed.userId,
      status: "analyzing",
      providerJobId: `job-${Math.random().toString(36).slice(2, 10)}`,
      // **Lease VIVO a proposito.** La rama de Neon es compartida y el reconciliador es
      // GLOBAL: reclama cualquier `analyzing` con el lease vencido, de cualquier negocio. Un
      // import sembrado con `lease_until` null lo hace polear filas de esta suite y rompe
      // `catalog-import-reconcile.neon.integration.test.ts` cuando corren en paralelo.
      leaseUntil: new Date(Date.now() + 60 * 60 * 1000),
    });

  it("con el catálogo vacío crea todo y deja el import en `accepted` con su `result`", async () => {
    const id = await analizando(a);
    const salida = await writeImportedCatalog(
      id,
      a.businessId,
      extraccion(
        [
          {
            sourceId: "c1",
            name: "Bebidas",
            products: [prod("Cappuccino", "$3,25"), prod("Té", "2,5 - 3,5")],
          },
          {
            sourceId: "c2",
            name: "Para picar",
            products: [prod("Tabla", "$ 1.250,00")],
          },
        ],
        [{ text: "Milanesa ???", reason: "unreadable_name" }],
      ),
    );

    expect(salida).toMatchObject({
      created: true,
      result: {
        categoriesCreated: 2,
        categoriesReused: 0,
        productsCreated: 3,
        productsSkipped: 0,
        productsWithoutPrice: 1,
        discardedCount: 1,
        discarded: [{ text: "Milanesa ???", reason: "unreadable_name" }],
      },
    });

    const productos = await productosDe(a.businessId);
    expect(productos).toHaveLength(3);
    const cappu = productos.find((p) => p.name === "Cappuccino");
    expect(cappu?.unitPrice).toBe("3.25");
    expect(cappu?.unitCost).toBeNull();
    expect(productos.find((p) => p.name === "Tabla")?.unitPrice).toBe(
      "1250.00",
    );
    /** §4 — el `priceText` que NO parsea nace **NULL**, nunca `0.00`. Leído por SQL. */
    expect(productos.find((p) => p.name === "Té")?.unitPrice).toBeNull();
    /** §5 — el item ilegible no existe como fila: solo está en el resumen. */
    expect(productos.some((p) => p.name.includes("Milanesa"))).toBe(false);
    /**
     * §6.7 — NACEN DISPONIBLES EN TODOS LOS LOCALES, y por eso el writer no escribe una sola
     * fila de `product_location`. Sin este assert la columna no la leía nadie: un producto
     * importado con `available_all_locations = false` y CERO filas de local queda restringido
     * a ningún local, y el backoffice lo lista así. Leído por SQL, no por el `result`.
     */
    expect(productos.every((p) => p.availableAllLocations === true)).toBe(true);

    const categorias = await categoriasDe(a.businessId);
    expect(categorias.map((c) => c.name).sort()).toEqual([
      "Bebidas",
      "Para picar",
    ]);
    const bebidas = categorias.find((c) => c.name === "Bebidas");
    expect(cappu?.categoryId).toBe(bebidas?.id);

    const fila = await leerImport(id);
    expect(fila?.status).toBe("accepted");
    expect(fila?.acceptedAt).not.toBeNull();
    expect(fila?.acceptedSummary).toMatchObject({ productsCreated: 3 });
  });

  /**
   * §3 — REUSA LA CATEGORIA, OMITE EL PRODUCTO **DE ESA CATEGORIA**, Y CREA EL HOMONIMO DE
   * OTRA. Es el oráculo de M2 contra la base: comparar productos globalmente pondría
   * `productsCreated` en 1 y dejaría a «Agua» sin su fila en Postres.
   */
  it("reusa la categoría, omite el producto de esa categoría y crea el homónimo de otra", async () => {
    const bebidas = await sembrarCategoria(a.businessId, "Bebidas Frías");
    await sembrarCategoria(a.businessId, "Postres");
    await sembrarProducto({
      businessId: a.businessId,
      name: "Agua",
      categoryId: bebidas,
      unitPrice: "1.00",
    });
    const antes = (await productosDe(a.businessId)).length;
    const id = await analizando(a);

    const salida = await writeImportedCatalog(
      id,
      a.businessId,
      // «bebidas frias» concilia con «Bebidas Frías» por clave canónica (§2).
      extraccion([
        {
          sourceId: "c1",
          name: "bebidas frias",
          products: [prod("agua", "99,00"), prod("Soda", "2,00")],
        },
        { sourceId: "c2", name: "Postres", products: [prod("Agua", "3,00")] },
      ]),
    );

    expect(salida?.result).toMatchObject({
      categoriesCreated: 0,
      categoriesReused: 2,
      productsCreated: 2,
      productsSkipped: 1,
    });
    const productos = await productosDe(a.businessId);
    expect(productos).toHaveLength(antes + 2);
    /** §1 — **un precio distinto NO actualiza nada**: la fila vieja queda como estaba. */
    const aguas = productos.filter((p) => p.name.toLowerCase() === "agua");
    expect(aguas).toHaveLength(2);
    expect(aguas.find((p) => p.categoryId === bebidas)?.unitPrice).toBe("1.00");
    expect(aguas.find((p) => p.categoryId === bebidas)?.name).toBe("Agua");
    const postres = (await categoriasDe(a.businessId)).find(
      (c) => c.name === "Postres",
    );
    expect(aguas.find((p) => p.categoryId === postres?.id)?.unitPrice).toBe(
      "3.00",
    );
  });

  /**
   * ORACULO DE M3 — **el `eq(businessId)` de la relectura del catálogo**.
   *
   * El negocio ajeno tiene una categoría y un producto con los MISMOS nombres. Sin el filtro,
   * la relectura los vería: la categoría del ajeno se «reusaría» (su `id` terminaría en un
   * producto del importador) y «Cortado» se omitiría como duplicado. Las aserciones miran
   * las filas de los DOS negocios.
   */
  it("no ve ni escribe el catálogo de otro negocio", async () => {
    const ajena = await sembrarCategoria(b.businessId, "Cafetería");
    await sembrarProducto({
      businessId: b.businessId,
      name: "Cortado",
      categoryId: ajena,
      unitPrice: "1.11",
    });
    const antesB = await productosDe(b.businessId);
    const id = await analizando(a);

    const salida = await writeImportedCatalog(
      id,
      a.businessId,
      extraccion([
        {
          sourceId: "c1",
          name: "Cafetería",
          products: [prod("Cortado", "5,00")],
        },
      ]),
    );

    expect(salida?.result).toMatchObject({
      categoriesCreated: 1,
      categoriesReused: 0,
      productsCreated: 1,
      productsSkipped: 0,
    });
    // El catálogo del vecino no se movió ni un milímetro.
    expect(await productosDe(b.businessId)).toEqual(antesB);
    expect(
      (await categoriasDe(b.businessId)).filter((c) => c.name === "Cafetería"),
    ).toHaveLength(1);
    // Y el producto creado cuelga de una categoría DEL IMPORTADOR.
    const propias = await categoriasDe(a.businessId);
    const cortado = (await productosDe(a.businessId)).find(
      (p) => p.name === "Cortado",
    );
    expect(cortado?.unitPrice).toBe("5.00");
    expect(propias.some((c) => c.id === cortado?.categoryId)).toBe(true);
    expect(cortado?.categoryId).not.toBe(ajena);
  });

  it("un import de OTRO negocio es no-op: no escribe una sola fila", async () => {
    const ajeno = await analizando(b);
    const antesA = await productosDe(a.businessId);
    const antesB = await productosDe(b.businessId);
    const salida = await writeImportedCatalog(
      ajeno,
      a.businessId,
      extraccion([
        {
          sourceId: "c1",
          name: "Menú de la víctima",
          products: [prod("Plato", "9,00")],
        },
      ]),
    );
    expect(salida).toBeNull();
    expect(await productosDe(a.businessId)).toEqual(antesA);
    expect(await productosDe(b.businessId)).toEqual(antesB);
    expect((await leerImport(ajeno))?.status).toBe("analyzing");
  });

  it("un import cancelado es no-op: el resultado tardío no escribe catálogo", async () => {
    const id = await seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "cancelled",
    });
    const antes = await productosDe(a.businessId);
    expect(
      await writeImportedCatalog(
        id,
        a.businessId,
        extraccion([
          { sourceId: "c1", name: "Tardía", products: [prod("Tarde", "1,00")] },
        ]),
      ),
    ).toBeNull();
    expect(await productosDe(a.businessId)).toEqual(antes);
  });
});
