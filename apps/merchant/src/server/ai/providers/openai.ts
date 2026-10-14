import { createHash } from "node:crypto";
import { AiUnavailableError } from "../errors";
import type {
  AiInput,
  AiProvider,
  AiProviderRequest,
  AiRaw,
  AiTask,
} from "../task";
import { verifyWebhookSignature } from "./openai-webhook";

/**
 * Spec 0224 §4 / ADR 0143 §3 — EL UNICO CLIENTE DE OPENAI del repo (Responses API con `fetch`, cero
 * paquetes, ADR 0082 §2). Siempre: SIN tools (el documento del usuario es entrada no confiable y no
 * puede alcanzar ninguna capacidad del modelo), `json_schema` estricto, las instrucciones como
 * mensaje `system`, el texto como `input_text`, imagenes `input_image` y PDF `input_file` con
 * `detail: "high"`, y 45 s de timeout por pedido (el despachador de modulos corta a los 60).
 *
 * `run` es sincrono (`store: false`); `start` es en segundo plano (`background: true`, `store: true`):
 * devuelve un id al instante y el resultado se retoma con `retrieve` (webhook o reconciliador).
 */

export const OPENAI_TIMEOUT_MS = 45_000;

export type OpenAiRequestDiagnostics = {
  kind: "http_error" | "network_error";
  operation: "create" | "retrieve";
  keyFingerprint: string;
  keyLength: number;
  keyHasOuterWhitespace: boolean;
  status?: number;
  errorType?: string;
  errorCode?: string;
  errorParam?: string;
  requestId?: string;
  hostname?: string;
  redirected?: boolean;
  causeCode?: string;
};

export class OpenAiProvider implements AiProvider {
  readonly id = "openai";
  readonly model: (task: AiTask<unknown>) => string;
  private readonly apiKey: string;
  private readonly webhookSecret: string | undefined;
  private readonly baseUrl: string;

  constructor(config: {
    apiKey: string;
    webhookSecret: string | undefined;
    modelFor: (task: AiTask<unknown>) => string;
    baseUrl?: string;
  }) {
    this.apiKey = config.apiKey;
    this.webhookSecret = config.webhookSecret;
    this.model = config.modelFor;
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  }

  async run(req: AiProviderRequest): Promise<AiRaw> {
    const response = await this.request("POST", "/responses", {
      ...requestBody(req),
      store: false,
    });
    return rawFrom(response);
  }

  async start(
    req: AiProviderRequest,
  ): Promise<{ kind: "deferred"; jobId: string }> {
    const response = await this.request("POST", "/responses", {
      ...requestBody(req),
      // El id diferido llega al instante; el resultado se busca despues.
      background: true,
      store: true,
    });
    const jobId = typeof response.id === "string" ? response.id : "";
    if (!jobId) throw new AiUnavailableError("provider_error");
    return { kind: "deferred", jobId };
  }

  async retrieve(
    jobId: string,
  ): Promise<
    | { status: "pending" }
    | { status: "done"; raw: AiRaw }
    | { status: "failed"; code: string }
  > {
    const response = await this.request(
      "GET",
      `/responses/${encodeURIComponent(jobId)}`,
    );
    const status = typeof response.status === "string" ? response.status : "";
    if (status === "queued" || status === "in_progress") {
      return { status: "pending" };
    }
    if (status !== "completed") {
      return { status: "failed", code: `provider_${status || "unknown"}` };
    }
    return { status: "done", raw: rawFrom(response) };
  }

  /** La firma ANTES que cualquier otra cosa; del cuerpo solo sale el id. */
  verifyCallback(headers: Headers, rawBody: string): { jobId: string } | null {
    const result = verifyWebhookSignature(headers, rawBody, {
      secret: this.webhookSecret,
    });
    return result.ok ? { jobId: result.jobId } : null;
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const operation = method === "POST" ? "create" : "retrieve";
    const key = {
      keyFingerprint: createHash("sha256")
        .update(this.apiKey)
        .digest("hex")
        .slice(0, 12),
      keyLength: this.apiKey.length,
      keyHasOuterWhitespace: this.apiKey !== this.apiKey.trim(),
    };
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new AiUnavailableError("timeout");
      }
      const cause =
        error instanceof Error
          ? (error.cause as { code?: unknown } | undefined)
          : undefined;
      const diagnostics: OpenAiRequestDiagnostics = {
        kind: "network_error",
        operation,
        ...key,
        hostname: hostnameOf(this.baseUrl),
        causeCode:
          typeof cause?.code === "string" ? cause.code.slice(0, 80) : undefined,
      };
      throw new AiUnavailableError("provider_error", diagnostics);
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { type?: unknown; code?: unknown; param?: unknown };
      } | null;
      const providerError = payload?.error;
      const diagnostics: OpenAiRequestDiagnostics = {
        kind: "http_error",
        operation,
        ...key,
        status: response.status,
        errorType: safeScalar(providerError?.type),
        errorCode: safeScalar(providerError?.code),
        errorParam: safeScalar(providerError?.param),
        requestId:
          response.headers?.get("x-request-id")?.slice(0, 120) || undefined,
        hostname: hostnameOf(response.url || this.baseUrl),
        redirected: response.redirected,
      };
      throw new AiUnavailableError("provider_error", diagnostics);
    }
    return (await response.json()) as Record<string, unknown>;
  }
}

/** El cuerpo comun de `run` y `start`. */
export function requestBody(req: AiProviderRequest): Record<string, unknown> {
  return {
    model: req.model,
    ...(req.reasoningEffort
      ? { reasoning: { effort: req.reasoningEffort } }
      : {}),
    tools: [],
    input: [
      { role: "system", content: req.task.instructions },
      { role: "user", content: userContent(req.input) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: req.task.schema.name,
        strict: true,
        schema: req.task.schema.json,
      },
    },
  };
}

/** `[context, text]` como `input_text`, despues las imagenes y los PDF. */
export function userContent(input: AiInput): Record<string, string>[] {
  const text = [input.context, input.text].filter(Boolean).join("\n");
  return [
    ...(text ? [{ type: "input_text", text }] : []),
    ...(input.images ?? []).map((image) => ({
      type: "input_image",
      image_url: `data:image/jpeg;base64,${image.jpeg.toString("base64")}`,
      detail: "high",
    })),
    // La Responses API acepta PDFs como `input_file`; `filename` es obligatorio con file_data.
    ...(input.files ?? []).map((file) => ({
      type: "input_file",
      filename: file.filename,
      file_data: `data:application/pdf;base64,${file.bytes.toString("base64")}`,
      detail: "high",
    })),
  ];
}

/** El JSON de la salida, sin validar (lo valida `task.parse`). Lector ESTRICTO: `output_text` o la
 * primera parte con `type === "output_text"`. Sin eso, o sin JSON, la salida es invalida. */
function rawFrom(response: Record<string, unknown>): AiRaw {
  const text = outputText(response);
  if (text === null) throw new AiUnavailableError("output_invalid");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiUnavailableError("output_invalid");
  }
  const usage = response.usage as Record<string, unknown> | undefined;
  return {
    parsed,
    usage: {
      inputTokens: countOrNull(usage?.input_tokens),
      outputTokens: countOrNull(usage?.output_tokens),
    },
    providerRequestId:
      typeof response.id === "string" ? response.id.slice(0, 120) : null,
  };
}

function outputText(response: Record<string, unknown>): string | null {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const p = part as { type?: unknown; text?: unknown };
      if (p?.type === "output_text" && typeof p.text === "string")
        return p.text;
    }
  }
  return null;
}

/** Entero NO negativo o null. */
function countOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function safeScalar(value: unknown): string | undefined {
  return typeof value === "string" ? value.slice(0, 120) : undefined;
}

function hostnameOf(value: string): string | undefined {
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}
