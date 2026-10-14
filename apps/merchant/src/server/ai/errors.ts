/**
 * Spec 0224 §3 — LOS ERRORES del servicio de IA. Ninguno es HTTP: cada funcion los traduce a su
 * contrato de siempre (el dictado y la foto a 503 `draft_unavailable`, el menu a
 * `provider_unavailable`).
 */

export type AiUnavailableReason =
  "unconfigured" | "timeout" | "provider_error" | "output_invalid";

export class AiUnavailableError extends Error {
  constructor(
    readonly reason: AiUnavailableReason,
    /** Diagnostico SEGURO del adaptador (`OpenAiRequestDiagnostics`): nunca clave, cuerpo ni
     * contenido. Va al log `ai_request_failed`. */
    readonly diagnostics?: Readonly<Record<string, unknown>>,
  ) {
    super(`ai_unavailable: ${reason}`);
    this.name = "AiUnavailableError";
  }
}

/** La entrada de imagenes invalida (`image-input.ts`). El handler del modulo la convierte en
 * `ModuleError` con el mismo status, codigo y mensaje. */
export type AiInputErrorCode =
  "invalid_photos" | "photos_too_large" | "unsupported_image";

export class AiInputError extends Error {
  constructor(
    readonly status: 413 | 415 | 422,
    readonly code: AiInputErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiInputError";
  }
}

/** Spec 0224 §4 — EL UNICO evento de falla de la IA. Solo tarea, proveedor, modelo, motivo y el
 * diagnostico seguro: nunca la clave, el prompt, el texto, la imagen, el PDF ni la respuesta. */
export function logAiFailure(event: {
  task: string;
  provider: string;
  model: string | null;
  reason: string;
  diagnostics?: Readonly<Record<string, unknown>>;
}): void {
  console.warn("ai_request_failed", event);
}
