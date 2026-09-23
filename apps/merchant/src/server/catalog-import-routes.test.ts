import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0090 §6 / contrato §4 — **LA ALLOW-LIST, PINNEADA SOBRE LA RESPUESTA DE LA RUTA.**
 *
 * `catalog-import-contract.test.ts` la pinnea sobre `toImportDTO(fila)`, que es la funcion.
 * Eso deja afuera lo unico que ve la pantalla: **que la ruta la LLAME.** Medido en la
 * revision de la 0090: reemplazar `toImportDTO(row)` por la fila cruda en
 * `api/catalog/imports/route.ts` dejaba **1701 tests en verde**, y por contrato §1.bis ese
 * `GET` es la PRIMERA llamada que hace la pantalla. Con la 0091 la fuga es peor: la columna
 * `draft` guarda **la extraccion cruda del modelo**, que no tiene que viajar nunca.
 *
 * La fila sembrada trae `providerJobId`, `providerRequestId` y los tokens **a proposito**: un
 * assert de claves sobre una fila que no los tiene no prueba nada.
 */
const NEGOCIO = "22222222-2222-4222-8222-222222222222";
const IMPORT_ID = "11111111-1111-4111-8111-111111111111";

const estado = {
  filas: [] as unknown[][],
  sets: [] as Record<string, unknown>[],
};

vi.mock("./db", async () => {
  const { dbDobleHonesto } = await import("./catalog-import-predicado");
  return dbDobleHonesto(estado);
});

vi.mock("./api-permission", () => ({
  requireApiPermission: async () => ({
    business: {
      id: NEGOCIO,
      slug: "negocio",
      countryCode: "EC",
      currencyCode: "USD",
      status: "active",
      suspensionReason: null,
    },
    userId: "u-1",
  }),
}));

const { GET: ACTIVO } = await import("../app/api/catalog/imports/route");
const { GET: POR_ID } = await import("../app/api/catalog/imports/[id]/route");

/** La fila **completa**, con todo lo interno que la tabla guarda. */
const FILA = {
  id: IMPORT_ID,
  businessId: NEGOCIO,
  createdByUserId: "u-secreto",
  status: "accepted",
  sourceKind: "images",
  fileCount: 3,
  pageCount: 3,
  draft: { categories: [{ name: "Menu crudo del proveedor" }] },
  provider: "openai",
  model: "gpt-x",
  promptVersion: "v1",
  schemaVersion: "v1",
  providerJobId: "resp_secreto",
  providerRequestId: "req_secreto",
  inputTokens: 1234,
  outputTokens: 567,
  durationMs: 8900,
  attemptCount: 1,
  leaseUntil: new Date("2026-09-22T11:00:00.000Z"),
  cancelRequestedAt: null,
  notifiedAt: null,
  acceptedSummary: {
    categoriesCreated: 12,
    categoriesReused: 2,
    productsCreated: 86,
    productsSkipped: 4,
    productsWithoutPrice: 3,
    discardedCount: 4,
    discarded: [{ text: "Milanesa ???", reason: "unreadable_name" }],
  },
  failureCode: null,
  failureDetail: "detalle interno del proveedor",
  createdAt: new Date("2026-09-22T10:00:00.000Z"),
  updatedAt: new Date("2026-09-22T10:00:00.000Z"),
  expiresAt: new Date("2026-09-23T10:00:00.000Z"),
  acceptedAt: null,
  cancelledAt: null,
  cleanedAt: null,
};

const CLAVES = [
  "error",
  "expiresAt",
  "fileCount",
  "id",
  "pageCount",
  "result",
  "sourceKind",
  "status",
];

const SECRETOS = [
  "Menu crudo del proveedor",
  "resp_secreto",
  "req_secreto",
  "u-secreto",
  "detalle interno del proveedor",
  "1234",
  "567",
  "8900",
  NEGOCIO,
  "openai",
  "gpt-x",
];

const pedido = (path: string) =>
  new NextRequest(`https://merchant.test${path}`, { method: "GET" });

beforeEach(() => {
  estado.filas = [];
  estado.sets = [];
});

describe("las rutas que serializan un import (contrato §4)", () => {
  it("`GET /api/catalog/imports` devuelve EXACTAMENTE las ocho claves", async () => {
    estado.filas = [[FILA]];
    const respuesta = await ACTIVO(pedido("/api/catalog/imports"));
    expect(respuesta.status).toBe(200);
    const cuerpo = await respuesta.json();
    expect(Object.keys(cuerpo.import).sort()).toEqual(CLAVES);
  });

  it("`GET /api/catalog/imports/{id}` devuelve EXACTAMENTE las ocho claves", async () => {
    estado.filas = [[FILA]];
    const respuesta = await POR_ID(
      pedido(`/api/catalog/imports/${IMPORT_ID}`),
      { params: Promise.resolve({ id: IMPORT_ID }) },
    );
    expect(respuesta.status).toBe(200);
    const cuerpo = await respuesta.json();
    expect(Object.keys(cuerpo.import).sort()).toEqual(CLAVES);
  });

  /** El assert de claves no alcanza solo: un campo interno podria colarse ANIDADO. */
  it("ninguna de las dos respuestas lleva ids del proveedor, tokens ni el negocio", async () => {
    estado.filas = [[FILA]];
    const activo = await (await ACTIVO(pedido("/api/catalog/imports"))).text();
    estado.filas = [[FILA]];
    const porId = await (
      await POR_ID(pedido(`/api/catalog/imports/${IMPORT_ID}`), {
        params: Promise.resolve({ id: IMPORT_ID }),
      })
    ).text();
    for (const secreto of SECRETOS) {
      expect(activo).not.toContain(secreto);
      expect(porId).not.toContain(secreto);
    }
  });

  it("sin ningún import, `GET /api/catalog/imports` devuelve `{ import: null }`", async () => {
    estado.filas = [[]];
    const cuerpo = await (await ACTIVO(pedido("/api/catalog/imports"))).json();
    expect(cuerpo).toEqual({ import: null });
  });

  /**
   * ORACULO DE ORQ-RM12 — **el TERCER hermano del aislamiento por negocio.**
   *
   * `activeImport` (`catalog-import/core.ts:76`) tiene su **propio** `eq(businessId)`, igual
   * que `requireImport` y que el `SELECT … FOR UPDATE` del `accept`. Los dos primeros ganaron
   * su oraculo al cerrar el FAIL de la revision; este quedo afuera del barrido, y borrar su
   * filtro dejaba **1718 tests en verde** (medido).
   *
   * Lo que se escapaba no es menor: `GET /api/catalog/imports` es —por contrato §1.bis— la
   * PRIMERA llamada que hace la pantalla, y devuelve el import **con su `draft`**. Sin el
   * filtro, un merchant abriendo el modal veria el menu de otro comercio.
   *
   * El caso de arriba (`estado.filas = [[]]`) **no** sirve de oraculo: mide «si la base no
   * devuelve filas, contestamos null», que es cierto con y sin filtro. Por eso este siembra
   * una fila que **existe y esta abierta**, cuyo unico defecto es el negocio — y lleva su
   * **control positivo** en el mismo vector, porque un rojo sin el no distingue «aislado» de
   * «roto».
   */
  it("el import de OTRO negocio no se devuelve (y el propio sí)", async () => {
    const ajena = {
      ...FILA,
      businessId: "33333333-3333-4333-8333-333333333333",
    };
    estado.filas = [[ajena]];
    const cuerpo = await (await ACTIVO(pedido("/api/catalog/imports"))).json();
    expect(cuerpo).toEqual({ import: null });

    // Control positivo: el MISMO vector, con el negocio del llamador, si lo devuelve.
    estado.filas = [[FILA]];
    const propio = await (await ACTIVO(pedido("/api/catalog/imports"))).json();
    expect(propio.import?.id).toBe(IMPORT_ID);
  });
});
