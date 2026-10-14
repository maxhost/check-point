import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { and, eq, notInArray } from "drizzle-orm";
import {
  importIntegrationEnabled as enabled,
  leerImport,
  limpiarNegocio,
  seedImport,
  seedNegocio,
  sembrarUsoMenu,
  usosDe,
  type SeedImport,
} from "./catalog-import-integration-support";
import { ScriptedAiProvider, aiRaw } from "./ai/ai-test-support";

const r2 = vi.hoisted(() => ({ lecturas: 0 }));
vi.mock("@mi-pasaporte/domain/server/r2", async () => {
  const real = await vi.importActual<
    typeof import("@mi-pasaporte/domain/server/r2")
  >("@mi-pasaporte/domain/server/r2");
  return {
    ...real,
    getPrivateObject: async () => {
      r2.lecturas += 1;
      throw new Error("no deberia leer R2");
    },
    deleteObjectKeys: async () => undefined,
  };
});

const { getDb } = await import("@mi-pasaporte/db");
const { aiRequests, catalogImportFiles, catalogImports } =
  await import("@mi-pasaporte/db/schema");
const { cancelImport } = await import("./catalog-import/core");
const { handleProviderCallback } = await import("./catalog-import/callback");
const { runAnalysis } = await import("./catalog-import/prepare");
const { runCatalogImportReconcile } =
  await import("./catalog-import/reconcile");
const { cleanupExpiredCatalogImports } =
  await import("./catalog-import/cleanup");

/**
 * Spec 0224 §6 — LA FILA DE USO DEL MENU SE CIERRA POR CUALQUIER CAMINO. Toda salida del trabajo
 * que no pasa por el resultado del proveedor (cancelar, vencer, agotar intentos, cancelar entre el
 * `start` y el `update`) cierra su fila de `core.ai_request` en `failed` con su codigo. Invariante,
 * medida al final de cada caso: **ninguna fila `pending` del negocio cuyo import no este en
 * `queued`/`analyzing`**.
 *
 * Declarado: `cleanupExpiredCatalogImports` es GLOBAL (vence imports y drena la cola de cualquier
 * negocio); este archivo corre de a uno contra una base descartable.
 */
let a: SeedImport;

beforeAll(async () => {
  a = await seedNegocio("IA uso menu");
}, 60_000);

afterAll(async () => {
  if (a) await limpiarNegocio(a);
}, 60_000);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const usoDe = async (importId: string) =>
  (await usosDe(a.businessId)).filter((r) => r.subjectId === importId);

/** La invariante: cero filas `pending` del negocio con el import fuera de `queued`/`analyzing`. */
async function pendientesHuerfanas(): Promise<string[]> {
  const rows = await getDb()
    .select({ id: aiRequests.id })
    .from(aiRequests)
    .innerJoin(catalogImports, eq(catalogImports.id, aiRequests.subjectId))
    .where(
      and(
        eq(aiRequests.businessId, a.businessId),
        eq(aiRequests.status, "pending"),
        notInArray(catalogImports.status, ["queued", "analyzing"]),
      ),
    );
  return rows.map((r) => r.id);
}

const analizando = async (
  overrides: Partial<Parameters<typeof seedImport>[0]> = {},
) => {
  const id = await seedImport({
    businessId: a.businessId,
    userId: a.userId,
    status: "analyzing",
    providerJobId: `job-${Math.random().toString(36).slice(2, 10)}`,
    leaseUntil: new Date(Date.now() + 60 * 60 * 1000),
    attemptCount: 1,
    ...overrides,
  });
  await sembrarUsoMenu({ businessId: a.businessId, subjectIds: [id] });
  return id;
};

describe.skipIf(!enabled)("fila de uso del menu (spec 0224 §6)", () => {
  /** ORACULO DE M8: `cancelImport` pasa a `cancelled` directo y el callback posterior es no-op;
   * si no cierra la fila, nadie lo hace. */
  it("cancelar en `analyzing` → fila `failed` `cancelled`, y el callback posterior no la toca", async () => {
    const id = await analizando();
    const job = (await leerImport(id))?.providerJobId ?? "";
    await cancelImport({ id: a.businessId }, id);
    expect(await usoDe(id)).toEqual([
      expect.objectContaining({ status: "failed", failureCode: "cancelled" }),
    ]);
    const provider = new ScriptedAiProvider({
      verify: () => ({ jobId: job }),
      retrieve: () => ({
        status: "done" as const,
        raw: aiRaw({ categories: [], warnings: [] }),
      }),
    });
    const outcome = await handleProviderCallback(new Headers(), "{}", {
      provider,
    });
    expect(outcome).toEqual({ status: 200, result: "noop" });
    expect(await usoDe(id)).toEqual([
      expect.objectContaining({ status: "failed", failureCode: "cancelled" }),
    ]);
    expect(await pendientesHuerfanas()).toEqual([]);
  });

  it("un import vencido por `cleanupExpiredCatalogImports` → fila `failed` `expired`", async () => {
    const id = await analizando({
      expiresAt: new Date(Date.now() - 60_000),
    });
    await cleanupExpiredCatalogImports();
    expect((await leerImport(id))?.status).toBe("expired");
    expect(await usoDe(id)).toEqual([
      expect.objectContaining({ status: "failed", failureCode: "expired" }),
    ]);
    expect(await pendientesHuerfanas()).toEqual([]);
  });

  it("el reconciliador con `attemptCount > MAX_ATTEMPTS` → fila `failed` `provider_unavailable`", async () => {
    const id = await analizando({
      attemptCount: 9,
      leaseUntil: new Date(Date.now() - 60_000),
    });
    const provider = new ScriptedAiProvider({
      retrieve: () => ({ status: "pending" as const }),
    });
    await runCatalogImportReconcile({ businessId: a.businessId, provider });
    expect(provider.retrieved).toEqual([]);
    expect((await leerImport(id))?.status).toBe("failed");
    expect(await usoDe(id)).toEqual([
      expect.objectContaining({
        status: "failed",
        failureCode: "provider_unavailable",
      }),
    ]);
    expect(await pendientesHuerfanas()).toEqual([]);
  });

  it("cancelado ENTRE el `start` y el `update` → fila `failed` `cancelled`", async () => {
    const id = await seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "queued",
    });
    const provider = new ScriptedAiProvider({
      start: async () => {
        // El merchant cancela mientras el proveedor acepta el submit.
        await cancelImport({ id: a.businessId }, id);
        return { kind: "deferred" as const, jobId: `job-${id}` };
      },
    });
    expect(await runAnalysis(id, { provider })).toBe("submitted");
    expect((await leerImport(id))?.status).toBe("cancelled");
    expect(await usoDe(id)).toEqual([
      expect.objectContaining({ status: "failed", failureCode: "cancelled" }),
    ]);
    expect(await pendientesHuerfanas()).toEqual([]);
  });

  it("sin `AI_PROVIDER`: el import cierra `failed` sin leer R2 ni sumar intentos, y sin fila", async () => {
    vi.stubEnv("AI_PROVIDER", "");
    const id = await seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "queued",
      attemptCount: 1,
    });
    await getDb()
      .insert(catalogImportFiles)
      .values({
        importId: id,
        businessId: a.businessId,
        position: 0,
        originalName: "menu.jpg",
        declaredContentType: "image/jpeg",
        byteSize: 100,
        objectKey: `catalog-imports/${a.businessId}/${id}/0`,
        status: "uploaded",
      });
    r2.lecturas = 0;
    expect(await runAnalysis(id)).toBe("failed");
    const fila = await leerImport(id);
    expect(fila).toMatchObject({
      status: "failed",
      failureCode: "provider_unavailable",
      failureDetail: "El servicio de análisis no está configurado.",
      attemptCount: 1,
    });
    expect(r2.lecturas).toBe(0);
    expect(await usoDe(id)).toEqual([]);
    expect(await pendientesHuerfanas()).toEqual([]);
  });
});
