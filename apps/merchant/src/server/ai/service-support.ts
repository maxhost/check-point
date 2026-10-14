import { reasoningFor } from "./config";
import { AiUnavailableError } from "./errors";
import type { AiInput, AiProvider, AiRaw, AiTask } from "./task";

/** Spec 0224 §2 — las piezas comunes de `service.ts` y `background.ts`. */
export type Deps = { provider?: AiProvider };

export function assertWithinLimits(
  task: AiTask<unknown>,
  input: AiInput,
): void {
  const images = input.images?.length ?? 0;
  const files = input.files?.length ?? 0;
  if (images > task.limits.maxImages || files > task.limits.maxFiles) {
    // Error de programacion: la funcion valida su entrada antes de llamar.
    throw new Error(`ai_input_over_limit: ${task.id}`);
  }
}

export function reasonOf(error: unknown): AiUnavailableError {
  return error instanceof AiUnavailableError
    ? error
    : new AiUnavailableError("provider_error");
}

export function requestFor(
  task: AiTask<unknown>,
  provider: AiProvider,
  input: AiInput,
) {
  return {
    task,
    model: provider.model(task) ?? task.model,
    reasoningEffort: reasoningFor(task),
    input,
  };
}

/** Valida la salida con el `parse` de la tarea; tira `output_invalid`. */
export function parsed<Out>(task: AiTask<Out>, raw: AiRaw): Out {
  try {
    return task.parse(raw.parsed);
  } catch {
    throw new AiUnavailableError("output_invalid");
  }
}
