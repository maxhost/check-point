import type {
  CatalogExtractionInput,
  CatalogExtractionProvider,
  PollResult,
  ProviderExtraction,
  StartResult,
} from "../types";
import { validateProviderExtraction } from "../validation";
import {
  CATALOG_EXTRACTION_JSON_SCHEMA,
  CATALOG_EXTRACTION_PROMPT,
} from "./openai-schema";
import { verifyWebhookSignature } from "./openai-callback";

/**
 * Spec 0090 §4 / ADR 0082 §8 — EL ADAPTADOR `openai`, con `fetch` y **cero paquetes**.
 *
 * Ni el dominio ni las rutas importan un tipo del SDK de ningun proveedor: eso vive
 * exclusivamente en este archivo, y lo que sale de aca ya es `ProviderExtraction`.
 *
 * **El trabajo largo NO corre en nuestra funcion.** Se submitea con `background: true`, que
 * devuelve al instante un `id`, y el resultado se retoma por el callback firmado o por
 * `poll`. Los 60 s de techo de la plataforma no alcanzan para leer 50 MB de R2, correr diez
 * `sharp` y esperar una llamada de vision sobre diez paginas.
 */
export class OpenAiCatalogExtractionProvider implements CatalogExtractionProvider {
  readonly id = "openai";

  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly webhookSecret: string | undefined,
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {}

  async start(input: CatalogExtractionInput): Promise<StartResult> {
    const content = [
      { type: "input_text", text: CATALOG_EXTRACTION_PROMPT },
      ...input.pages.map((page) =>
        page.contentType === "application/pdf"
          ? {
              // La Responses API acepta PDFs como `input_file`, no como `input_image`.
              // `filename` es obligatorio para file_data inline; no se envia el nombre
              // original del merchant porque no aporta nada al analisis.
              type: "input_file",
              filename: `menu-${page.position + 1}.pdf`,
              file_data: `data:application/pdf;base64,${page.bytes.toString("base64")}`,
              detail: "high",
            }
          : {
              type: "input_image",
              image_url: `data:${page.contentType};base64,${page.bytes.toString("base64")}`,
              detail: "high",
            },
      ),
    ];
    const response = await this.request("POST", "/responses", {
      model: this.model,
      // El id diferido llega al instante; el resultado se busca despues.
      background: true,
      store: true,
      // **Sin tools**: el documento del merchant es entrada no confiable y no puede alcanzar
      // ninguna capacidad del modelo mas alla de producir el JSON.
      tools: [],
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "catalog_extraction",
          strict: true,
          schema: CATALOG_EXTRACTION_JSON_SCHEMA,
        },
      },
    });
    const jobId = typeof response.id === "string" ? response.id : "";
    if (!jobId) throw new Error("openai_no_job_id");
    return { kind: "deferred", jobId };
  }

  async poll(jobId: string): Promise<PollResult> {
    const response = await this.request("GET", `/responses/${jobId}`);
    const status = typeof response.status === "string" ? response.status : "";
    if (status === "queued" || status === "in_progress") {
      return { status: "pending" };
    }
    if (status !== "completed") {
      return { status: "failed", code: `provider_${status || "unknown"}` };
    }
    return { status: "done", extraction: extractionFrom(response) };
  }

  /** §7.1 — la firma **antes que cualquier otra cosa**, y del cuerpo solo sale el id. */
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
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      // El cuerpo del error NO se propaga: puede traer el prompt y hasta el eco del
      // documento, y el `failure_detail` que guardamos tiene que estar saneado (§3).
      throw new Error(`openai_http_${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
}

/** Saca el JSON del `output` de la Responses API y lo pasa por el esquema **propio**. Lo que
 * el proveedor prometa con `strict: true` no ahorra esta validacion (§4). */
export function extractionFrom(
  response: Record<string, unknown>,
): ProviderExtraction {
  const text = outputText(response);
  if (!text) throw new Error("openai_no_output_text");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("openai_output_not_json");
  }
  const extraction = validateProviderExtraction(parsed);
  const usage = response.usage as Record<string, unknown> | undefined;
  return {
    ...extraction,
    usage: {
      inputTokens: integerOrNull(usage?.input_tokens),
      outputTokens: integerOrNull(usage?.output_tokens),
    },
    providerRequestId: typeof response.id === "string" ? response.id : null,
  };
}

function outputText(response: Record<string, unknown>): string | null {
  if (typeof response.output_text === "string") return response.output_text;
  const output = response.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    const content = (item as Record<string, unknown>)?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const text = (part as Record<string, unknown>)?.text;
      if (typeof text === "string") return text;
    }
  }
  return null;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}
