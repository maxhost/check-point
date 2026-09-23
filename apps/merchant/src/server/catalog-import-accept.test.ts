import { describe, expect, it, vi, beforeEach } from "vitest";
import { productCategories, products } from "./schema";
import {
  CAT_EXISTENTE,
  IMPORT_ID,
  NEGOCIO,
  cola,
  estado,
  fila,
  filasDe,
  limpiarEstado,
  producto,
} from "./catalog-import-accept-double";

/**
 * Spec 0090 §6 — EL `accept`, en la capa pura, con la transaccion doblada.
 *
 * Lo que mide acá y no en integracion: **qué filas se escriben, y con qué valores exactos**.
 *
 * ORACULO DE M5: un `ambiguous` nace con `unit_price` **null**. Si el codigo guardara `0`, la
 * asercion se pone roja — y `0` es un precio falso que parece valido, que era la razon de ser
 * del bloqueo que esta spec sacó.
 */
vi.mock("./db", async () => {
  const { dbDouble } = await import("./catalog-import-accept-double");
  return dbDouble();
});

const { acceptImport } = await import("./catalog-import/accept");

beforeEach(limpiarEstado);

describe("accept — qué filas crea (spec 0090 §6)", () => {
  /** ORACULO DE M5. */
  it("un producto AMBIGUO nace con `unitPrice` null, NUNCA con 0", async () => {
    const draft = {
      version: 1,
      categories: [
        {
          draftId: "c1",
          name: "Bebidas",
          resolution: { kind: "create" },
          duplicateCandidate: null,
          products: [
            producto(),
            producto({
              draftId: "p2",
              name: "Té",
              priceStatus: "ambiguous",
              unitPrice: null,
            }),
          ],
        },
      ],
      warnings: [],
    };
    estado.filas = cola(fila(draft));
    const outcome = await acceptImport(NEGOCIO, IMPORT_ID, null);
    const creados = filasDe(products);
    expect(creados).toHaveLength(2);
    const te = creados.find((row) => row.name === "Té");
    expect(te?.unitPrice).toBeNull();
    expect(te?.unitPrice).not.toBe("0.00");
    expect(te?.unitPrice).not.toBe(0);
    // Y el resumen lo cuenta: es lo que reemplaza al bloqueo.
    expect(outcome.result).toEqual({
      importId: IMPORT_ID,
      categoriesCreated: 1,
      productsCreated: 2,
      productsWithoutPrice: 1,
    });
    expect(outcome.created).toBe(true);
  });

  it("los productos nacen sin coste, sin imagen y en TODOS los locales", async () => {
    const draft = {
      version: 1,
      categories: [
        {
          draftId: "c1",
          name: "Bebidas",
          resolution: { kind: "create" },
          duplicateCandidate: null,
          products: [producto()],
        },
      ],
      warnings: [],
    };
    estado.filas = cola(fila(draft));
    await acceptImport(NEGOCIO, IMPORT_ID, null);
    expect(filasDe(products)[0]).toEqual({
      businessId: NEGOCIO.id,
      categoryId: "cat-nueva-0",
      name: "Café",
      unitPrice: "3.50",
      unitCost: null,
      availableAllLocations: true,
    });
    // CERO filas `product_location`: la tabla ni se toca.
    expect(estado.inserts.map((insert) => insert.tabla)).toEqual([
      productCategories,
      products,
    ]);
  });

  it("`use_existing` NO crea categoría y `uncategorized` deja el producto sin ella", async () => {
    const draft = {
      version: 1,
      categories: [
        {
          draftId: "c1",
          name: "Bebidas",
          resolution: { kind: "use_existing", categoryId: CAT_EXISTENTE },
          duplicateCandidate: null,
          products: [producto()],
        },
        {
          draftId: "c2",
          name: "Sueltos",
          resolution: { kind: "uncategorized" },
          duplicateCandidate: null,
          products: [producto({ draftId: "p2", name: "Agua" })],
        },
      ],
      warnings: [],
    };
    estado.filas = cola(fila(draft), 0);
    const outcome = await acceptImport(NEGOCIO, IMPORT_ID, null);
    expect(outcome.result.categoriesCreated).toBe(0);
    expect(filasDe(products).map((row) => row.categoryId)).toEqual([
      CAT_EXISTENTE,
      null,
    ]);
  });

  it("`discard` con un producto incluido es 409 `unresolved_catalog_import`", async () => {
    const draft = {
      version: 1,
      categories: [
        {
          draftId: "c1",
          name: "Bebidas",
          resolution: { kind: "discard" },
          duplicateCandidate: null,
          products: [producto()],
        },
      ],
      warnings: [],
    };
    estado.filas = cola(fila(draft), 0);
    await expect(acceptImport(NEGOCIO, IMPORT_ID, null)).rejects.toMatchObject({
      status: 409,
      code: "unresolved_catalog_import",
    });
    expect(estado.inserts).toHaveLength(0);
  });

  it("`discard` con todo `include:false` sí acepta, y no crea nada de esa categoría", async () => {
    const draft = {
      version: 1,
      categories: [
        {
          draftId: "c1",
          name: "Bebidas",
          resolution: { kind: "discard" },
          duplicateCandidate: null,
          products: [producto({ include: false })],
        },
      ],
      warnings: [],
    };
    estado.filas = cola(fila(draft), 0);
    const outcome = await acceptImport(NEGOCIO, IMPORT_ID, null);
    expect(outcome.result).toMatchObject({
      categoriesCreated: 0,
      productsCreated: 0,
    });
  });

  it("un 23505 de categoría es 409 `catalog_import_conflict`, no un 500", async () => {
    estado.chocaLaCategoria = true;
    const draft = {
      version: 1,
      categories: [
        {
          draftId: "c1",
          name: "Bebidas",
          resolution: { kind: "create" },
          duplicateCandidate: null,
          products: [producto()],
        },
      ],
      warnings: [],
    };
    estado.filas = cola(fila(draft));
    await expect(acceptImport(NEGOCIO, IMPORT_ID, null)).rejects.toMatchObject({
      status: 409,
      code: "catalog_import_conflict",
    });
  });
});
