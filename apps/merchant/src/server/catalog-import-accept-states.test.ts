import { describe, expect, it, vi, beforeEach } from "vitest";
import { CatalogImportError } from "./catalog-import/types";
import {
  CAT_EXISTENTE,
  IMPORT_ID,
  NEGOCIO,
  cola,
  estado,
  fila,
  limpiarEstado,
} from "./catalog-import-accept-double";

/**
 * Spec 0090 §6 — LA IDEMPOTENCIA DEL `accept` y sus estados, con la misma transaccion
 * doblada que `catalog-import-accept.test.ts` (aparte por el hook `file-size`).
 *
 * ORACULO DE M6 en su parte pura: **con el import ya `accepted` no se inserta una sola fila**
 * y se devuelve el resumen guardado. La idempotencia la da el lock mas el estado, no una
 * clave del cliente.
 */
vi.mock("./db", async () => {
  const { dbDouble } = await import("./catalog-import-accept-double");
  return dbDouble();
});

const { acceptImport } = await import("./catalog-import/accept");

beforeEach(limpiarEstado);

describe("accept — idempotencia y estados (spec 0090 §6)", () => {
  /**
   * ORACULO DE M6 en su parte pura.
   *
   * **La fila `accepted` conserva su borrador**, y eso no es decoracion: asi es como queda en
   * la base (el `accept` escribe `status` y `accepted_summary`, y **no borra `draft`**). Con
   * un `draft: null` el rojo de la mutacion salia por otro lado —un 422 de revalidacion— y
   * no probaba la propiedad. Medido: con la fila realista, sacar el chequeo de `accepted`
   * hace que el codigo VUELVA A CREAR las filas y falla la asercion de abajo.
   */
  it("si ya está `accepted`, devuelve el MISMO resumen y no inserta nada", async () => {
    const guardado = {
      importId: IMPORT_ID,
      categoriesCreated: 2,
      productsCreated: 18,
      productsWithoutPrice: 3,
    };
    const draftVivo = {
      version: 1,
      categories: [
        {
          draftId: "c1",
          name: "Bebidas",
          resolution: { kind: "create" },
          duplicateCandidate: null,
          products: [
            {
              draftId: "p1",
              name: "Café",
              unitPrice: "3.50",
              priceStatus: "detected",
              sourceText: null,
              include: true,
              duplicateCandidate: null,
            },
          ],
        },
      ],
      warnings: [],
    };
    estado.filas = cola(
      fila(draftVivo, { status: "accepted", acceptedSummary: guardado }),
    );
    const outcome = await acceptImport(NEGOCIO, IMPORT_ID, null);
    expect(outcome).toEqual({ created: false, result: guardado });
    expect(estado.inserts).toHaveLength(0);
    expect(estado.sets).toHaveLength(0);
  });

  it("un import que no está `ready` es 409 `catalog_import_state`", async () => {
    estado.filas = [[fila(null, { status: "queued" })]];
    await expect(acceptImport(NEGOCIO, IMPORT_ID, null)).rejects.toMatchObject({
      status: 409,
      code: "catalog_import_state",
    });
  });

  it("`version` es OPCIONAL: sin cuerpo acepta; con una vieja es 409", async () => {
    const draft = { version: 1, categories: [], warnings: [] };
    estado.filas = cola(fila(draft), 0);
    await expect(acceptImport(NEGOCIO, IMPORT_ID, {})).resolves.toMatchObject({
      created: true,
    });
    estado.filas = [[fila(draft)], [{ id: CAT_EXISTENTE }]];
    await expect(
      acceptImport(NEGOCIO, IMPORT_ID, { version: 99 }),
    ).rejects.toMatchObject({
      status: 409,
      code: "catalog_import_version",
    });
  });

  /**
   * ORACULO DE RM4 — el `eq(businessId)` del `SELECT … FOR UPDATE` (`accept.ts:43`).
   *
   * **Es la ruta que ESCRIBE, y no pasa por `requireImport`**: tiene su propio filtro. Si se
   * cayera, `acceptImport` seguiria adelante con el `business.id` del ATACANTE en
   * `revalidate` y `createCatalog` (`accept.ts:72-74`) y el menu de la victima se
   * materializaria como catalogo del atacante.
   *
   * La fila sembrada esta **`ready` y es aceptable**: lo unico que la descalifica es el
   * negocio. El control positivo de abajo, con la MISMA fila y el negocio del llamador,
   * prueba que el rojo habla del filtro.
   */
  const OTRO_NEGOCIO = { id: "44444444-4444-4444-8444-444444444444" };
  const draftAjeno = {
    version: 1,
    categories: [
      {
        draftId: "c1",
        name: "Bebidas",
        resolution: { kind: "create" },
        duplicateCandidate: null,
        products: [
          {
            draftId: "p1",
            name: "Café",
            unitPrice: "3.50",
            priceStatus: "detected",
            sourceText: null,
            include: true,
            duplicateCandidate: null,
          },
        ],
      },
    ],
    warnings: [],
  };

  it("un import de OTRO negocio es 404 y NO crea una sola fila de catálogo", async () => {
    estado.filas = cola(fila(draftAjeno, { businessId: OTRO_NEGOCIO.id }));
    await expect(acceptImport(NEGOCIO, IMPORT_ID, null)).rejects.toMatchObject({
      status: 404,
      code: "catalog_import_not_found",
    });
    expect(estado.inserts).toHaveLength(0);
    expect(estado.sets).toHaveLength(0);
  });

  it("control positivo: LA MISMA fila, con el negocio del llamador, crea el catálogo", async () => {
    estado.filas = cola(fila(draftAjeno, { businessId: NEGOCIO.id }));
    const outcome = await acceptImport(NEGOCIO, IMPORT_ID, null);
    expect(outcome.created).toBe(true);
    expect(outcome.result.productsCreated).toBe(1);
  });

  it("un id que no es uuid devuelve el 404 indistinguible, sin abrir transacción", async () => {
    await expect(
      acceptImport(NEGOCIO, "no-soy-uuid", null),
    ).rejects.toBeInstanceOf(CatalogImportError);
    expect(estado.filas).toHaveLength(0);
    expect(estado.inserts).toHaveLength(0);
  });
});
