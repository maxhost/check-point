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
  DEMO_JPEG,
  ScriptedAiProvider,
  aiRaw,
} from "./ai-test-support";
import { AiUnavailableError } from "./errors";
import { runAiTask } from "./service";

/**
 * Spec 0224 §2/§7 — `runAiTask` CONTRA LA BASE: que fila deja cada camino sincrono en
 * `core.ai_request`. El segundo plano, en `ai-service-background.neon.integration.test.ts`.
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

describe.skipIf(!enabled)("runAiTask contra Neon (spec 0224 §2)", () => {
  it("ok → fila `ok` con tokens, `output_items` e `input_chars` = largo del TEXTO (no del contexto)", async () => {
    const provider = new ScriptedAiProvider({
      model: "modelo-x",
      run: () =>
        aiRaw({ items: [1, 2, 3] }, { inputTokens: 40, outputTokens: 9 }),
    });
    const result = await runAiTask(
      DEMO_ALFA,
      {
        context: "contexto largo del servidor",
        text: "hola",
        images: [DEMO_JPEG],
      },
      { businessId: a.businessId, userId: a.userId },
      { provider },
    );
    expect(result.output).toEqual({ items: [1, 2, 3] });
    const [fila] = await filasDe("demo.alpha");
    expect(fila).toMatchObject({
      id: result.requestId,
      task: "demo.alpha",
      taskVersion: "v7",
      mode: "sync",
      provider: "openai",
      model: "modelo-x",
      status: "ok",
      failureCode: null,
      inputChars: 4,
      inputImages: 1,
      inputFiles: 0,
      outputItems: 3,
      inputTokens: 40,
      outputTokens: 9,
      providerRequestId: "req_guion",
      createdByUserId: a.userId,
      subjectId: null,
    });
    expect(fila.finishedAt).not.toBeNull();
    expect(fila.durationMs).toBeGreaterThanOrEqual(0);
  });

  /** ORACULO DE M1: el modulo ya no registra; si el servicio no lo hace en la falla, nadie. */
  it("el proveedor tira → fila `failed` `provider_error` y `AiUnavailableError`", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = new ScriptedAiProvider({
      run: () => {
        throw new Error("boom");
      },
    });
    const error = await runAiTask(
      DEMO_ALFA,
      { text: "falla" },
      { businessId: a.businessId, userId: null },
      { provider },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiUnavailableError);
    expect((error as AiUnavailableError).reason).toBe("provider_error");
    const fallidas = (await filasDe("demo.alpha")).filter(
      (r) => r.status === "failed",
    );
    expect(fallidas).toEqual([
      expect.objectContaining({
        failureCode: "provider_error",
        inputChars: 5,
        createdByUserId: null,
      }),
    ]);
  });

  it("sin configurar (sin `AI_PROVIDER`) → fila `unconfigured`, sin modelo", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("AI_PROVIDER", "");
    await expect(
      runAiTask(
        DEMO_ALFA,
        { text: "x" },
        { businessId: a.businessId, userId: a.userId },
      ),
    ).rejects.toMatchObject({ reason: "unconfigured" });
    const filas = (await filasDe("demo.alpha")).filter(
      (r) => r.provider === "unconfigured",
    );
    expect(filas).toEqual([
      expect.objectContaining({
        status: "failed",
        failureCode: "unconfigured",
        model: null,
      }),
    ]);
  });

  it("salida invalida → fila `failed` `output_invalid`", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = new ScriptedAiProvider({
      run: () => aiRaw({ items: "no" }),
    });
    await expect(
      runAiTask(
        DEMO_ALFA,
        { text: "y" },
        { businessId: a.businessId, userId: a.userId },
        { provider },
      ),
    ).rejects.toMatchObject({ reason: "output_invalid" });
    expect(
      (await filasDe("demo.alpha")).filter(
        (r) => r.failureCode === "output_invalid",
      ),
    ).toHaveLength(1);
  });
});
