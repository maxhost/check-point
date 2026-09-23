import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  categoriasDe,
  cerrarImport,
  importIntegrationEnabled as enabled,
  leerImport,
  limpiarNegocio,
  productosDe,
  seedImport,
  seedNegocio,
  type SeedImport,
} from "./catalog-import-integration-support";
import { conCookie, cookieDe } from "./permissions-integration-support";

vi.mock("./r2", async () => {
  const real = await vi.importActual<typeof import("./r2")>("./r2");
  return { ...real, deleteObjectKeys: async () => undefined };
});

const { POST: ACEPTAR } =
  await import("../app/api/catalog/imports/[id]/accept/route");

/**
 * Spec 0090 §6 — EL `accept` CONTRA LA BASE: transaccion, idempotencia y el 23505.
 *
 * ORACULO DE M6: **dos POST seguidos dejan un solo set de filas y devuelven el mismo
 * resumen.** Si el chequeo de `accepted` bajo el lock desapareciera, el segundo POST
 * duplicaria el catalogo y las dos aserciones de abajo se ponen rojas.
 *
 * ORACULO DE M5 en su forma final: la fila de `core.product` de un ambiguo tiene
 * `unit_price` **NULL** leido por SQL, no por la respuesta de la API.
 */
const borrador = (categorias: Array<Record<string, unknown>>, version = 1) => ({
  version,
  categories: categorias,
  warnings: [],
});

const producto = (overrides: Record<string, unknown> = {}) => ({
  draftId: "p1",
  name: "Café importado",
  unitPrice: "3.50",
  priceStatus: "detected",
  sourceText: null,
  include: true,
  duplicateCandidate: null,
  ...overrides,
});

const categoria = (overrides: Record<string, unknown> = {}) => ({
  draftId: "c1",
  name: "Bebidas importadas",
  resolution: { kind: "create" },
  duplicateCandidate: null,
  products: [producto()],
  ...overrides,
});

describe.skipIf(!enabled)("accept contra Neon (spec 0090 §6)", () => {
  let a: SeedImport;
  let b: SeedImport;
  let cookie = "";

  beforeAll(async () => {
    a = await seedNegocio("Accept QA");
    b = await seedNegocio("Accept QA ajeno");
    cookie = await cookieDe(a.userId);
  });

  afterAll(async () => {
    await limpiarNegocio(a);
    await limpiarNegocio(b);
  });

  const aceptar = (id: string, body?: unknown) =>
    ACEPTAR(
      conCookie(`/api/catalog/imports/${id}/accept`, "POST", cookie, body),
      { params: Promise.resolve({ id }) },
    );

  /** ORACULO DE M6 **y** de M5. */
  it("dos POST seguidos: un solo set de filas y el mismo resumen", async () => {
    const id = await seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "ready",
      draft: borrador([
        categoria({
          products: [
            producto(),
            producto({
              draftId: "p2",
              name: "Té importado",
              priceStatus: "ambiguous",
              unitPrice: null,
            }),
          ],
        }),
      ]),
    });

    const primero = await aceptar(id);
    expect(primero.status).toBe(201);
    const resultado = (await primero.json()).result;
    expect(resultado).toMatchObject({
      importId: id,
      categoriesCreated: 1,
      productsCreated: 2,
      productsWithoutPrice: 1,
    });

    const segundo = await aceptar(id);
    expect(segundo.status).toBe(200);
    expect((await segundo.json()).result).toEqual(resultado);

    // El oráculo real: las FILAS, leídas por SQL.
    const creados = await productosDe(a.businessId);
    expect(creados).toHaveLength(2);
    expect(await categoriasDe(a.businessId)).toHaveLength(1);

    // M5 en la base: el ambiguo tiene `unit_price` NULL, no `0.00`.
    const te = creados.find((row) => row.name === "Té importado");
    expect(te?.unitPrice).toBeNull();
    const cafe = creados.find((row) => row.name === "Café importado");
    expect(cafe?.unitPrice).toBe("3.50");
    expect(cafe?.unitCost).toBeNull();

    const fila = await leerImport(id);
    expect(fila?.status).toBe("accepted");
    expect(fila?.acceptedAt).not.toBeNull();
  });

  it("una categoría que ya existe en el catálogo es 409 y NO crea productos sueltos", async () => {
    // La categoría quedó creada por el caso anterior: repetirla choca con
    // `core_product_category_name_unique`.
    const id = await seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "ready",
      draft: borrador([
        categoria({
          draftId: "c9",
          name: "bebidas importadas",
          products: [producto({ draftId: "p9", name: "Producto fantasma" })],
        }),
      ]),
    });
    const antes = await productosDe(a.businessId);
    const respuesta = await aceptar(id);
    expect(respuesta.status).toBe(409);
    expect((await respuesta.json()).code).toBe("catalog_import_conflict");
    // TODO O NADA: ni el producto ni la categoría quedaron.
    expect(await productosDe(a.businessId)).toHaveLength(antes.length);
    expect(
      (await productosDe(a.businessId)).some(
        (row) => row.name === "Producto fantasma",
      ),
    ).toBe(false);
    expect((await leerImport(id))?.status).toBe("ready");
    await cerrarImport(id);
  });

  it("un producto colgado de una categoría descartada es 409 y no escribe nada", async () => {
    const id = await seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "ready",
      draft: borrador([
        categoria({
          draftId: "c8",
          name: "Descartada",
          resolution: { kind: "discard" },
          products: [producto({ draftId: "p8", name: "Colgado" })],
        }),
      ]),
    });
    const antes = await productosDe(a.businessId);
    const respuesta = await aceptar(id);
    expect(respuesta.status).toBe(409);
    expect((await respuesta.json()).code).toBe("unresolved_catalog_import");
    expect(await productosDe(a.businessId)).toHaveLength(antes.length);
    await cerrarImport(id);
  });

  /**
   * ORACULO DE RM4 contra la base — el `eq(businessId)` del `SELECT … FOR UPDATE`
   * (`accept.ts:43`). **Es la ruta que ESCRIBE y NO pasa por `requireImport`.**
   *
   * Sin ese filtro, `acceptImport` seguiria con el `business.id` del ATACANTE en
   * `revalidate` y `createCatalog` (`accept.ts:72-74`): el menu de la victima se
   * materializaria como catalogo del atacante. Por eso las aserciones no miran solo el
   * `404`, miran **las filas de las DOS tablas de los DOS negocios**.
   */
  it("un import de OTRO negocio es 404 y no mueve el catálogo de nadie", async () => {
    const ajeno = await seedImport({
      businessId: b.businessId,
      userId: b.userId,
      status: "ready",
      draft: borrador([
        categoria({
          draftId: "cx",
          name: "Menú de la víctima",
          products: [producto({ draftId: "px", name: "Plato de la víctima" })],
        }),
      ]),
    });
    const antesA = await productosDe(a.businessId);
    const respuesta = await aceptar(ajeno);
    expect(respuesta.status).toBe(404);
    expect((await respuesta.json()).code).toBe("catalog_import_not_found");
    // Ni el catálogo del atacante ni el de la víctima se movieron.
    expect(await productosDe(a.businessId)).toHaveLength(antesA.length);
    expect(await productosDe(b.businessId)).toHaveLength(0);
    expect(await categoriasDe(b.businessId)).toHaveLength(0);
    expect((await leerImport(ajeno))?.status).toBe("ready");
    await cerrarImport(ajeno);
  });

  /** CONTROL POSITIVO del mismo vector: el MISMO borrador, sembrado en el negocio del
   * llamador, SÍ se acepta. Sin esto un rojo no distingue «aislado» de «roto». */
  it("control positivo: el mismo borrador, en el negocio del llamador, se acepta", async () => {
    const propio = await seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "ready",
      draft: borrador([
        categoria({
          draftId: "cx",
          name: "Menú del llamador",
          products: [producto({ draftId: "px", name: "Plato del llamador" })],
        }),
      ]),
    });
    const respuesta = await aceptar(propio);
    expect(respuesta.status).toBe(201);
    expect(
      (await productosDe(a.businessId)).some(
        (row) => row.name === "Plato del llamador",
      ),
    ).toBe(true);
  });

  it("`version` vieja es 409 `catalog_import_version` y el borrador queda intacto", async () => {
    const id = await seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "ready",
      draft: borrador([categoria({ draftId: "c7", name: "Otra" })], 3),
      draftVersion: 3,
    });
    const respuesta = await aceptar(id, { version: 2 });
    expect(respuesta.status).toBe(409);
    expect((await respuesta.json()).code).toBe("catalog_import_version");
    expect((await leerImport(id))?.status).toBe("ready");
    await cerrarImport(id);
  });
});
