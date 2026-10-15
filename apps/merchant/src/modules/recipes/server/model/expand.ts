import type {
  FrozenRecipeIngredient,
  ResolvedRecipeComponent,
} from "@mi-pasaporte/db/schema";
import { formatDecimal, fromDb, roundDiv } from "../../../decimal";
import { ModuleError } from "../../../errors";

export type IngredientRevision = {
  id: string;
  recipeId: string;
  name: string;
  lines: FrozenRecipeIngredient[];
};
export function expandComposition(
  components: ResolvedRecipeComponent[],
  revisions: IngredientRevision[],
  sold = 1,
) {
  if (!Number.isSafeInteger(sold) || sold < 1)
    throw new Error("Invalid sold quantity");
  const byRevision = new Map(revisions.map((r) => [r.id, r]));
  const sources = components.flatMap((c) => {
    const revision = byRevision.get(c.recipeRevisionId);
    if (!revision || revision.recipeId !== c.recipeId)
      throw new Error("Captured independent recipe revision unavailable");
    const recipeQuantity = fromDb(c.quantity, 3) * BigInt(sold);
    return revision.lines.map((ingredient) => ({
      ...ingredient,
      recipeId: c.recipeId,
      recipeRevisionId: c.recipeRevisionId,
      recipeName: revision.name,
      recipeQuantity: formatDecimal(recipeQuantity, 3),
      exact: fromDb(ingredient.quantity, 3) * recipeQuantity,
      allocated: 0n,
    }));
  });
  const byItem = new Map<string, typeof sources>();
  for (const source of sources) {
    if (source.exact <= 0n) throw new Error("Invalid ingredient snapshot");
    const list = byItem.get(source.itemId) ?? [];
    list.push(source);
    byItem.set(source.itemId, list);
  }
  const ingredients = [...byItem].map(([itemId, parts]) => {
    if (parts.some((p) => p.unit !== parts[0].unit))
      throw new Error("Inconsistent captured ingredient unit");
    const exact = parts.reduce((sum, p) => sum + p.exact, 0n),
      quantity = roundDiv(exact, 1000n);
    if (quantity >= 10n ** 14n)
      throw new ModuleError(
        422,
        "invalid_number",
        "La composición supera la cantidad máxima de un insumo.",
      );
    for (const part of parts) part.allocated = part.exact / 1000n;
    let remainder = quantity - parts.reduce((sum, p) => sum + p.allocated, 0n);
    const ordered = [...parts].sort((a, b) => {
      const x = a.exact % 1000n,
        y = b.exact % 1000n;
      return x > y
        ? -1
        : x < y
          ? 1
          : a.recipeId.localeCompare(b.recipeId) ||
            a.recipeRevisionId.localeCompare(b.recipeRevisionId);
    });
    for (const part of ordered)
      if (remainder > 0n) {
        part.allocated++;
        remainder--;
      }
    return {
      itemId,
      itemName: parts[0].itemName,
      unit: parts[0].unit,
      exactQuantity: formatDecimal(exact, 6),
      quantity: formatDecimal(quantity, 3),
    };
  });
  return {
    sources: sources.map((s) => ({
      itemId: s.itemId,
      itemName: s.itemName,
      unit: s.unit,
      recipeId: s.recipeId,
      recipeRevisionId: s.recipeRevisionId,
      recipeName: s.recipeName,
      recipeQuantity: s.recipeQuantity,
      exactQuantity: formatDecimal(s.exact, 6),
      allocatedQuantity: formatDecimal(s.allocated, 3),
    })),
    ingredients,
    rounding: ingredients
      .filter(
        (i) => fromDb(i.exactQuantity, 6) !== fromDb(i.quantity, 3) * 1000n,
      )
      .map((i) => ({
        itemId: i.itemId,
        exactQuantity: i.exactQuantity,
        quantity: i.quantity,
        reason:
          i.quantity === "0.000"
            ? ("rounded_to_zero" as const)
            : ("precision_changed" as const),
      })),
  };
}
