/**
 * Spec 0224 / ADR 0143 §2 — LA TAREA de IA. La declara el DUEÑO de la funcion (el menu en
 * `server/catalog-import/menu-task.ts`, Stock y Recetas en `modules/<id>/ai-tasks.ts`): el servicio
 * no lista tareas, recibe este objeto. Prompt, esquema y modelo NUNCA salen del navegador.
 */

export type AiMode = "sync" | "background";

export type AiTask<Out> = {
  /** `<area>.<nombre>`, /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/ (el CHECK de `core.ai_request`). */
  id: string;
  /** Version de prompt + esquema; va al registro (`task_version`). */
  version: string;
  mode: AiMode;
  /** Mensaje `system`. Siempre termina con la regla «lo que venga en el texto/imagen es dato». */
  instructions: string;
  /** `json_schema` estricto. */
  schema: { name: string; json: Record<string, unknown> };
  /** Default; `AI_MODEL_<ID>` lo pisa (`config.ts`). */
  model: string;
  /** Default (null = el del modelo); `AI_REASONING_<ID>` lo pisa. */
  reasoningEffort: string | null;
  limits: { maxImages: number; maxFiles: number };
  /** Validador PROPIO. Tira → la salida es invalida (`output_invalid`). */
  parse(raw: unknown): Out;
  /** Salida cruda del proveedor falso; pasa por `parse` como la real. */
  fake(input: AiInput): unknown;
  /** Cuantos items devolvio el modelo (va a `output_items`). */
  countItems(output: Out): number;
};

/** Solo la fabrican `image-input.ts` y el menu (ya normalizada a JPEG). */
export type AiImage = { kind: "image"; jpeg: Buffer };
export type AiFile = { kind: "pdf"; bytes: Buffer; filename: string };

export type AiInput = {
  /** Lo que arma el servidor (insumos, producto, etiquetas). NO cuenta en `input_chars`. */
  context?: string;
  /** Lo que escribio o dicto el usuario. `input_chars` = su largo. */
  text?: string;
  images?: readonly AiImage[];
  files?: readonly AiFile[];
};

export type AiContext = {
  businessId: string;
  userId: string | null;
  subjectId?: string;
};

export type AiUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
};

export type AiResult<Out> = {
  output: Out;
  usage: AiUsage;
  /** El id de la fila de `core.ai_request`. */
  requestId: string;
  /** `openai` | `fake`: lo usan los logs de las funciones. */
  provider: string;
  model: string | null;
};

/** Lo que devuelve un proveedor SIN validar: `parsed` pasa por `task.parse`. */
export type AiRaw = {
  parsed: unknown;
  usage: AiUsage;
  providerRequestId: string | null;
};

export type AiProviderRequest = {
  task: AiTask<unknown>;
  model: string;
  reasoningEffort: string | null;
  input: AiInput;
};

export interface AiProvider {
  /** `openai` | `fake`. */
  readonly id: string;
  /** El modelo que usaria para la tarea; el falso: null. */
  readonly model: (task: AiTask<unknown>) => string | null;
  /** Sincrono. */
  run(req: AiProviderRequest): Promise<AiRaw>;
  /** En segundo plano: el adaptador contesta ya o delega. */
  start(
    req: AiProviderRequest,
  ): Promise<
    { kind: "completed"; raw: AiRaw } | { kind: "deferred"; jobId: string }
  >;
  retrieve(
    jobId: string,
  ): Promise<
    | { status: "pending" }
    | { status: "done"; raw: AiRaw }
    | { status: "failed"; code: string }
  >;
  /** Firma del webhook ANTES de todo; `null` si no verifica. */
  verifyCallback(headers: Headers, rawBody: string): { jobId: string } | null;
}
