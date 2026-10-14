import { AiUnavailableError } from "./errors";
import type { AiProvider, AiTask } from "./task";
import { FakeAiProvider } from "./providers/fake";
import { OpenAiProvider } from "./providers/openai";

/**
 * Spec 0224 §4 — EL PROVEEDOR, por configuracion de SERVIDOR. Una sola variable, `AI_PROVIDER`, y
 * es OBLIGATORIA (owner 2026-10-13: «devolvemos un error no un fake si no hay proveedor
 * seleccionado»): sin ella, vacia, `openai` sin `OPENAI_API_KEY` o un id desconocido →
 * `unconfigured`, en TODOS los entornos. El falso existe solo con `AI_PROVIDER=fake` explicito: un
 * deploy mal configurado nunca devuelve un analisis vacio con cara de real.
 */
export function aiProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AiProvider {
  const id = env.AI_PROVIDER ?? "";
  if (id === "fake") return new FakeAiProvider();
  if (id === "openai") {
    const apiKey = env.OPENAI_API_KEY ?? "";
    if (!apiKey) throw new AiUnavailableError("unconfigured");
    return new OpenAiProvider({
      apiKey,
      webhookSecret: env.OPENAI_WEBHOOK_SECRET,
      modelFor: (task) => modelFor(task, env),
    });
  }
  throw new AiUnavailableError("unconfigured");
}

/** `stock.entry_photo` → `STOCK_ENTRY_PHOTO`. El core no conoce ningun nombre de tarea: lo deriva. */
export function envSlug(taskId: string): string {
  return taskId.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

/** `AI_MODEL_<ID>` o el default de la tarea. */
export function modelFor(
  task: Pick<AiTask<unknown>, "id" | "model">,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env[`AI_MODEL_${envSlug(task.id)}`] || task.model;
}

/** `AI_REASONING_<ID>` o el default de la tarea (null = el del modelo). */
export function reasoningFor(
  task: Pick<AiTask<unknown>, "id" | "reasoningEffort">,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return env[`AI_REASONING_${envSlug(task.id)}`] || task.reasoningEffort;
}
