import { aiProviderFromEnv } from "./config";
import { logAiFailure } from "./errors";
import type { AiContext, AiInput, AiProvider, AiResult, AiTask } from "./task";
import { closeAiRequest, insertAiRequest, requestIdOf } from "./usage";
import {
  type Deps,
  assertWithinLimits,
  parsed,
  reasonOf,
  requestFor,
} from "./service-support";

/**
 * Spec 0224 §2 — EL MODO EN SEGUNDO PLANO del servicio (hoy solo el menu: `background: true` +
 * webhook o reconciliador, ADR 0082 §8). El ESTADO del trabajo sigue siendo de la funcion
 * (`core.catalog_import`); aca solo vive su fila de uso, que se cierra por cualquier camino.
 */

export type SubmitOutcome<Out> =
  | { kind: "completed"; result: AiResult<Out> }
  | { kind: "deferred"; jobId: string; requestId: string };

/**
 * EN SEGUNDO PLANO (menu). Configuracion o rechazo del proveedor → `AiUnavailableError` SIN fila
 * (ADR 0083: lo que no cruzo al proveedor no cuenta). Aceptado → una fila por `subjectId`:
 * `pending` (o `ok`/`failed` si el proveedor contesto en el momento).
 */
export async function submitAiTask<Out>(
  task: AiTask<Out>,
  input: AiInput,
  ctx: AiContext & { subjectId: string },
  deps: Deps = {},
): Promise<SubmitOutcome<Out>> {
  assertWithinLimits(task as AiTask<unknown>, input);
  const provider = deps.provider ?? aiProviderFromEnv();
  const model = provider.model(task as AiTask<unknown>);
  let started: Awaited<ReturnType<AiProvider["start"]>>;
  try {
    started = await provider.start(
      requestFor(task as AiTask<unknown>, provider, input),
    );
  } catch (error) {
    const failure = reasonOf(error);
    logAiFailure({
      task: task.id,
      provider: provider.id,
      model,
      reason: failure.reason,
      diagnostics: failure.diagnostics,
    });
    throw failure;
  }
  const row = {
    businessId: ctx.businessId,
    userId: ctx.userId,
    taskId: task.id,
    taskVersion: task.version,
    mode: "background" as const,
    provider: provider.id,
    model,
    input,
    subjectId: ctx.subjectId,
  };
  if (started.kind === "deferred") {
    const requestId = await insertAiRequest({ ...row, status: "pending" });
    return { kind: "deferred", jobId: started.jobId, requestId };
  }
  const raw = started.raw;
  let output: Out;
  try {
    output = parsed(task, raw);
  } catch (error) {
    const failure = reasonOf(error);
    logAiFailure({
      task: task.id,
      provider: provider.id,
      model,
      reason: failure.reason,
    });
    await insertAiRequest({
      ...row,
      status: "failed",
      failureCode: failure.reason,
      durationMs: 0,
    });
    throw failure;
  }
  const requestId = await insertAiRequest({
    ...row,
    status: "ok",
    outputItems: task.countItems(output),
    usage: raw.usage,
    durationMs: 0,
    providerRequestId: raw.providerRequestId,
  });
  return {
    kind: "completed",
    result: {
      output,
      usage: raw.usage,
      requestId,
      provider: provider.id,
      model,
    },
  };
}

export type PollOutcome<Out> =
  | { status: "pending" }
  | { status: "done"; result: AiResult<Out> }
  | { status: "failed"; code: string };

/**
 * Retoma un trabajo en segundo plano (webhook o reconciliador). `pending` no toca nada; terminado
 * CIERRA la fila (idempotente: un webhook duplicado no reescribe). Salida invalida → `failed`
 * `output_invalid`. Un error de red TIRA: el reconciliador reintenta.
 */
export async function pollAiJob<Out>(
  task: AiTask<Out>,
  job: { jobId: string; subjectId: string },
  deps: Deps = {},
): Promise<PollOutcome<Out>> {
  const provider = deps.provider ?? aiProviderFromEnv();
  const model = provider.model(task as AiTask<unknown>);
  let retrieved: Awaited<ReturnType<AiProvider["retrieve"]>>;
  let output: Out;
  try {
    retrieved = await provider.retrieve(job.jobId);
    if (retrieved.status === "pending") return { status: "pending" };
    if (retrieved.status === "failed") {
      await closeAiRequest(task.id, job.subjectId, {
        status: "failed",
        failureCode: retrieved.code,
      });
      return { status: "failed", code: retrieved.code };
    }
    output = parsed(task, retrieved.raw);
  } catch (error) {
    const failure = reasonOf(error);
    logAiFailure({
      task: task.id,
      provider: provider.id,
      model,
      reason: failure.reason,
      diagnostics: failure.diagnostics,
    });
    if (failure.reason !== "output_invalid") throw failure;
    await closeAiRequest(task.id, job.subjectId, {
      status: "failed",
      failureCode: "output_invalid",
    });
    return { status: "failed", code: "output_invalid" };
  }
  const raw = retrieved.raw;
  const closed = await closeAiRequest(task.id, job.subjectId, {
    status: "ok",
    outputItems: task.countItems(output),
    usage: raw.usage,
    providerRequestId: raw.providerRequestId,
  });
  const requestId = closed ?? (await requestIdOf(task.id, job.subjectId)) ?? "";
  return {
    status: "done",
    result: {
      output,
      usage: raw.usage,
      requestId,
      provider: provider.id,
      model,
    },
  };
}

/** Cierra `failed` la fila `pending` de un trabajo que termino SIN el resultado del proveedor
 * (cancelar, vencer, fallar sin poll). No-op si no hay fila o ya esta cerrada. */
export async function closeAiJob(
  task: Pick<AiTask<unknown>, "id">,
  subjectId: string,
  code: string,
): Promise<void> {
  await closeAiRequest(task.id, subjectId, {
    status: "failed",
    failureCode: code,
  });
}

/** La firma del webhook ANTES de todo. Sin proveedor o sin secreto → `null` (la ruta da 401). */
export function verifyAiCallback(
  headers: Headers,
  rawBody: string,
  deps: Deps = {},
): { jobId: string } | null {
  let provider: AiProvider;
  try {
    provider = deps.provider ?? aiProviderFromEnv();
  } catch {
    return null;
  }
  return provider.verifyCallback(headers, rawBody);
}
