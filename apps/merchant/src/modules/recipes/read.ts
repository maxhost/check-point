import { and, asc, eq, sql } from "drizzle-orm";
import { type DbTransaction, getDb } from "@mi-pasaporte/db";
import {
  products,
  recipeLines,
  stockItems,
  stockItemLocations,
} from "@mi-pasaporte/db/schema";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { formatDecimal, fromDb } from "../decimal";
import { ModuleError } from "../errors";
import { resolveLocation } from "../stock/local";
import { UNIT_COST_SCALE } from "../stock/numbers";
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
  locationId: string | null;
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
export type Db = DbTransaction | ReturnType<typeof getDb>;

export const productNotFound = () =>
  new ModuleError(404, "product_not_found", "Ese producto no existe.");
export const itemNotFound = () =>
  new ModuleError(404, "item_not_found", "Ese insumo no existe.");

/** Las lineas del negocio (o de un producto), con su insumo, en el orden de la receta. */
export async function linesOf(
  db: Db,
  businessId: string,
  productId?: string,
  locationId?: string | null,
) {
  return db
    .select({
      productId: recipeLines.productId,
      itemId: recipeLines.itemId,
      quantity: recipeLines.quantity,
      itemName: stockItems.name,
      unit: stockItems.unit,
      itemStatus: stockItems.status,
      unitCost: stockItemLocations.lastUnitCost,
    })
    .from(recipeLines)
    .innerJoin(
      stockItems,
      and(
        eq(stockItems.id, recipeLines.itemId),
        eq(stockItems.businessId, businessId),
      ),
    )
    .leftJoin(
      stockItemLocations,
      and(
        eq(stockItemLocations.businessId, businessId),
        eq(stockItemLocations.itemId, stockItems.id),
        locationId ? eq(stockItemLocations.locationId, locationId) : sql`false`,
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
  locationId: string | null = null,
): RecipeSummary {
  return {
    productId: product.id,
    productName: product.name,
    locationId,
    ...summarizeCost(product.unitPrice, lines),
  };
}

export function toRecipe(
  product: { id: string; name: string; unitPrice: string | null },
  lines: LineRow[],
  locationId: string | null = null,
): RecipeDTO {
  return {
    ...summaryOf(product, lines, locationId),
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

export async function ownProduct(
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
  rawLocationId?: unknown,
): Promise<RecipeSummary[]> {
  const db = getDb();
  const locationId = (await resolveLocation(businessId, rawLocationId)).id;
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
    linesOf(db, businessId, undefined, locationId),
  ]);
  const byProduct = new Map<string, LineRow[]>();
  for (const line of lines) {
    const list = byProduct.get(line.productId) ?? [];
    list.push(line);
    byProduct.set(line.productId, list);
  }
  return catalog.map((p) =>
    summaryOf(p, byProduct.get(p.id) ?? [], locationId),
  );
}

/** `GET /api/modules/recipes/:productId`. */
export async function readRecipe(
  businessId: string,
  rawProductId: unknown,
  rawLocationId?: unknown,
): Promise<RecipeDTO> {
  const db = getDb();
  const product = await ownProduct(db, businessId, rawProductId, false);
  const locationId = (await resolveLocation(businessId, rawLocationId)).id;
  return toRecipe(
    product,
    await linesOf(db, businessId, product.id, locationId),
    locationId,
  );
}
