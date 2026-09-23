import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  CATALOG_IMPORT_OPEN_STATUSES,
  CATALOG_IMPORT_STATUSES,
  CATALOG_IMPORT_TERMINAL_STATUSES,
} from "./schema/catalog-import";

/**
 * Spec 0090 §1 — LA MAQUINA DE ESTADOS, medida por COMPORTAMIENTO y no por una copia de la
 * tabla de la spec.
 *
 * Las dos propiedades que la spec pone como DoD:
 *
 * - **ningun estado queda sin salida** — cada no terminal tiene una transicion que lo mueve;
 * - **los terminales no retroceden** — ni `analyze` ni `DELETE` los reabren.
 *
 * Y las dos idempotencias: repetir `analyze` en `queued|analyzing|ready` **no** dispara otra
 * llamada al proveedor, y repetir `DELETE` da 200.
 */
const estado = {
  filas: [] as unknown[][],
  sets: [] as Record<string, unknown>[],
};

/**
 * El doble **evalua el `where`** (`catalog-import-predicado.ts`). Antes lo descartaba, y esa
 * era la razon por la que «un import de OTRO negocio da 404» pasaba con y sin el filtro.
 */
vi.mock("./db", async () => {
  const { dbDobleHonesto } = await import("./catalog-import-predicado");
  return dbDobleHonesto(estado);
});

/** El objeto de R2 con una cabecera JPEG real: el sniff por bytes es parte del camino. */
vi.mock("./r2", async () => {
  const real = await vi.importActual<typeof import("./r2")>("./r2");
  return {
    ...real,
    getPrivateObject: async () => ({
      Body: (async function* () {
        yield new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      })(),
    }),
    deleteObjectKeys: async () => undefined,
    createTemporaryUploadUrl: async (input: { objectKey: string }) =>
      `https://r2.fake/${input.objectKey}?firmada=1`,
  };
});

const { cancelImport, createImport } = await import("./catalog-import/core");
const { startAnalyze } = await import("./catalog-import/analyze");

const IMPORT_ID = "11111111-1111-4111-8111-111111111111";
const NEGOCIO = { id: "22222222-2222-4222-8222-222222222222" };
const OTRO_NEGOCIO = { id: "44444444-4444-4444-8444-444444444444" };

const fila = (status: string, overrides: Record<string, unknown> = {}) => ({
  id: IMPORT_ID,
  businessId: NEGOCIO.id,
  status,
  sourceKind: "images",
  fileCount: 1,
  pageCount: null,
  draft: null,
  draftVersion: 0,
  cancelRequestedAt: null,
  failureCode: null,
  failureDetail: null,
  expiresAt: new Date("2026-09-23T10:00:00.000Z"),
  createdAt: new Date("2026-09-22T10:00:00.000Z"),
  ...overrides,
});

const archivo = {
  id: "f-1",
  importId: IMPORT_ID,
  businessId: NEGOCIO.id,
  position: 0,
  objectKey: "catalog-imports/b/i/f",
  declaredContentType: "image/jpeg",
  byteSize: 100,
  status: "reserved",
};

beforeEach(() => {
  estado.filas = [];
  estado.sets = [];
});

describe("el conjunto de estados (spec 0090 §1)", () => {
  it("son ocho, y abiertos + terminales lo cubren sin superponerse", () => {
    expect([...CATALOG_IMPORT_STATUSES].sort()).toEqual([
      "accepted",
      "analyzing",
      "cancelled",
      "expired",
      "failed",
      "pending_upload",
      "queued",
      "ready",
    ]);
    const abiertos = new Set<string>(CATALOG_IMPORT_OPEN_STATUSES);
    const terminales = new Set<string>(CATALOG_IMPORT_TERMINAL_STATUSES);
    expect(abiertos.size + terminales.size).toBe(
      CATALOG_IMPORT_STATUSES.length,
    );
    for (const status of CATALOG_IMPORT_STATUSES) {
      expect(abiertos.has(status) !== terminales.has(status)).toBe(true);
    }
  });
});

describe("cancelar (spec 0090 §1 / contrato §7)", () => {
  for (const status of ["pending_upload", "queued", "ready"] as const) {
    it(`desde \`${status}\` pasa a cancelled`, async () => {
      estado.filas = [[fila(status)], [fila("cancelled")]];
      const outcome = await cancelImport(NEGOCIO, IMPORT_ID);
      expect(outcome.import.status).toBe("cancelled");
      expect(estado.sets[0]).toMatchObject({ status: "cancelled" });
    });
  }

  /** La cancelacion durante `analyzing` es EXPLICITA: deja el estado y marca la intencion.
   * El callback o el reconciliador descartan el resultado cuando llegue. */
  it("desde `analyzing` escribe `cancel_requested_at` y NO cambia el estado", async () => {
    estado.filas = [[fila("analyzing")], [fila("analyzing")]];
    const outcome = await cancelImport(NEGOCIO, IMPORT_ID);
    expect(outcome.import.status).toBe("analyzing");
    expect(estado.sets[0]).toHaveProperty("cancelRequestedAt");
    expect(estado.sets[0]).not.toHaveProperty("status");
  });

  it("repetirlo sobre un terminal da 200 y no escribe nada — idempotente", async () => {
    for (const status of ["cancelled", "failed", "expired"] as const) {
      estado.filas = [[fila(status)]];
      estado.sets = [];
      const outcome = await cancelImport(NEGOCIO, IMPORT_ID);
      expect(outcome.import.status).toBe(status);
      expect(estado.sets).toHaveLength(0);
    }
  });

  it("`accepted` responde 409 y nunca toca catálogo", async () => {
    estado.filas = [[fila("accepted")]];
    await expect(cancelImport(NEGOCIO, IMPORT_ID)).rejects.toMatchObject({
      status: 409,
      code: "catalog_import_already_accepted",
    });
    expect(estado.sets).toHaveLength(0);
  });

  /**
   * ORACULO DE RM3 — el `eq(businessId)` de `requireImport` (`core.ts:97`).
   *
   * La fila **existe en la base** y es cancelable; lo unico que la descalifica es el negocio.
   * Si el filtro se cayera, el doble la devolveria y el `cancelImport` del atacante
   * cancelaria el import de la victima. El control positivo del mismo vector —la misma fila,
   * con el `businessId` del llamador— prueba que el rojo habla del filtro y no de un seed
   * que no llega a la base.
   */
  it("un import de OTRO negocio devuelve el mismo 404 que uno inexistente", async () => {
    estado.filas = [[fila("ready", { businessId: OTRO_NEGOCIO.id })]];
    await expect(cancelImport(NEGOCIO, IMPORT_ID)).rejects.toMatchObject({
      status: 404,
      code: "catalog_import_not_found",
    });
    expect(estado.sets).toHaveLength(0);
  });

  it("control positivo: LA MISMA fila, con el negocio del llamador, SÍ se cancela", async () => {
    estado.filas = [
      [fila("ready", { businessId: NEGOCIO.id })],
      [fila("cancelled")],
    ];
    const outcome = await cancelImport(NEGOCIO, IMPORT_ID);
    expect(outcome.import.status).toBe("cancelled");
  });
});

describe("analizar (spec 0090 §6 / contrato §3)", () => {
  it("desde `pending_upload` confirma los uploads y encola", async () => {
    estado.filas = [[fila("pending_upload")], [archivo], [], [fila("queued")]];
    const outcome = await startAnalyze(NEGOCIO, IMPORT_ID);
    expect(outcome.queued).toBe(true);
    expect(outcome.import.status).toBe("queued");
    expect(estado.sets).toContainEqual(
      expect.objectContaining({ status: "uploaded" }),
    );
  });

  it("repetirlo en `queued`/`analyzing`/`ready` NO vuelve a encolar", async () => {
    for (const status of ["queued", "analyzing", "ready"] as const) {
      estado.filas = [[fila(status)]];
      estado.sets = [];
      const outcome = await startAnalyze(NEGOCIO, IMPORT_ID);
      expect(outcome).toMatchObject({ queued: false });
      expect(outcome.import.status).toBe(status);
      // Cero escrituras: un reintento de red no cuesta plata ni duplica trabajo.
      expect(estado.sets).toHaveLength(0);
    }
  });

  /** **LOS TERMINALES NO RETROCEDEN.** */
  it("desde cualquier terminal responde 409 y no escribe", async () => {
    for (const status of CATALOG_IMPORT_TERMINAL_STATUSES) {
      estado.filas = [[fila(status)]];
      estado.sets = [];
      await expect(startAnalyze(NEGOCIO, IMPORT_ID)).rejects.toMatchObject({
        status: 409,
        code: "catalog_import_state",
      });
      expect(estado.sets).toHaveLength(0);
    }
  });

  it("un archivo cuyos BYTES no son lo declarado es 422 `unsupported_catalog_file`", async () => {
    // El import declaró `pdf` y en R2 hay un JPEG: el sniff lo caza antes del proveedor.
    estado.filas = [[fila("pending_upload", { sourceKind: "pdf" })], [archivo]];
    await expect(startAnalyze(NEGOCIO, IMPORT_ID)).rejects.toMatchObject({
      status: 422,
      code: "unsupported_catalog_file",
    });
  });

  it("si falta un archivo reservado es 413, no un 500", async () => {
    estado.filas = [[fila("pending_upload", { fileCount: 2 })], [archivo]];
    await expect(startAnalyze(NEGOCIO, IMPORT_ID)).rejects.toMatchObject({
      status: 413,
      code: "catalog_import_too_large",
    });
  });
});

describe("reservar un import nuevo (spec 0090 §6 / ADR 0082 §13.2)", () => {
  const archivos = {
    files: [{ name: "menu.jpg", contentType: "image/jpeg", byteSize: 1000 }],
  };

  it("sin nada abierto, reserva y devuelve un ticket por archivo", async () => {
    estado.filas = [
      [],
      [],
      [{ total: 0 }],
      [{ total: 0 }],
      [fila("pending_upload")],
      [],
    ];
    const creado = await createImport(NEGOCIO, "u-1", archivos);
    expect(creado.import.status).toBe("pending_upload");
    expect(creado.uploads).toHaveLength(1);
  });

  it("con submits aceptados agotados responde 429 ANTES de reservar o firmar", async () => {
    estado.filas = [[], [], [{ total: 0 }], [{ total: 3 }]];
    await expect(createImport(NEGOCIO, "u-1", archivos)).rejects.toMatchObject({
      status: 429,
      code: "catalog_import_rate_limited",
      retryAfterSeconds: expect.any(Number),
    });
    expect(estado.sets).toHaveLength(0);
  });

  /**
   * ORACULO DE M9, en su mitad medible sin base: **un `ready` abierto NO se apropia**.
   * La otra mitad —que el borrador sigue existiendo despues del 409— la mide
   * `catalog-import.neon.integration.test.ts`, porque exige releer la fila.
   */
  it("con uno en `ready` abierto responde 409 y NO escribe nada", async () => {
    // La cola va COMPLETA a proposito: si se lo apropiara, el camino tendria con que
    // terminar y el rojo hablaria de la propiedad (resuelve en vez de rechazar) y no de
    // haberse quedado sin filas.
    estado.filas = [
      [fila("ready", { draft: { version: 1 } })],
      [],
      [{ total: 0 }],
      [],
      [],
      [],
      [fila("pending_upload")],
      [],
    ];
    await expect(createImport(NEGOCIO, "u-1", archivos)).rejects.toMatchObject({
      status: 409,
      code: "catalog_import_in_progress",
    });
    // Si se lo apropiara, acá habria un `set({status:'cancelled'})`.
    expect(estado.sets).toHaveLength(0);
  });

  it("con uno en `pending_upload` abierto SÍ se lo apropia y lo cancela", async () => {
    // La cola, en orden: activo → suscripcion → cupo de analisis → cupo de submits
    // → apropiacion/limpieza → INSERT del import nuevo → INSERT de sus archivos.
    estado.filas = [
      [fila("pending_upload")],
      [],
      [{ total: 0 }],
      [{ total: 0 }],
      [],
      [],
      [],
      [fila("pending_upload")],
      [],
    ];
    const creado = await createImport(NEGOCIO, "u-1", archivos);
    expect(creado.import.status).toBe("pending_upload");
    expect(estado.sets[0]).toMatchObject({ status: "cancelled" });
  });
});
