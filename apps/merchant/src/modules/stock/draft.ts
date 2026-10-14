import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { stockItems } from "@mi-pasaporte/db/schema";
import { AiInputError, AiUnavailableError } from "../../server/ai/errors";
import { readAiImages } from "../../server/ai/image-input";
import { runAiTask } from "../../server/ai/service";
import type { AiImage, AiProvider } from "../../server/ai/task";
import { formatDecimal, parseDecimal } from "../decimal";
import { ModuleError } from "../errors";
import {
  ENTRY_PHOTO_INPUT,
  type RawEntryDraft,
  STOCK_ENTRY_PHOTO_TASK,
  STOCK_ENTRY_TEXT_TASK,
} from "./ai-tasks";
import { QUANTITY, TOTAL_COST } from "./numbers";

/**
 * Spec 0212 — EL BORRADOR DE UNA ENTRADA desde el texto dictado (o, spec 0223, desde 1 a 3 fotos).
 * La IA propone y el dueño confirma con `POST /entries` (ADR 0082): aca no se escribe stock. La IA
 * pasa por el servicio del core (spec 0224), que registra el USO en `core.ai_request`, sin el texto
 * ni la foto.
 *
 * Todo lo que devuelve el modelo se valida contra el negocio de la sesion: un `itemId` que no es un
 * insumo activo de ESTE negocio nunca sale como existente.
 */

export type DraftInventoryItem = { id: string; name: string; unit: string };

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
  raw: RawEntryDraft,
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

/** 503 `draft_unavailable`, con la copia del dictado o de la foto (spec 0223). La usa Recetas. */
export function draftUnavailable(photo: boolean): ModuleError {
  return new ModuleError(
    503,
    "draft_unavailable",
    photo
      ? "No pudimos analizar la foto. Probá de nuevo o cargalo a mano."
      : "No pudimos analizar el texto. Probá de nuevo o cargalo a mano.",
  );
}

/** `AiInputError` (fotos invalidas) → el `ModuleError` del contrato, mismo status/codigo/mensaje.
 * La usa Recetas. */
export function photoInputError(error: unknown): unknown {
  return error instanceof AiInputError
    ? new ModuleError(error.status, error.code, error.message)
    : error;
}

/** La lista de insumos que ve el modelo (contexto del servidor, no cuenta en `input_chars`). */
export function inventoryForModel(items: DraftInventoryItem[]): string {
  return (
    items
      .map(
        (item) => `- id=${item.id} | ${item.name} | unidad base ${item.unit}`,
      )
      .join("\n") || "(ninguno)"
  );
}

/** `POST /api/modules/stock/entries/draft` — `{ text }`. `provider` se inyecta en los tests; la
 * ruta usa el del entorno. */
export async function buildDraft(
  businessId: string,
  userId: string,
  body: Record<string, unknown>,
  provider?: AiProvider,
): Promise<{ draft: Draft }> {
  const input = typeof body.text === "string" ? body.text.trim() : "";
  if (input.length === 0 || input.length > MAX_TEXT) {
    throw new ModuleError(
      422,
      "invalid_text",
      `El texto tiene que tener entre 1 y ${MAX_TEXT} caracteres.`,
    );
  }
  return runDraft(businessId, userId, { text: input, photos: [] }, provider);
}

/** `POST /api/modules/stock/entries/draft-photo` — spec 0223: 1 a 3 fotos → el MISMO borrador que el
 * dictado. Las fotos invalidas cortan antes de la IA y sin registrar. */
export async function buildPhotoDraft(
  businessId: string,
  userId: string,
  request: Request,
  provider?: AiProvider,
): Promise<{ draft: Draft }> {
  let photos: AiImage[];
  try {
    photos = await readAiImages(request, ENTRY_PHOTO_INPUT);
  } catch (error) {
    throw photoInputError(error);
  }
  return runDraft(businessId, userId, { text: "", photos }, provider);
}

async function runDraft(
  businessId: string,
  userId: string,
  source: { text: string; photos: AiImage[] },
  provider: AiProvider | undefined,
): Promise<{ draft: Draft }> {
  const photo = source.photos.length > 0;
  const items = await getDb()
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
  const inventory = `INSUMOS EXISTENTES:\n${inventoryForModel(items)}`;
  try {
    const result = await runAiTask(
      photo ? STOCK_ENTRY_PHOTO_TASK : STOCK_ENTRY_TEXT_TASK,
      photo
        ? {
            context: `${inventory}\n\nFOTOS: ${source.photos.length}`,
            images: source.photos,
          }
        : { context: `${inventory}\n\nTEXTO DEL DUEÑO:`, text: source.text },
      { businessId, userId },
      { provider },
    );
    return { draft: normalizeDraft(result.output, items) };
  } catch (error) {
    if (error instanceof AiUnavailableError) throw draftUnavailable(photo);
    throw error;
  }
}
