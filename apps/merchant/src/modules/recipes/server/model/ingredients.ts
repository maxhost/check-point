import {
  stockItems,
  independentRecipeLines,
  type FrozenRecipeIngredient,
} from "@mi-pasaporte/db/schema";
import { type DbTransaction } from "@mi-pasaporte/db";
import { and, eq, inArray } from "drizzle-orm";
import { formatDecimal } from "../../../decimal";
import { ModuleError } from "../../../errors";
import { notFound } from "./common";
import { type NewLine } from "./input";

export async function resolveIngredients(
  tx: DbTransaction,
  businessId: string,
  recipeId: string,
  lines: NewLine[],
): Promise<FrozenRecipeIngredient[]> {
  const ids = lines.flatMap((l) => ("itemId" in l ? [l.itemId] : []));
  const items = ids.length
    ? await tx
        .select()
        .from(stockItems)
        .where(
          and(
            eq(stockItems.businessId, businessId),
            inArray(stockItems.id, ids),
          ),
        )
        .orderBy(stockItems.id)
        .for("key share")
    : [];
  if (items.length !== ids.length) throw notFound("item");
  const previous = await tx
    .select()
    .from(independentRecipeLines)
    .where(
      and(
        eq(independentRecipeLines.businessId, businessId),
        eq(independentRecipeLines.recipeId, recipeId),
      ),
    );
  const retained = new Set(previous.map((l) => l.itemId)),
    byId = new Map(items.map((i) => [i.id, i]));
  const created = new Map<string, typeof stockItems.$inferSelect>();
  const result: FrozenRecipeIngredient[] = [];
  for (const line of lines) {
    let item: typeof stockItems.$inferSelect;
    if ("itemId" in line) {
      item = byId.get(line.itemId)!;
      if (line.base !== undefined && line.base !== item.unit)
        throw new ModuleError(
          422,
          "unit_mismatch",
          `${item.name} se mide en ${item.unit}.`,
        );
      if (item.status !== "active" && !retained.has(item.id))
        throw new ModuleError(
          409,
          "item_archived",
          "Ese insumo está archivado.",
        );
    } else {
      const key = line.newName.toLowerCase();
      const existing = created.get(key);
      if (existing) item = existing;
      else {
        const [row] = await tx
          .insert(stockItems)
          .values({ businessId, name: line.newName, unit: line.base })
          .returning();
        item = row;
        created.set(key, row);
      }
    }
    if (result.some((l) => l.itemId === item.id))
      throw new ModuleError(
        422,
        "duplicate_item",
        "Un insumo aparece dos veces en la receta.",
      );
    result.push({
      itemId: item.id,
      itemName: item.name,
      unit: item.unit,
      quantity: formatDecimal(line.quantity, 3),
    });
  }
  return result;
}
