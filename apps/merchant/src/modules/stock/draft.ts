import { and, asc, count, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { stockDraftRequests, stockItems } from "@mi-pasaporte/db/schema";
import { formatDecimal, parseDecimal } from "../decimal";
import { ModuleError } from "../errors";
import {
  type DraftInventoryItem,
  type RawDraft,
  type StockDraftProvider,
  DraftProviderUnavailableError,
  stockDraftProviderFromEnv,
} from "./draft-provider";
import { QUANTITY, TOTAL_COST } from "./numbers";

/**
 * Spec 0212 — EL BORRADOR DE UNA ENTRADA desde el texto dictado. La IA propone y el dueño confirma
 * con `POST /entries` (ADR 0082): aca no se escribe stock. Lo unico que se guarda es el USO
 * (`stock.draft_request`), sin el texto.
 *
 * Todo lo que devuelve el modelo se valida contra el negocio de la sesion: un `itemId` que no es un
 * insumo activo de ESTE negocio nunca sale como existente.
 */

const MAX_TEXT = 2000;
const MAX_LINES = 30;
const MAX_ITEMS_FOR_MODEL = 300;
const LINE_BASE: Record<string, string> = {
  g: "g",
  kg: "g",
  ml: "ml",
  l: "ml",
  unit: "unit",
};

export type DraftLine = {
  itemId: string | null;
  name: string;
  isNew: boolean;
  quantity: string;
  unit: "g" | "kg" | "ml" | "l" | "unit";
  totalCost: string | null;
  sourceText: string;
};

export type Draft = { lines: DraftLine[]; unparsed: string[] };

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Pura: valida y normaliza la salida del modelo contra los insumos ACTIVOS del negocio. */
export function normalizeDraft(
  raw: Pick<RawDraft, "lines" | "unparsed">,
  items: DraftInventoryItem[],
): Draft {
  const byId = new Map(items.map((item) => [item.id, item]));
  const lines: DraftLine[] = [];
  const unparsed: string[] = raw.unparsed
    .map((u) => text(u, 500))
    .filter((u) => u.length > 0);
  for (const value of raw.lines) {
    const line = (value ?? {}) as Record<string, unknown>;
    const sourceText = text(line.sourceText, 500);
    const reject = () => unparsed.push(sourceText || text(line.name, 80));
    if (lines.length >= MAX_LINES) {
      reject();
      continue;
    }
    const unit = typeof line.unit === "string" ? line.unit : "";
    let quantity: bigint;
    let totalCost: bigint | null = null;
    try {
      quantity = parseDecimal(line.quantity, QUANTITY);
      if (line.totalCost !== null && line.totalCost !== undefined) {
        totalCost = parseDecimal(line.totalCost, TOTAL_COST);
      }
    } catch (error) {
      if (error instanceof ModuleError) {
        reject();
        continue;
      }
      throw error;
    }
    if (!(unit in LINE_BASE) || quantity <= 0n || (totalCost ?? 0n) < 0n) {
      reject();
      continue;
    }
    const match =
      typeof line.itemId === "string" ? byId.get(line.itemId) : undefined;
    const compatible = match !== undefined && match.unit === LINE_BASE[unit];
    const name = compatible ? match.name : text(line.name, 80);
    if (name.length === 0) {
      reject();
      continue;
    }
    lines.push({
      itemId: compatible ? match.id : null,
      name,
      isNew: !compatible,
      quantity: formatDecimal(quantity, QUANTITY.scale),
      unit: unit as DraftLine["unit"],
      totalCost:
        totalCost === null ? null : formatDecimal(totalCost, TOTAL_COST.scale),
      sourceText,
    });
  }
  return { lines, unparsed };
}

function unavailable(): ModuleError {
  return new ModuleError(
    503,
    "draft_unavailable",
    "No pudimos analizar el texto. Probá de nuevo o cargalo a mano.",
  );
}

/** `POST /api/modules/stock/entries/draft` — `{ text }`. `provider` se inyecta en los tests; la
 * ruta usa el del entorno. */
export async function buildDraft(
  businessId: string,
  userId: string,
  body: Record<string, unknown>,
  provider?: StockDraftProvider,
): Promise<{ draft: Draft }> {
  const input = typeof body.text === "string" ? body.text.trim() : "";
  if (input.length === 0 || input.length > MAX_TEXT) {
    throw new ModuleError(
      422,
      "invalid_text",
      `El texto tiene que tener entre 1 y ${MAX_TEXT} caracteres.`,
    );
  }
  const db = getDb();
  const record = (
    values: Partial<typeof stockDraftRequests.$inferInsert> & {
      provider: string;
      status: "ok" | "failed";
    },
  ) =>
    db.insert(stockDraftRequests).values({
      businessId,
      createdByUserId: userId,
      inputChars: input.length,
      ...values,
    });

  let resolved: StockDraftProvider;
  try {
    resolved = provider ?? stockDraftProviderFromEnv();
  } catch (error) {
    if (!(error instanceof DraftProviderUnavailableError)) throw error;
    await record({ provider: "unconfigured", status: "failed" });
    throw unavailable();
  }
  const items = await db
    .select({ id: stockItems.id, name: stockItems.name, unit: stockItems.unit })
    .from(stockItems)
    .where(
      and(
        eq(stockItems.businessId, businessId),
        eq(stockItems.status, "active"),
      ),
    )
    .orderBy(asc(sql`lower(${stockItems.name})`))
    .limit(MAX_ITEMS_FOR_MODEL);

  let raw: RawDraft;
  try {
    raw = await resolved.draft({ text: input, items });
  } catch (error) {
    console.warn("stock_draft_failed", {
      provider: resolved.id,
      name: error instanceof Error ? error.name : typeof error,
    });
    await record({
      provider: resolved.id,
      model: resolved.model,
      status: "failed",
    });
    throw unavailable();
  }
  const draft = normalizeDraft(raw, items);
  await record({
    provider: resolved.id,
    model: resolved.model,
    status: "ok",
    lineCount: draft.lines.length,
    inputTokens: raw.usage.inputTokens,
    outputTokens: raw.usage.outputTokens,
  });
  return { draft };
}

/** Pedidos de borrador del negocio desde `since` (para el tope futuro y el portal de admin). */
export async function draftsSince(
  businessId: string,
  since: Date,
): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(stockDraftRequests)
    .where(
      and(
        eq(stockDraftRequests.businessId, businessId),
        gte(stockDraftRequests.createdAt, since),
      ),
    );
  return Number(row.n);
}
