import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CatalogExtractionProvider } from "./catalog-import/types";

/**
 * Spec 0090 §8 — **EL TECHO DE SUBMITS AL PROVEEDOR, Y SU CABLEADO.**
 *
 * Son DOS oraculos y se mutan distinto, porque una regla correcta que nadie invoca
 * typecheckea, lintea y pasa su propio test:
 *
 * - **la REGLA** (`withinAttemptBudget`) ataca la condicion: conteo vs tope;
 * - **el CABLEADO** (`runAnalysis` la llama justo antes del `provider.start()`) se ataca borrando
 *   la llamada, y entonces los casos de abajo tienen que ponerse rojos.
 *
 * `MAX_ATTEMPTS` y este techo son distintos y complementarios: aquel acota los reintentos
 * **dentro de un import**, este acota el loop `cancelar → crear → analizar` **del negocio en
 * la ventana**.
 *
 * **Limite declarado:** lo que estos casos NO miden es *que filas cuenta* la consulta —el
 * predicado del `WHERE` de `usedInWindow`—, porque un doble de `./db` no evalua predicados.
 * Eso es la mutacion M8 y vive en `catalog-import-quota.neon.integration.test.ts`. Lo que sí
 * queda pinneado acá es la **decision** (conteo vs tope) y **que el camino de submit la
 * consulta**.
 */
const estado = {
  filas: [] as unknown[][],
  sets: [] as Record<string, unknown>[],
  submits: 0,
};

vi.mock("./db", () => {
  const nuevaCadena = () => {
    const cadena: Record<string, unknown> = {};
    for (const metodo of [
      "select",
      "from",
      "where",
      "limit",
      "orderBy",
      "insert",
      "values",
      "onConflictDoNothing",
      "delete",
      "update",
      "returning",
      "innerJoin",
    ]) {
      cadena[metodo] = () => cadena;
    }
    cadena.set = (valor: Record<string, unknown>) => {
      estado.sets.push(valor);
      return cadena;
    };
    cadena.then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(estado.filas.shift() ?? []).then(resolve, reject);
    return cadena;
  };
  return { getDb: nuevaCadena, withDbTransaction: async () => undefined };
});

/** Un PDF plano de una pagina: evita `sharp` en el camino de preparacion. */
const PDF = Buffer.from(
  `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n` +
    `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n` +
    `3 0 obj << /Type /Page /Parent 2 0 R >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`,
  "latin1",
);

vi.mock("./r2", async () => {
  const real = await vi.importActual<typeof import("./r2")>("./r2");
  return {
    ...real,
    getPrivateObject: async () => ({
      Body: (async function* () {
        yield new Uint8Array(PDF);
      })(),
    }),
    deleteObjectKeys: async () => undefined,
  };
});

const { runAnalysis } = await import("./catalog-import/prepare");
const { withinAttemptBudget } = await import("./catalog-import/quota");

const IMPORT_ID = "11111111-1111-4111-8111-111111111111";
const NEGOCIO_ID = "22222222-2222-4222-8222-222222222222";

const fila = {
  id: IMPORT_ID,
  businessId: NEGOCIO_ID,
  createdByUserId: "u-1",
  status: "queued",
  sourceKind: "pdf",
  fileCount: 1,
  attemptCount: 1,
  cancelRequestedAt: null,
  createdAt: new Date("2026-09-22T10:00:00.000Z"),
  expiresAt: new Date("2026-09-23T10:00:00.000Z"),
};

const archivo = {
  id: "f-1",
  importId: IMPORT_ID,
  businessId: NEGOCIO_ID,
  position: 0,
  objectKey: "catalog-imports/b/i/f",
  declaredContentType: "application/pdf",
  byteSize: PDF.byteLength,
  status: "uploaded",
};

const proveedor = (): CatalogExtractionProvider => ({
  id: "doble",
  model: "doble-v1",
  start: async () => {
    estado.submits += 1;
    return { kind: "deferred", jobId: "job-1" };
  },
});

/** La cola, en orden: reclamo → archivos/preparacion → suscripcion → conteo → submit → … */
function cola(usados: number) {
  return [[fila], [archivo], [], [], [], [{ total: usados }], [], [], [], []];
}

beforeEach(() => {
  estado.filas = [];
  estado.sets = [];
  estado.submits = 0;
});

describe("la REGLA: conteo vs tope (spec 0090 §8)", () => {
  it("con el conteo por DEBAJO del tope, hay presupuesto", async () => {
    estado.filas = [[], [{ total: 1 }]];
    expect(await withinAttemptBudget(NEGOCIO_ID)).toBe(true);
  });

  /** La fila en curso TODAVIA NO esta contada: con 3 aceptados, el siguiente no pasa. */
  it("JUSTO en el tope ya no hay presupuesto — el borde importa", async () => {
    estado.filas = [[], [{ total: 3 }]];
    expect(await withinAttemptBudget(NEGOCIO_ID)).toBe(false);
  });

  it("uno por encima del tope, NO", async () => {
    estado.filas = [[], [{ total: 4 }]];
    expect(await withinAttemptBudget(NEGOCIO_ID)).toBe(false);
  });
});

describe("el CABLEADO: `runAnalysis` consulta el techo antes de submitear", () => {
  /** ORACULO DEL CABLEADO DE M10: borrar la llamada en `prepare.ts` pone esto en rojo por
   * partida doble — el proveedor recibe un submit y el import no cierra en `failed`. */
  it("agotado el techo, cierra en `failed` y NO llama al proveedor", async () => {
    estado.filas = cola(3);
    const outcome = await runAnalysis(IMPORT_ID, { provider: proveedor() });
    expect(outcome).toBe("failed");
    // Lo que el techo existe para proteger: la plata. Cero submits.
    expect(estado.submits).toBe(0);
    expect(estado.sets).toContainEqual(
      expect.objectContaining({
        status: "failed",
        failureCode: "catalog_import_rate_limited",
      }),
    );
  });

  it("dentro del presupuesto SÍ submitea y pasa a `analyzing`", async () => {
    estado.filas = cola(1);
    const outcome = await runAnalysis(IMPORT_ID, { provider: proveedor() });
    expect(outcome).toBe("submitted");
    expect(estado.submits).toBe(1);
    expect(estado.sets).toContainEqual(
      expect.objectContaining({ status: "analyzing", providerJobId: "job-1" }),
    );
    // Y ningún `failed` se coló por el camino.
    expect(estado.sets.some((set) => set.status === "failed")).toBe(false);
  });

  it("el techo del NEGOCIO no tapa al de reintentos del import: son dos", async () => {
    // `attempt_count` por encima de `MAX_ATTEMPTS` cierra antes, con OTRO código.
    estado.filas = [
      [{ ...fila, attemptCount: 9 }],
      [archivo],
      [],
      [],
      [],
      [{ total: 0 }],
    ];
    const outcome = await runAnalysis(IMPORT_ID, { provider: proveedor() });
    expect(outcome).toBe("failed");
    expect(estado.submits).toBe(0);
    expect(estado.sets).toContainEqual(
      expect.objectContaining({ failureCode: "provider_unavailable" }),
    );
  });
});
