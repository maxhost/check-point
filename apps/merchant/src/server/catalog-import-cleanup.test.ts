import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0090 §7 — **LA LIMPIEZA DE LOS ORIGINALES**, que es la DoD «Originales borrados al
 * aceptar, cancelar y expirar; el cleanup reintenta sin tocar catalogo».
 *
 * `cleanup.ts` se entrego con CERO tests (hallazgo H4 de la revision). Lo que se mide aca:
 * encolar, purgar, que **repetir es no-op**, que un fallo de R2 deja el trabajo en la cola
 * con backoff, y —lo que mas plata cuesta si se rompe— **el predicado de vencimiento**.
 *
 * El doble de `./db` **evalua el `where`** (`catalog-import-predicado.ts`): sin eso, ni el
 * `ne(status,'deleted')` del no-op ni el `lte(expiresAt, now)` del vencimiento tendrian
 * oraculo. Lo que queda afuera y va a la suite de Neon: que Postgres aplique el `ON CONFLICT
 * DO NOTHING` del unico de `object_key`.
 */
const estado = {
  filas: [] as unknown[][],
  sets: [] as Record<string, unknown>[],
};

const r2 = {
  borrados: [] as string[][],
  falla: false,
};

vi.mock("./db", async () => {
  const { dbDobleHonesto } = await import("./catalog-import-predicado");
  return dbDobleHonesto(estado);
});

vi.mock("./r2", async () => {
  const real = await vi.importActual<typeof import("./r2")>("./r2");
  return {
    ...real,
    deleteObjectKeys: async (keys: string[]) => {
      if (r2.falla) throw new Error("R2 caido");
      r2.borrados.push(keys);
    },
  };
});

const {
  cleanupExpiredCatalogImports,
  drainCleanupQueue,
  enqueueImportCleanup,
  purgeImportObjects,
} = await import("./catalog-import/cleanup");

const NEGOCIO = "22222222-2222-4222-8222-222222222222";
const OTRO_NEGOCIO = "44444444-4444-4444-8444-444444444444";
const IMPORT_ID = "11111111-1111-4111-8111-111111111111";
const IMPORT_AJENO = "55555555-5555-4555-8555-555555555555";
const CLAVE = "catalog-imports/negocio/import/0.jpg";

const archivo = (overrides: Record<string, unknown> = {}) => ({
  id: "f-1",
  importId: IMPORT_ID,
  businessId: NEGOCIO,
  objectKey: CLAVE,
  status: "uploaded",
  ...overrides,
});

const importAbierto = (overrides: Record<string, unknown> = {}) => ({
  id: IMPORT_ID,
  businessId: NEGOCIO,
  status: "ready",
  // Vencido de sobra: la corrida diaria usa `new Date()` y no toma un `now` inyectable, asi
  // que el vector se hace INDEPENDIENTE del reloj en vez de fingirlo.
  expiresAt: new Date("2020-01-01T00:00:00.000Z"),
  ...overrides,
});

beforeEach(() => {
  estado.filas = [];
  estado.sets = [];
  r2.borrados = [];
  r2.falla = false;
});

describe("encolar el borrado de los originales (spec 0090 §7)", () => {
  it("encola un trabajo por archivo VIVO del import", async () => {
    estado.filas = [
      [archivo(), archivo({ id: "f-2", objectKey: `${CLAVE}2` })],
    ];
    expect(await enqueueImportCleanup(IMPORT_ID, NEGOCIO)).toBe(2);
  });

  /** El `ne(status,'deleted')` del `where`, evaluado: un archivo ya borrado no se reencola. */
  it("un archivo ya `deleted` no se encola de nuevo", async () => {
    estado.filas = [[archivo({ status: "deleted" })]];
    expect(await enqueueImportCleanup(IMPORT_ID, NEGOCIO)).toBe(0);
  });
});

describe("purgar los originales ahora (spec 0090 §7)", () => {
  it("borra el original, lo marca `deleted` y marca el import como limpio", async () => {
    estado.filas = [[archivo()]];
    const resultado = await purgeImportObjects(IMPORT_ID, NEGOCIO);
    expect(resultado).toEqual({ deleted: 1, pending: 0 });
    expect(r2.borrados).toEqual([[CLAVE]]);
    // Es lo que hace honesto al caso de abajo: el estado `deleted` lo escribe ESTE codigo.
    expect(estado.sets[0]).toMatchObject({ status: "deleted" });
    expect(estado.sets.at(-1)).toHaveProperty("cleanedAt");
  });

  /**
   * **REPETIR ES NO-OP.** La fila se siembra como la dejo la corrida anterior —`deleted`, que
   * es el valor que el `set` de arriba escribio— y el `ne(status,'deleted')` del `where`,
   * evaluado de verdad, la deja afuera: ni una llamada mas a R2.
   */
  it("repetirlo es no-op: ni un borrado mas contra R2", async () => {
    estado.filas = [[archivo({ status: "deleted" })]];
    const resultado = await purgeImportObjects(IMPORT_ID, NEGOCIO);
    expect(resultado).toEqual({ deleted: 0, pending: 0 });
    expect(r2.borrados).toEqual([]);
  });

  it("si R2 falla, el trabajo queda pendiente y el import NO queda limpio", async () => {
    r2.falla = true;
    estado.filas = [[archivo()]];
    const resultado = await purgeImportObjects(IMPORT_ID, NEGOCIO);
    expect(resultado).toEqual({ deleted: 0, pending: 1 });
    expect(estado.sets.some((set) => "cleanedAt" in set)).toBe(false);
  });
});

describe("reintentar la cola (spec 0090 §7)", () => {
  const trabajo = {
    id: "job-1",
    businessId: NEGOCIO,
    objectKey: CLAVE,
    attemptCount: 0,
    notBefore: new Date("2026-09-22T08:00:00.000Z"),
  };

  it("borra lo pendiente y saca el trabajo de la cola", async () => {
    estado.filas = [[trabajo]];
    expect(await drainCleanupQueue(new Date("2026-09-22T10:00:00.000Z"))).toBe(
      1,
    );
    expect(r2.borrados).toEqual([[CLAVE]]);
  });

  /** El `lte(notBefore, now)`: un trabajo reprogramado para más tarde no se toca. */
  it("un trabajo con `not_before` en el futuro no se intenta", async () => {
    estado.filas = [
      [{ ...trabajo, notBefore: new Date("2026-09-22T23:00:00.000Z") }],
    ];
    expect(await drainCleanupQueue(new Date("2026-09-22T10:00:00.000Z"))).toBe(
      0,
    );
    expect(r2.borrados).toEqual([]);
  });

  it("un fallo reprograma con backoff y guarda el error, sin perder el trabajo", async () => {
    r2.falla = true;
    estado.filas = [[{ ...trabajo, attemptCount: 2 }]];
    await drainCleanupQueue(new Date("2026-09-22T10:00:00.000Z"));
    expect(estado.sets[0]).toMatchObject({
      attemptCount: 3,
      lastError: "R2 caido",
      // 2^3 = 8 minutos desde `now`.
      notBefore: new Date("2026-09-22T10:08:00.000Z"),
    });
  });
});

describe("la corrida diaria (spec 0090 §7)", () => {
  /**
   * ORACULO DEL `lte(catalogImports.expiresAt, now)` (`cleanup.ts:118`).
   *
   * Sin ese predicado, la corrida diaria vence **todos los imports abiertos de todos los
   * negocios** y les borra los originales: un merchant que esta revisando su borrador se
   * queda sin import y sin archivos. Por eso el vector trae un import ajeno **abierto y NO
   * vencido**, y las aserciones miran el conteo y las claves borradas.
   */
  it("vence SOLO los vencidos y borra SOLO sus originales", async () => {
    estado.filas = [
      [
        importAbierto(),
        importAbierto({
          id: IMPORT_AJENO,
          businessId: OTRO_NEGOCIO,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        }),
      ],
      [],
      [archivo()],
      [],
      [archivo()],
    ];
    const resultado = await cleanupExpiredCatalogImports();
    expect(resultado.expired).toBe(1);
    expect(r2.borrados).toEqual([[CLAVE]]);
    // UNA sola fila pasa a `expired`: el import ajeno y abierto sigue vivo.
    expect(estado.sets.filter((set) => set.status === "expired")).toHaveLength(
      1,
    );
  });

  it("sin nada vencido no escribe ni borra nada", async () => {
    estado.filas = [
      [importAbierto({ expiresAt: new Date("2099-01-01T00:00:00.000Z") })],
    ];
    const resultado = await cleanupExpiredCatalogImports();
    expect(resultado).toEqual({ expired: 0, purged: 0, retried: 0 });
    expect(estado.sets).toEqual([]);
    expect(r2.borrados).toEqual([]);
  });
});
