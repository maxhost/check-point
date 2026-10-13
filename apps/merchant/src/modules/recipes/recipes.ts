import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "@mi-pasaporte/db";
import { products, recipeLines, stockItems } from "@mi-pasaporte/db/schema";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { formatDecimal, fromDb, parseDecimal } from "../decimal";
import { ModuleError, invalidBody } from "../errors";
import { QUANTITY, UNIT_COST_SCALE } from "../stock/numbers";
import { type CostSummary, lineCostOf, summarizeCost } from "./cost";

/**
 * Spec 0210 §Recetas — LA RECETA de un producto del catalogo: lineas insumo + cantidad, y su costo
 * y margen calculados (`cost.ts`). Todo filtra por el negocio de la sesion: un producto ajeno es 404
 * `product_not_found` y un insumo ajeno 404 `item_not_found`. El modulo no escribe tablas del core
 * (`core.product.unit_cost` queda intacto).
 */

export type RecipeSummary = CostSummary & {
  productId: string;
  productName: string;
};
export type RecipeLineDTO = {
  itemId: string;
  itemName: string;
  unit: string;
  itemStatus: "active" | "archived";
  quantity: string;
  unitCost: string | null;
  lineCost: string | null;
};
export type RecipeDTO = RecipeSummary & { lines: RecipeLineDTO[] };

export const MAX_RECIPE_LINES = 50;
type Db = DbTransaction | ReturnType<typeof getDb>;

const productNotFound = () =>
  new ModuleError(404, "product_not_found", "Ese producto no existe.");
const itemNotFound = () =>
  new ModuleError(404, "item_not_found", "Ese insumo no existe.");

/** Las lineas del negocio (o de un producto), con su insumo, en el orden de la receta. */
async function linesOf(db: Db, businessId: string, productId?: string) {
  return db
    .select({
      productId: recipeLines.productId,
      itemId: recipeLines.itemId,
      quantity: recipeLines.quantity,
      itemName: stockItems.name,
      unit: stockItems.unit,
      itemStatus: stockItems.status,
      unitCost: stockItems.lastUnitCost,
    })
    .from(recipeLines)
    .innerJoin(
      stockItems,
      and(
        eq(stockItems.id, recipeLines.itemId),
        eq(stockItems.businessId, businessId),
      ),
    )
    .where(
      and(
        eq(recipeLines.businessId, businessId),
        productId === undefined
          ? undefined
          : eq(recipeLines.productId, productId),
      ),
    )
    .orderBy(asc(recipeLines.productId), asc(recipeLines.position));
}

type LineRow = Awaited<ReturnType<typeof linesOf>>[number];

function summaryOf(
  product: { id: string; name: string; unitPrice: string | null },
  lines: LineRow[],
): RecipeSummary {
  return {
    productId: product.id,
    productName: product.name,
    ...summarizeCost(product.unitPrice, lines),
  };
}

function toRecipe(
  product: { id: string; name: string; unitPrice: string | null },
  lines: LineRow[],
): RecipeDTO {
  return {
    ...summaryOf(product, lines),
    lines: lines.map((line) => ({
      itemId: line.itemId,
      itemName: line.itemName,
      unit: line.unit,
      itemStatus: line.itemStatus === "archived" ? "archived" : "active",
      quantity: formatDecimal(fromDb(line.quantity, 3), 3),
      unitCost:
        line.unitCost === null
          ? null
          : formatDecimal(
              fromDb(line.unitCost, UNIT_COST_SCALE),
              UNIT_COST_SCALE,
            ),
      lineCost: lineCostOf(line),
    })),
  };
}

async function ownProduct(
  db: Db,
  businessId: string,
  rawId: unknown,
  lock: boolean,
) {
  if (!isUuid(rawId)) throw productNotFound();
  const query = db
    .select({
      id: products.id,
      name: products.name,
      unitPrice: products.unitPrice,
    })
    .from(products)
    .where(
      and(
        eq(products.id, (rawId as string).trim()),
        eq(products.businessId, businessId),
      ),
    )
    .limit(1);
  const [row] = lock ? await query.for("update") : await query;
  if (!row) throw productNotFound();
  return row;
}

/** `GET /api/modules/recipes` — TODOS los productos del catalogo, con o sin receta, por nombre. */
export async function listRecipes(
  businessId: string,
): Promise<RecipeSummary[]> {
  const db = getDb();
  const [catalog, lines] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        unitPrice: products.unitPrice,
      })
      .from(products)
      .where(eq(products.businessId, businessId))
      .orderBy(asc(sql`lower(${products.name})`), asc(products.id)),
    linesOf(db, businessId),
  ]);
  const byProduct = new Map<string, LineRow[]>();
  for (const line of lines) {
    const list = byProduct.get(line.productId) ?? [];
    list.push(line);
    byProduct.set(line.productId, list);
  }
  return catalog.map((p) => summaryOf(p, byProduct.get(p.id) ?? []));
}

/** `GET /api/modules/recipes/:productId`. */
export async function readRecipe(
  businessId: string,
  rawProductId: unknown,
): Promise<RecipeDTO> {
  const db = getDb();
  const product = await ownProduct(db, businessId, rawProductId, false);
  return toRecipe(product, await linesOf(db, businessId, product.id));
}

type NewLine = { itemId: string; quantity: bigint };

/** Valida `{ lines: [{ itemId, quantity }] }` sin tocar la base. */
export function parseRecipeLines(body: Record<string, unknown>): NewLine[] {
  if (!Array.isArray(body.lines))
    throw invalidBody("`lines` tiene que ser una lista.");
  if (body.lines.length > MAX_RECIPE_LINES) {
    throw new ModuleError(
      422,
      "too_many_lines",
      `Una receta puede tener hasta ${MAX_RECIPE_LINES} insumos.`,
    );
  }
  const seen = new Set<string>();
  return body.lines.map((raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw invalidBody();
    const line = raw as Record<string, unknown>;
    if (!isUuid(line.itemId)) throw itemNotFound();
    const itemId = (line.itemId as string).trim().toLowerCase();
    const quantity = parseDecimal(line.quantity, QUANTITY);
    if (quantity <= 0n) {
      throw new ModuleError(
        422,
        "invalid_quantity",
        "La cantidad tiene que ser mayor que cero.",
      );
    }
    if (seen.has(itemId)) {
      throw new ModuleError(
        422,
        "duplicate_item",
        "Un insumo aparece dos veces en la receta.",
      );
    }
    seen.add(itemId);
    return { itemId, quantity };
  });
}

/**
 * `PUT /api/modules/recipes/:productId` — reemplaza la receta entera en una transaccion, con la fila
 * del producto bloqueada (`FOR UPDATE`). `lines: []` la borra. Un insumo archivado que NO estaba en
 * la receta → 409 `item_archived`; uno que ya estaba se conserva.
 */
export async function saveRecipe(
  businessId: string,
  rawProductId: unknown,
  body: Record<string, unknown>,
): Promise<RecipeDTO> {
  const lines = parseRecipeLines(body);
  return withDbTransaction(async (tx) => {
    const product = await ownProduct(tx, businessId, rawProductId, true);
    const ids = lines.map((l) => l.itemId);
    const items = ids.length
      ? await tx
          .select({ id: stockItems.id, status: stockItems.status })
          .from(stockItems)
          .where(
            and(
              eq(stockItems.businessId, businessId),
              inArray(stockItems.id, ids),
            ),
          )
      : [];
    if (items.length !== ids.length) throw itemNotFound();
    const current = new Set(
      (
        await tx
          .select({ itemId: recipeLines.itemId })
          .from(recipeLines)
          .where(eq(recipeLines.productId, product.id))
      ).map((r) => r.itemId),
    );
    if (items.some((i) => i.status === "archived" && !current.has(i.id))) {
      throw new ModuleError(
        409,
        "item_archived",
        "Ese insumo está archivado. Reactívalo para sumarlo a una receta.",
      );
    }
    await tx.delete(recipeLines).where(eq(recipeLines.productId, product.id));
    if (lines.length > 0) {
      await tx.insert(recipeLines).values(
        lines.map((line, position) => ({
          businessId,
          productId: product.id,
          itemId: line.itemId,
          quantity: formatDecimal(line.quantity, QUANTITY.scale),
          position,
        })),
      );
    }
    return toRecipe(product, await linesOf(tx, businessId, product.id));
  });
}
