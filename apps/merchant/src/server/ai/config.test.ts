import { describe, expect, it } from "vitest";
import { aiProviderFromEnv, envSlug, modelFor, reasoningFor } from "./config";
import { AiUnavailableError } from "./errors";
import type { AiTask } from "./task";

/**
 * Spec 0224 §4 — EL PROVEEDOR Y EL MODELO POR ENTORNO. Cada caso pasa su PROPIO `env`: el setup de
 * vitest fija `AI_PROVIDER=fake` en `process.env` y un caso que lo leyera pasaria por el motivo
 * equivocado.
 *
 * INVERSION DELIBERADA (owner 2026-10-13: «devolvemos un error no un fake si no hay proveedor
 * seleccionado»), no un test roto: `catalog-import-fake.test.ts` («`fake` es el default») y
 * `stock/draft-provider.test.ts` («sin nada, fake») afirmaban lo contrario; su oraculo vive aca con
 * el valor invertido.
 */
const env = (vars: Record<string, string>) =>
  vars as unknown as NodeJS.ProcessEnv;

const tarea = (id: string, model: string): AiTask<unknown> => ({
  id,
  version: "v1",
  mode: "sync",
  instructions: "demo",
  schema: { name: "demo", json: {} },
  model,
  reasoningEffort: null,
  limits: { maxImages: 0, maxFiles: 0 },
  parse: (raw) => raw,
  fake: () => ({}),
  countItems: () => 0,
});
const ALFA = tarea("demo.alpha", "modelo-centinela-a");
const BETA = tarea("demo.beta", "modelo-centinela-b");

function unconfigured(vars: Record<string, string>): AiUnavailableError {
  const error = (() => {
    try {
      aiProviderFromEnv(env(vars));
      return null;
    } catch (e) {
      return e;
    }
  })();
  expect(error).toBeInstanceOf(AiUnavailableError);
  return error as AiUnavailableError;
}

describe("aiProviderFromEnv (spec 0224 §4)", () => {
  it("sin `AI_PROVIDER` (o vacia) → `unconfigured`, NUNCA el falso", () => {
    expect(unconfigured({}).reason).toBe("unconfigured");
    expect(unconfigured({ AI_PROVIDER: "" }).reason).toBe("unconfigured");
    // Con clave de OpenAI pero sin elegir proveedor, tampoco hay fallback.
    expect(unconfigured({ OPENAI_API_KEY: "sk-x" }).reason).toBe(
      "unconfigured",
    );
  });

  it("`fake` explicito → el falso", () => {
    expect(aiProviderFromEnv(env({ AI_PROVIDER: "fake" })).id).toBe("fake");
  });

  it("`openai` sin clave → `unconfigured` (no cae al falso)", () => {
    expect(unconfigured({ AI_PROVIDER: "openai" }).reason).toBe("unconfigured");
  });

  it("un proveedor desconocido → `unconfigured`", () => {
    expect(unconfigured({ AI_PROVIDER: "kimi" }).reason).toBe("unconfigured");
  });

  it("`openai` con clave se construye y resuelve el modelo por tarea desde el entorno", () => {
    const provider = aiProviderFromEnv(
      env({
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "sk-x",
        AI_MODEL_DEMO_ALPHA: "modelo-pisado",
      }),
    );
    expect(provider.id).toBe("openai");
    expect(provider.model(ALFA)).toBe("modelo-pisado");
    expect(provider.model(BETA)).toBe("modelo-centinela-b");
  });
});

describe("modelo y razonamiento por tarea (spec 0224 §4)", () => {
  it("el nombre de la variable se DERIVA del id", () => {
    expect(envSlug("demo.alpha")).toBe("DEMO_ALPHA");
    expect(envSlug("demo.entry_photo")).toBe("DEMO_ENTRY_PHOTO");
  });

  it("`AI_MODEL_DEMO_ALPHA` pisa el default de demo.alpha y NO el de demo.beta", () => {
    const vars = env({ AI_MODEL_DEMO_ALPHA: "modelo-pisado" });
    expect(modelFor(ALFA, vars)).toBe("modelo-pisado");
    expect(modelFor(BETA, vars)).toBe("modelo-centinela-b");
    expect(modelFor(ALFA, env({}))).toBe("modelo-centinela-a");
    // Vacia no pisa.
    expect(modelFor(ALFA, env({ AI_MODEL_DEMO_ALPHA: "" }))).toBe(
      "modelo-centinela-a",
    );
  });

  it("`AI_REASONING_<ID>` pisa el default (null = el del modelo) solo de su tarea", () => {
    const vars = env({ AI_REASONING_DEMO_BETA: "low" });
    expect(reasoningFor(ALFA, vars)).toBeNull();
    expect(reasoningFor(BETA, vars)).toBe("low");
    expect(reasoningFor({ ...ALFA, reasoningEffort: "high" }, env({}))).toBe(
      "high",
    );
  });
});
