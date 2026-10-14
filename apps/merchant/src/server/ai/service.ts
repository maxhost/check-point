import { aiProviderFromEnv } from "./config";
import { logAiFailure } from "./errors";
import type { AiContext, AiInput, AiProvider, AiResult, AiTask } from "./task";
import { insertAiRequest } from "./usage";
import {
  type Deps,
  assertWithinLimits,
  parsed,
  reasonOf,
  requestFor,
} from "./service-support";

export { countAiRequests } from "./usage";
export {
  type PollOutcome,
  type SubmitOutcome,
  closeAiJob,
  pollAiJob,
  submitAiTask,
  verifyAiCallback,
} from "./background";

/**
 * Spec 0224 §2 / ADR 0143 — EL SERVICIO DE IA del core. Toda funcion con IA pasa por aca: el
 * proveedor, el modelo, el validador de la tarea, el log y el registro (`core.ai_request`). No es
 * una API HTTP: cada funcion conserva su ruta y sus guards y llama a estas funciones.
 *
 * `deps.provider` lo inyectan los tests y lo pasa el menu (que lo resolvio antes, §6); las rutas de
 * modulo nunca lo pasan.
 */
/** SINCRONO (dictado, foto). Registra SIEMPRE una fila (`ok` o `failed`); tira `AiUnavailableError`
 * en cualquier falla. */
export async function runAiTask<Out>(
  task: AiTask<Out>,
  input: AiInput,
  ctx: AiContext,
  deps: Deps = {},
): Promise<AiResult<Out>> {
  assertWithinLimits(task as AiTask<unknown>, input);
  const row = {
    businessId: ctx.businessId,
    userId: ctx.userId,
    taskId: task.id,
    taskVersion: task.version,
    mode: "sync" as const,
    input,
  };
  let provider: AiProvider;
  try {
    provider = deps.provider ?? aiProviderFromEnv();
  } catch (error) {
    const failure = reasonOf(error);
    logAiFailure({
      task: task.id,
      provider: "unconfigured",
      model: null,
      reason: failure.reason,
    });
    await insertAiRequest({
      ...row,
      provider: "unconfigured",
      model: null,
      status: "failed",
      failureCode: failure.reason,
    });
    throw failure;
  }
  const model = provider.model(task as AiTask<unknown>);
  const started = Date.now();
  try {
    const raw = await provider.run(
      requestFor(task as AiTask<unknown>, provider, input),
    );
    const output = parsed(task, raw);
    const requestId = await insertAiRequest({
      ...row,
      provider: provider.id,
      model,
      status: "ok",
      outputItems: task.countItems(output),
      usage: raw.usage,
      durationMs: Date.now() - started,
      providerRequestId: raw.providerRequestId,
    });
    return {
      output,
      usage: raw.usage,
      requestId,
      provider: provider.id,
      model,
    };
  } catch (error) {
    const failure = reasonOf(error);
    logAiFailure({
      task: task.id,
      provider: provider.id,
      model,
      reason: failure.reason,
      diagnostics: failure.diagnostics,
    });
    await insertAiRequest({
      ...row,
      provider: provider.id,
      model,
      status: "failed",
      failureCode: failure.reason,
      durationMs: Date.now() - started,
    });
    throw failure;
  }
}
