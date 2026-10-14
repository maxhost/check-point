import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  importIntegrationEnabled as enabled,
  limpiarNegocio,
  seedNegocio,
  usosDe,
  type SeedImport,
} from "../catalog-import-integration-support";
import {
  DEMO_ALFA,
  DEMO_BETA,
  DEMO_JPEG,
  ScriptedAiProvider,
  aiRaw,
} from "./ai-test-support";
import { AiUnavailableError } from "./errors";
import {
  closeAiJob,
  countAiRequests,
  pollAiJob,
  runAiTask,
  submitAiTask,
} from "./service";

/**
 * Spec 0224 §2/§7 — EL SEGUNDO PLANO CONTRA LA BASE (`submitAiTask`, `pollAiJob`, `closeAiJob`,
 * `countAiRequests`). Tareas NEUTRAS: el core no nombra tareas de modulo.
 */
let a: SeedImport;
let b: SeedImport;

beforeAll(async () => {
  a = await seedNegocio("IA servicio");
  b = await seedNegocio("IA servicio ajeno");
}, 60_000);

afterAll(async () => {
  for (const seed of [a, b]) if (seed) await limpiarNegocio(seed);
}, 60_000);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const filasDe = async (task: string, subjectId?: string) =>
  (await usosDe(a.businessId)).filter(
    (r) => r.task === task && (!subjectId || r.subjectId === subjectId),
  );

describe.skipIf(!enabled)("segundo plano contra Neon (spec 0224 §2)", () => {
  const ctx = (subjectId: string) => ({
    businessId: a.businessId,
    userId: a.userId,
    subjectId,
  });
  const diferido = (jobId = "job-1") =>
    new ScriptedAiProvider({
      start: () => ({ kind: "deferred" as const, jobId }),
    });

  it("un submit RECHAZADO no deja fila (ADR 0083)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const subject = randomUUID();
    const provider = new ScriptedAiProvider({
      start: () => {
        throw new AiUnavailableError("provider_error");
      },
    });
    await expect(
      submitAiTask(DEMO_BETA, { images: [DEMO_JPEG] }, ctx(subject), {
        provider,
      }),
    ).rejects.toMatchObject({ reason: "provider_error" });
    expect(await filasDe("demo.beta", subject)).toEqual([]);
  });

  it("aceptado → `pending` con `subject_id`; un segundo submit del mismo trabajo no duplica", async () => {
    const subject = randomUUID();
    const uno = await submitAiTask(
      DEMO_BETA,
      {
        files: [{ kind: "pdf", bytes: Buffer.from("%PDF"), filename: "m.pdf" }],
      },
      ctx(subject),
      { provider: diferido() },
    );
    const dos = await submitAiTask(
      DEMO_BETA,
      { images: [DEMO_JPEG] },
      ctx(subject),
      {
        provider: diferido("job-2"),
      },
    );
    expect(uno).toMatchObject({ kind: "deferred", jobId: "job-1" });
    const filas = await filasDe("demo.beta", subject);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      status: "pending",
      mode: "background",
      inputFiles: 1,
      finishedAt: null,
    });
    if (uno.kind !== "deferred" || dos.kind !== "deferred") throw new Error();
    expect(dos.requestId).toBe(uno.requestId);
  });

  /** ORACULO DE M6: el cierre solo toca filas `pending`; un webhook duplicado no reescribe. */
  it("`pollAiJob` done → `ok` con `finished_at` y duracion; el segundo done (webhook duplicado) no cambia nada", async () => {
    const subject = randomUUID();
    await submitAiTask(DEMO_BETA, { images: [DEMO_JPEG] }, ctx(subject), {
      provider: diferido(),
    });
    const tokens = [
      { inputTokens: 100, outputTokens: 20 },
      { inputTokens: 999, outputTokens: 999 },
    ];
    let vuelta = 0;
    const provider = new ScriptedAiProvider({
      retrieve: () => ({
        status: "done" as const,
        raw: aiRaw({ items: [1] }, tokens[vuelta++]),
      }),
    });
    const primero = await pollAiJob(
      DEMO_BETA,
      { jobId: "job-1", subjectId: subject },
      { provider },
    );
    expect(primero).toMatchObject({ status: "done" });
    const [cerrada] = await filasDe("demo.beta", subject);
    expect(cerrada).toMatchObject({
      status: "ok",
      inputTokens: 100,
      outputTokens: 20,
      outputItems: 1,
    });
    expect(cerrada.finishedAt).not.toBeNull();
    expect(cerrada.durationMs).toBeGreaterThanOrEqual(0);

    await pollAiJob(
      DEMO_BETA,
      { jobId: "job-1", subjectId: subject },
      { provider },
    );
    const [despues] = await filasDe("demo.beta", subject);
    expect(despues.finishedAt?.getTime()).toBe(cerrada.finishedAt?.getTime());
    expect([despues.inputTokens, despues.outputTokens]).toEqual([100, 20]);
  });

  it("salida invalida al retomar → `failed` `output_invalid`", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const subject = randomUUID();
    await submitAiTask(DEMO_BETA, {}, ctx(subject), { provider: diferido() });
    const result = await pollAiJob(
      DEMO_BETA,
      { jobId: "job-1", subjectId: subject },
      {
        provider: new ScriptedAiProvider({
          retrieve: () => ({ status: "done" as const, raw: aiRaw({}) }),
        }),
      },
    );
    expect(result).toEqual({ status: "failed", code: "output_invalid" });
    expect(await filasDe("demo.beta", subject)).toEqual([
      expect.objectContaining({
        status: "failed",
        failureCode: "output_invalid",
      }),
    ]);
  });

  it("`closeAiJob` cierra una `pending` con su codigo y no toca una `ok`", async () => {
    const pendiente = randomUUID();
    await submitAiTask(DEMO_BETA, {}, ctx(pendiente), { provider: diferido() });
    await closeAiJob(DEMO_BETA, pendiente, "cancelled");
    expect(await filasDe("demo.beta", pendiente)).toEqual([
      expect.objectContaining({ status: "failed", failureCode: "cancelled" }),
    ]);

    const lista = randomUUID();
    await submitAiTask(DEMO_BETA, {}, ctx(lista), { provider: diferido() });
    await pollAiJob(
      DEMO_BETA,
      { jobId: "job-1", subjectId: lista },
      {
        provider: new ScriptedAiProvider({
          retrieve: () => ({
            status: "done" as const,
            raw: aiRaw({ items: [] }),
          }),
        }),
      },
    );
    await closeAiJob(DEMO_BETA, lista, "expired");
    expect(await filasDe("demo.beta", lista)).toEqual([
      expect.objectContaining({ status: "ok", failureCode: null }),
    ]);
  });

  it("`countAiRequests` cuenta solo su tarea y su negocio", async () => {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const antes = await countAiRequests(a.businessId, "demo.alpha", since);
    await runAiTask(
      DEMO_ALFA,
      { text: "z" },
      { businessId: b.businessId, userId: b.userId },
      { provider: new ScriptedAiProvider({ run: () => aiRaw({ items: [] }) }) },
    );
    await submitAiTask(DEMO_BETA, {}, ctx(randomUUID()), {
      provider: diferido(),
    });
    expect(await countAiRequests(a.businessId, "demo.alpha", since)).toBe(
      antes,
    );
    expect(await countAiRequests(b.businessId, "demo.alpha", since)).toBe(1);
    expect(typeof antes).toBe("number");
  });
});
