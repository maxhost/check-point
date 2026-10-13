import { type OpenAiConfig, OpenAiStockDraftProvider } from "./draft-openai";

/**
 * Spec 0212 — EL PROVEEDOR del borrador de entrada. El navegador no elige proveedor ni modelo: sale
 * del entorno del servidor, como la importacion del catalogo (`catalogExtractionProviderFromEnv`).
 */

export type DraftInventoryItem = { id: string; name: string; unit: string };

export type StockDraftInput = {
  text: string;
  items: DraftInventoryItem[];
};

/** Lo que devuelve el proveedor SIN validar: el servidor lo normaliza (`normalizeDraft`). */
export type RawDraft = {
  lines: unknown[];
  unparsed: unknown[];
  usage: { inputTokens: number | null; outputTokens: number | null };
};

export interface StockDraftProvider {
  readonly id: string;
  readonly model: string | null;
  draft(input: StockDraftInput): Promise<RawDraft>;
}

export class DraftProviderUnavailableError extends Error {
  constructor(readonly detail: string) {
    super(`draft_provider_unavailable: ${detail}`);
    this.name = "DraftProviderUnavailableError";
  }
}

/** El falso nunca inventa lineas: todo el texto vuelve como no leido. */
export class FakeStockDraftProvider implements StockDraftProvider {
  readonly id = "fake";
  readonly model = null;
  async draft(input: StockDraftInput): Promise<RawDraft> {
    return {
      lines: [],
      unparsed: [input.text],
      usage: { inputTokens: null, outputTokens: null },
    };
  }
}

/** La configuracion de IA de los dictados (Stock 0212, Recetas 0214), por entorno:
 * `STOCK_DRAFT_PROVIDER` (o el del catalogo, o `fake`), `STOCK_DRAFT_MODEL`, `STOCK_DRAFT_REASONING_EFFORT`.
 * `openai` sin clave TIRA: sin fallback silencioso al falso, que le mostraria al dueño un analisis
 * vacio con cara de real. */
export function aiDraftConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): { id: "fake" } | ({ id: "openai" } & OpenAiConfig) {
  const id =
    env.STOCK_DRAFT_PROVIDER ?? env.CATALOG_EXTRACTION_PROVIDER ?? "fake";
  if (id === "fake") return { id: "fake" };
  if (id === "openai") {
    const apiKey = env.OPENAI_API_KEY ?? "";
    if (!apiKey) throw new DraftProviderUnavailableError("missing_api_key");
    // Default `gpt-6-luna` (banco del 2026-10-12, 6 frases: mismos aciertos que `gpt-5-mini`, 3,0 s
    // contra 7,0 s y ~12 veces mas barato por analisis). `minimal` no lo acepta (400).
    return {
      id: "openai",
      model: env.STOCK_DRAFT_MODEL ?? "gpt-6-luna",
      apiKey,
      reasoningEffort: env.STOCK_DRAFT_REASONING_EFFORT || null,
    };
  }
  throw new DraftProviderUnavailableError("unknown_provider");
}

export function stockDraftProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): StockDraftProvider {
  const config = aiDraftConfigFromEnv(env);
  if (config.id === "fake") return new FakeStockDraftProvider();
  return new OpenAiStockDraftProvider(
    config.model,
    config.apiKey,
    config.reasoningEffort,
  );
}
