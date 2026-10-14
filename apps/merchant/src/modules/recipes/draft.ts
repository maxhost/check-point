import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { stockItems } from "@mi-pasaporte/db/schema";
import { AiUnavailableError } from "../../server/ai/errors";
import { readAiImages } from "../../server/ai/image-input";
import { runAiTask } from "../../server/ai/service";
import type { AiImage, AiProvider } from "../../server/ai/task";
import { formatDecimal, parseDecimal, roundDiv } from "../decimal";
import { ModuleError } from "../errors";
import {
  type DraftInventoryItem,
  draftUnavailable,
  inventoryForModel,
  photoInputError,
} from "../stock/draft";
import { QUANTITY } from "../stock/numbers";
import {
  RECIPE_PHOTO_INPUT,
  RECIPE_PHOTO_TASK,
  RECIPE_TEXT_TASK,
  type RawRecipeDraft,
} from "./ai-tasks";
import { MAX_RECIPE_LINES, ownProduct } from "./recipes";

/**
 * Spec 0214 — EL BORRADOR DE UNA RECETA desde el texto dictado, POR UNA UNIDAD del producto. La IA
 * propone y el dueño confirma con el `PUT` de la receta (ADR 0082): aca no se escribe la receta. La IA
 * pasa por el servicio del core (spec 0224), que registra el USO en `core.ai_request`, sin el texto.
 *
 * Todo lo que devuelve el modelo se valida contra el negocio de la sesion: un `itemId` que no es un
 * insumo activo de ESTE negocio nunca sale como existente.
 */

const MAX_TEXT = 2000;
const MAX_ITEMS_FOR_MODEL = 300;
const MAX_YIELD = 10_000n;
const UNITS: Record<string, { base: "g" | "ml" | "unit"; factor: bigint }> = {
  g: { base: "g", factor: 1n },
  kg: { base: "g", factor: 1000n },
  ml: { base: "ml", factor: 1n },
  l: { base: "ml", factor: 1000n },
  unit: { base: "unit", factor: 1n },
};

export type RecipeDraftLine = {
  itemId: string | null;
  name: string;
  isNew: boolean;
  /** Por UNA unidad del producto, en la unidad base; null = sin cantidad («a gusto»). */
  quantity: string | null;
  unit: "g" | "ml" | "unit";
  sourceText: string;
};

export type RecipeDraft = {
  yield: number;
  lines: RecipeDraftLine[];
  unparsed: string[];
};

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseYield(raw: unknown): bigint {
  const n = typeof raw === "number" && Number.isInteger(raw) ? BigInt(raw) : 1n;
  return n >= 1n && n <= MAX_YIELD ? n : 1n;
}

/** Pura: valida, convierte a unidad base, divide por el rendimiento y junta repetidos. */
export function normalizeRecipeDraft(
  raw: RawRecipeDraft,
  items: DraftInventoryItem[],
): RecipeDraft {
  const byId = new Map(items.map((item) => [item.id, item]));
  const yieldN = parseYield(raw.yield);
  const unparsed = raw.unparsed
    .map((u) => text(u, 500))
    .filter((u) => u.length > 0);
  type Acc = Omit<RecipeDraftLine, "quantity"> & { quantity: bigint | null };
  const merged = new Map<string, Acc>();
  for (const value of raw.lines) {
    const line = (value ?? {}) as Record<string, unknown>;
    const sourceText = text(line.sourceText, 500);
    const reject = () => unparsed.push(sourceText || text(line.name, 80));
    const unit = typeof line.unit === "string" ? UNITS[line.unit] : undefined;
    if (!unit) {
      reject();
      continue;
    }
    let quantity: bigint | null = null;
    if (line.quantity !== null && line.quantity !== undefined) {
      try {
        const said = parseDecimal(line.quantity, QUANTITY);
        if (said <= 0n) throw new ModuleError(422, "invalid_quantity", "");
        const perUnit = roundDiv(said * unit.factor, yieldN);
        quantity = perUnit > 0n ? perUnit : null;
      } catch (error) {
        if (!(error instanceof ModuleError)) throw error;
        reject();
        continue;
      }
    }
    const match =
      typeof line.itemId === "string" ? byId.get(line.itemId) : undefined;
    const compatible = match !== undefined && match.unit === unit.base;
    const name = compatible ? match.name : text(line.name, 80);
    if (name.length === 0) {
      reject();
      continue;
    }
    const key = compatible
      ? `id:${match.id}`
      : `new:${name.toLowerCase()}:${unit.base}`;
    const previous = merged.get(key);
    if (previous) {
      // La receta no admite un insumo dos veces: se suman (una cantidad desconocida no suma).
      previous.quantity =
        previous.quantity === null
          ? quantity
          : quantity === null
            ? previous.quantity
            : previous.quantity + quantity;
      continue;
    }
    if (merged.size >= MAX_RECIPE_LINES) {
      reject();
      continue;
    }
    merged.set(key, {
      itemId: compatible ? match.id : null,
      name,
      isNew: !compatible,
      quantity,
      unit: unit.base,
      sourceText,
    });
  }
  return {
    yield: Number(yieldN),
    lines: [...merged.values()].map((line) => ({
      ...line,
      quantity:
        line.quantity === null
          ? null
          : formatDecimal(line.quantity, QUANTITY.scale),
    })),
    unparsed,
  };
}

type Product = Awaited<ReturnType<typeof ownProduct>>;

/** `POST /api/modules/recipes/:productId/draft` — `{ text }`. `provider` se inyecta en los tests. */
export async function buildRecipeDraft(
  businessId: string,
  userId: string,
  rawProductId: unknown,
  body: Record<string, unknown>,
  provider?: AiProvider,
): Promise<{ draft: RecipeDraft }> {
  const input = typeof body.text === "string" ? body.text.trim() : "";
  if (input.length === 0 || input.length > MAX_TEXT) {
    throw new ModuleError(
      422,
      "invalid_text",
      `El texto tiene que tener entre 1 y ${MAX_TEXT} caracteres.`,
    );
  }
  // El producto ANTES de la IA: uno ajeno es 404 sin gastar ni registrar uso.
  const product = await ownProduct(getDb(), businessId, rawProductId, false);
  return runRecipeDraft(
    businessId,
    userId,
    product,
    { text: input, photos: [] },
    provider,
  );
}

/** `POST /api/modules/recipes/:productId/draft-photo` — spec 0223: 1 a 3 fotos de la receta del
 * producto → el MISMO borrador que el dictado. El producto se valida UNA vez y ANTES de leer las
 * fotos; las fotos invalidas cortan antes de la IA y sin registrar. */
export async function buildRecipePhotoDraft(
  businessId: string,
  userId: string,
  rawProductId: unknown,
  request: Request,
  provider?: AiProvider,
): Promise<{ draft: RecipeDraft }> {
  const product = await ownProduct(getDb(), businessId, rawProductId, false);
  let photos: AiImage[];
  try {
    photos = await readAiImages(request, RECIPE_PHOTO_INPUT);
  } catch (error) {
    throw photoInputError(error);
  }
  return runRecipeDraft(
    businessId,
    userId,
    product,
    { text: "", photos },
    provider,
  );
}

async function runRecipeDraft(
  businessId: string,
  userId: string,
  product: Product,
  source: { text: string; photos: AiImage[] },
  provider: AiProvider | undefined,
): Promise<{ draft: RecipeDraft }> {
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
  const context = `PRODUCTO: ${product.name}\n\nINSUMOS EXISTENTES:\n${inventoryForModel(items)}`;
  try {
    const result = await runAiTask(
      photo ? RECIPE_PHOTO_TASK : RECIPE_TEXT_TASK,
      photo
        ? {
            context: `${context}\n\nFOTOS: ${source.photos.length}`,
            images: source.photos,
          }
        : { context: `${context}\n\nTEXTO DEL DUEÑO:`, text: source.text },
      { businessId, userId },
      { provider },
    );
    return { draft: normalizeRecipeDraft(result.output, items) };
  } catch (error) {
    if (error instanceof AiUnavailableError) throw draftUnavailable(photo);
    throw error;
  }
}
