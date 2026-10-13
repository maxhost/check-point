import { and, eq, inArray } from "drizzle-orm";
import { withDbTransaction } from "@mi-pasaporte/db";
import { recipeLines, stockItems } from "@mi-pasaporte/db/schema";
import { isUuid, pgErrorCode } from "@mi-pasaporte/domain/server/counter/core";
import { formatDecimal, parseDecimal } from "../decimal";
import { ModuleError, invalidBody } from "../errors";
import { QUANTITY } from "../stock/numbers";
import {
  MAX_RECIPE_LINES,
  type RecipeDTO,
  itemNotFound,
  linesOf,
  ownProduct,
  toRecipe,
} from "./read";

export {
  MAX_RECIPE_LINES,
  type RecipeDTO,
  type RecipeLineDTO,
  type RecipeSummary,
  listRecipes,
  ownProduct,
  readRecipe,
} from "./read";

/**
 * Spec 0210 §Recetas + 0214 — GUARDAR una receta. Una linea es `{ itemId | newItem: { name },
 * quantity, unit? }`: sin `unit`, la cantidad va en la unidad base del insumo (contrato original);
 * con `unit` (`g | kg | ml | l | unit`) se convierte; `newItem` (exige `unit`) crea el insumo en la
 * misma transaccion. Es lo que guarda el borrador del dictado en un paso.
 */

const UNITS: Record<string, { base: string; factor: bigint }> = {
  g: { base: "g", factor: 1n },
  kg: { base: "g", factor: 1000n },
  ml: { base: "ml", factor: 1n },
  l: { base: "ml", factor: 1000n },
  unit: { base: "unit", factor: 1n },
};
/** `numeric(14,3)`: la cantidad convertida tiene que ser menor que 10^11. */
const QUANTITY_LIMIT = 10n ** 14n;
const MAX_NAME = 80;

/** Linea con insumo existente: `{ itemId, quantity }` (+ `base` si vino `unit`). Linea nueva:
 * `{ newName, base, quantity }`. `quantity` siempre en la unidad base, escala 3. */
export type NewLine =
  | { itemId: string; quantity: bigint; base?: string }
  | { newName: string; base: string; quantity: bigint };

function lineError(index: number, status: number, code: string, msg: string) {
  return new ModuleError(status, code, `Línea ${index + 1}: ${msg}`, {
    line: index,
  });
}

/** Valida `{ lines: [...] }` sin tocar la base. */
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
  return body.lines.map((raw: unknown, index: number): NewLine => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw invalidBody();
    const line = raw as Record<string, unknown>;
    const hasNew = line.newItem !== undefined && line.newItem !== null;
    if (hasNew && line.itemId !== undefined && line.itemId !== null) {
      throw lineError(
        index,
        422,
        "invalid_line",
        "tiene que traer un insumo existente o uno nuevo, no los dos.",
      );
    }
    let unit: { base: string; factor: bigint } | undefined;
    if (line.unit !== undefined && line.unit !== null) {
      unit = typeof line.unit === "string" ? UNITS[line.unit] : undefined;
      if (!unit) {
        throw lineError(
          index,
          422,
          "invalid_unit",
          "la unidad tiene que ser g, kg, ml, l o unit.",
        );
      }
    }
    const said = parseDecimal(line.quantity, QUANTITY);
    if (said <= 0n) {
      throw new ModuleError(
        422,
        "invalid_quantity",
        "La cantidad tiene que ser mayor que cero.",
      );
    }
    const quantity = said * (unit?.factor ?? 1n);
    if (quantity >= QUANTITY_LIMIT) {
      throw lineError(
        index,
        422,
        "invalid_number",
        "la cantidad es demasiado alta.",
      );
    }
    if (hasNew) {
      const rawName = (line.newItem as Record<string, unknown>)?.name;
      const name = typeof rawName === "string" ? rawName.trim() : "";
      if (name.length === 0 || name.length > MAX_NAME) {
        throw lineError(
          index,
          422,
          "invalid_name",
          `el nombre del insumo tiene que tener entre 1 y ${MAX_NAME} caracteres.`,
        );
      }
      if (!unit) {
        throw lineError(
          index,
          422,
          "invalid_unit",
          "un insumo nuevo necesita su unidad.",
        );
      }
      return { newName: name, base: unit.base, quantity };
    }
    if (!isUuid(line.itemId)) throw itemNotFound();
    const itemId = (line.itemId as string).trim().toLowerCase();
    if (seen.has(itemId)) {
      throw new ModuleError(
        422,
        "duplicate_item",
        "Un insumo aparece dos veces en la receta.",
      );
    }
    seen.add(itemId);
    return unit ? { itemId, quantity, base: unit.base } : { itemId, quantity };
  });
}

/**
 * `PUT /api/modules/recipes/:productId` — reemplaza la receta entera en una transaccion, con la fila
 * del producto bloqueada (`FOR UPDATE`). `lines: []` la borra. Un insumo archivado que NO estaba en
 * la receta → 409 `item_archived`; uno que ya estaba se conserva. Todo o nada: un error no deja
 * insumos nuevos creados.
 */
export async function saveRecipe(
  businessId: string,
  rawProductId: unknown,
  body: Record<string, unknown>,
): Promise<RecipeDTO> {
  const lines = parseRecipeLines(body);
  try {
    return await withDbTransaction(async (tx) => {
      const product = await ownProduct(tx, businessId, rawProductId, true);
      const ids = lines.flatMap((l) => ("itemId" in l ? [l.itemId] : []));
      const items = ids.length
        ? await tx
            .select({
              id: stockItems.id,
              status: stockItems.status,
              unit: stockItems.unit,
              name: stockItems.name,
            })
            .from(stockItems)
            .where(
              and(
                eq(stockItems.businessId, businessId),
                inArray(stockItems.id, ids),
              ),
            )
        : [];
      if (items.length !== ids.length) throw itemNotFound();
      const byId = new Map(items.map((i) => [i.id, i]));
      for (const [index, line] of lines.entries()) {
        if (!("itemId" in line) || line.base === undefined) continue;
        const item = byId.get(line.itemId);
        if (item && item.unit !== line.base) {
          throw lineError(
            index,
            422,
            "unit_mismatch",
            `${item.name} se mide en ${item.unit}.`,
          );
        }
      }
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
      // Insumos nuevos: el mismo nombre (sin mayusculas) dentro de la receta crea UNO.
      const created = new Map<string, string>();
      const resolved: { itemId: string; quantity: bigint }[] = [];
      for (const line of lines) {
        if ("itemId" in line) {
          resolved.push({ itemId: line.itemId, quantity: line.quantity });
          continue;
        }
        const key = line.newName.toLowerCase();
        let itemId = created.get(key);
        if (!itemId) {
          const [row] = await tx
            .insert(stockItems)
            .values({ businessId, name: line.newName, unit: line.base })
            .returning({ id: stockItems.id });
          itemId = row.id;
          created.set(key, itemId);
        }
        resolved.push({ itemId, quantity: line.quantity });
      }
      if (new Set(resolved.map((r) => r.itemId)).size !== resolved.length) {
        throw new ModuleError(
          422,
          "duplicate_item",
          "Un insumo aparece dos veces en la receta.",
        );
      }
      await tx.delete(recipeLines).where(eq(recipeLines.productId, product.id));
      if (resolved.length > 0) {
        await tx.insert(recipeLines).values(
          resolved.map((line, position) => ({
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
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      throw new ModuleError(
        409,
        "item_name_taken",
        "Ya hay un insumo activo con ese nombre: elegilo de la lista.",
      );
    }
    throw error;
  }
}
