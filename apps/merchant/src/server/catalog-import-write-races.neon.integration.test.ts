import { eq } from "drizzle-orm";
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
  type SeedImport,
} from "./catalog-import-integration-support";
import type { ProviderExtraction } from "./catalog-import/types";

vi.mock("./r2", async () => {
  const real = await vi.importActual<typeof import("./r2")>("./r2");
  return { ...real, deleteObjectKeys: async () => undefined };
});

const { writeImportedCatalog, insertOrReuseCategory } =
  await import("./catalog-import/write");
const { getDb, withDbTransaction } = await import("./db");
const { catalogImports, productCategories, products } =
  await import("./schema");

/**
 * Spec 0091 §6 — LAS CARRERAS DEL WRITER, que **solo** existen contra Postgres: el
 * `SELECT … FOR UPDATE`, la relectura dentro de la transaccion, el 23505 recuperado y el
 * rollback total.
 */
const extraccion = (
  categories: ProviderExtraction["categories"],
): ProviderExtraction => ({
  categories,
  discarded: [],
  warnings: [],
  usage: { inputTokens: null, outputTokens: null },
  providerRequestId: null,
});

const prod = (name: string, priceText: string | null = null) => ({
  sourceId: `p-${name}`,
  name,
  priceText,
});

const MENU = extraccion([
  {
    sourceId: "c1",
    name: "Bebidas",
    products: [prod("Cappuccino", "$3,25"), prod("Té", "2,00")],
  },
]);

describe.skipIf(!enabled)("las carreras del writer (spec 0091 §6)", () => {
  let a: SeedImport;

  beforeAll(async () => {
    a = await seedNegocio("Writer races QA");
  });

  afterAll(async () => {
    await limpiarNegocio(a);
  });

  const analizando = () =>
    seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "analyzing",
      providerJobId: `job-${Math.random().toString(36).slice(2, 10)}`,
      // **Lease VIVO a proposito.** La rama de Neon es compartida y el reconciliador es
      // GLOBAL: reclama cualquier `analyzing` con el lease vencido, de cualquier negocio. Un
      // import sembrado con `lease_until` null lo hace polear filas de esta suite y rompe
      // `catalog-import-reconcile.neon.integration.test.ts` cuando corren en paralelo.
      leaseUntil: new Date(Date.now() + 60 * 60 * 1000),
    });

  /** Borra el catálogo del negocio entre casos, por id explícito. */
  const limpiarCatalogo = async () => {
    await getDb().delete(products).where(eq(products.businessId, a.businessId));
    await getDb()
      .delete(productCategories)
      .where(eq(productCategories.businessId, a.businessId));
  };

  /**
   * DoD — **dos callbacks/reconciliadores concurrentes importan UNA SOLA VEZ.**
   *
   * Lo que lo garantiza es el `SELECT … FOR UPDATE` mas el chequeo de `accepted` bajo el
   * lock, no una clave del cliente: el segundo entra cuando el primero ya commiteó, ve
   * `accepted` y devuelve el MISMO resumen sin escribir una fila.
   */
  it("dos writers concurrentes sobre el mismo import escriben una sola vez", async () => {
    await limpiarCatalogo();
    const id = await analizando();
    const [uno, dos] = await Promise.all([
      writeImportedCatalog(id, a.businessId, MENU),
      writeImportedCatalog(id, a.businessId, MENU),
    ]);
    expect([uno?.created, dos?.created].sort()).toEqual([false, true]);
    expect(uno?.result).toEqual(dos?.result);
    expect(await productosDe(a.businessId)).toHaveLength(2);
    expect(await categoriasDe(a.businessId)).toHaveLength(1);
  });

  /** Y repetirlo despues, en frio: el mismo resumen y CERO filas nuevas. */
  it("repetir el mismo resultado crea CERO filas y devuelve el mismo `result`", async () => {
    await limpiarCatalogo();
    const id = await analizando();
    const primero = await writeImportedCatalog(id, a.businessId, MENU);
    const filas = await productosDe(a.businessId);
    const segundo = await writeImportedCatalog(id, a.businessId, MENU);
    expect(segundo).toEqual({ created: false, result: primero?.result });
    expect(await productosDe(a.businessId)).toEqual(filas);
  });

  /**
   * ORACULO DE M1 — **conciliar contra una lectura PREVIA a la transacción.**
   *
   * El catálogo puede cambiar mientras el proveedor trabaja. La interleaving se fuerza con
   * el propio lock del writer: el test toma primero el `FOR UPDATE` del import, arranca el
   * writer (que queda bloqueado ahí), crea «Cappuccino» y recién entonces commitea. Cuando
   * el writer sigue, su relectura —que está DENTRO de la transacción— tiene que ver el
   * producto nuevo y omitirlo.
   *
   * Si la relectura se moviera afuera de la transacción, ocurriría antes del bloqueo y
   * «Cappuccino» quedaría DUPLICADO: `productsCreated` pasa a 2 y el `toHaveLength(1)` de
   * abajo se pone rojo.
   */
  it("un producto creado DURANTE el análisis no se duplica: la relectura va adentro", async () => {
    await limpiarCatalogo();
    const bebidas = await sembrarCategoria(a.businessId, "Bebidas");
    const id = await analizando();

    let escritura!: ReturnType<typeof writeImportedCatalog>;
    await withDbTransaction(async (tx) => {
      // 1. El test se queda con el lock del import.
      await tx
        .select()
        .from(catalogImports)
        .where(eq(catalogImports.id, id))
        .for("update")
        .limit(1);
      // 2. El writer arranca y queda bloqueado en ese mismo lock.
      escritura = writeImportedCatalog(id, a.businessId, MENU);
      await new Promise((resolve) => setTimeout(resolve, 300));
      // 3. Recién ahora aparece el producto, y se commitea al salir del `withDbTransaction`.
      await tx.insert(products).values({
        businessId: a.businessId,
        categoryId: bebidas,
        name: "Cappuccino",
        unitPrice: "9.99",
      });
    });

    const salida = await escritura;
    expect(salida?.result).toMatchObject({
      categoriesCreated: 0,
      categoriesReused: 1,
      productsCreated: 1,
      productsSkipped: 1,
    });
    const cappus = (await productosDe(a.businessId)).filter(
      (p) => p.name === "Cappuccino",
    );
    expect(cappus).toHaveLength(1);
    // Y el que quedó es el del merchant, con SU precio: la importación no actualiza nada.
    expect(cappus[0].unitPrice).toBe("9.99");
  });

  /**
   * ORACULO DE M6 — **el 23505 de `core_product_category_name_unique` se REUSA, no falla.**
   *
   * Es el camino exacto que toma una categoría que apareció entre la relectura y el insert:
   * el `on conflict do nothing` no devuelve fila y la categoría se relee por `lower(name)`.
   * Si volviera a ser un `catalog_import_conflict`, este caso se pone rojo con esa excepción.
   *
   * LIMITE DECLARADO: lo que se ejecuta acá es el MECANISMO de recuperación, no el
   * *scheduling* de la carrera — forzar el interleaving exacto exigiría dos imports abiertos
   * del mismo negocio, que el índice parcial `core_catalog_import_open_unique` prohíbe.
   */
  it("una categoría que ya existe con el mismo `lower(name)` se REUSA", async () => {
    await limpiarCatalogo();
    const existente = await sembrarCategoria(a.businessId, "Bebidas Calientes");
    const salida = await withDbTransaction((tx) =>
      insertOrReuseCategory(tx, a.businessId, "bebidas calientes"),
    );
    expect(salida).toEqual({ id: existente, created: false });
    expect(await categoriasDe(a.businessId)).toHaveLength(1);

    // CONTROL POSITIVO del mismo vector: un nombre que NO choca sí se crea.
    const nueva = await withDbTransaction((tx) =>
      insertOrReuseCategory(tx, a.businessId, "Bebidas Frías"),
    );
    expect(nueva.created).toBe(true);
    expect(await categoriasDe(a.businessId)).toHaveLength(2);
  });

  /**
   * DoD — **un fallo entre inserts deja CERO filas de catálogo.**
   *
   * Las categorías se insertan antes que el bulk de productos: si el bulk revienta, lo ya
   * insertado tiene que irse con la transacción. El disparador es un nombre con un byte NUL,
   * que Postgres no puede guardar en `text` — llega hasta acá porque el test construye la
   * extracción a mano, sin pasar por el saneado.
   */
  it("un fallo en el insert de productos revierte también las categorías", async () => {
    await limpiarCatalogo();
    const id = await analizando();
    await expect(
      writeImportedCatalog(
        id,
        a.businessId,
        extraccion([
          {
            sourceId: "c1",
            name: "Bebidas",
            products: [prod("Cappuccino", "3,00")],
          },
          {
            sourceId: "c2",
            name: "Rota",
            products: [prod("Imposible\u0000", "1,00")],
          },
        ]),
      ),
    ).rejects.toThrow();
    expect(await productosDe(a.businessId)).toEqual([]);
    expect(await categoriasDe(a.businessId)).toEqual([]);
    // Y el import NO quedó marcado como importado.
    expect((await leerImport(id))?.status).toBe("analyzing");
  });
});
