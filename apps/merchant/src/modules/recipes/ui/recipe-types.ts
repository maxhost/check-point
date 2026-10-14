import {
  countedQuantity,
  editableAmount,
  baseUnit,
  type EntryUnit,
  type StockItem,
} from "../../stock/ui/stock-types";

export type RecipeSummary = {
  productId: string;
  productName: string;
  lineCount: number;
  cost: string | null;
  costComplete: boolean;
};
export type RecipeDetail = RecipeSummary & {
  lines: {
    itemId: string;
    itemName: string;
    unit: EntryUnit;
    itemStatus: "active" | "archived";
    quantity: string;
  }[];
};
export type RecipeLine = {
  key: string;
  itemId: string | null;
  name: string;
  quantity: string;
  unit: EntryUnit;
  sourceText?: string;
};
export type RecipeDraft = {
  yield: number;
  lines: {
    itemId: string | null;
    name: string;
    isNew: boolean;
    quantity: string | null;
    unit: EntryUnit;
    sourceText: string;
  }[];
  unparsed: string[];
};
export const recipeUrl = (id: string) =>
  `/api/modules/recipes/${encodeURIComponent(id)}`;
export const recipeError = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : "No pudimos completar la acción. Intenta otra vez.";
export const blankIngredient = (key: string): RecipeLine => ({
  key,
  itemId: null,
  name: "",
  quantity: "",
  unit: "g",
});
export function draftIngredients(draft: RecipeDraft): RecipeLine[] {
  return draft.lines.map((line, index) => ({
    ...line,
    key: `draft-${index}`,
    quantity: editableAmount(line.quantity),
  }));
}
export function recipePayload(
  lines: RecipeLine[],
  items: StockItem[],
  retainedIds: string[] = [],
  allowEmpty = false,
) {
  if ((!allowEmpty && !lines.length) || lines.length > 50)
    throw new Error("Añade entre 1 y 50 ingredientes.");
  const seen = new Set<string>();
  return lines.map((line, index) => {
    try {
      const quantity = line.quantity.trim().replace(",", ".");
      if (!/^\d+(?:\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0)
        throw new Error(
          "Completa una cantidad mayor que cero, con hasta 3 decimales.",
        );
      countedQuantity(quantity, line.unit);
      const item = items.find((item) => item.id === line.itemId);
      if (
        line.itemId &&
        (!item ||
          (item.status === "archived" && !retainedIds.includes(item.id)))
      )
        throw new Error("Selecciona un insumo activo.");
      if (item && item.unit !== baseUnit(line.unit))
        throw new Error("La unidad no coincide con la del insumo.");
      const name = line.name.trim();
      if (!line.itemId && (!name || name.length > 80))
        throw new Error("El nombre debe tener entre 1 y 80 caracteres.");
      if (
        !line.itemId &&
        items.some(
          (item) =>
            item.status === "active" &&
            item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
      )
        throw new Error("Ese insumo ya existe. Selecciónalo en la lista.");
      const identity = line.itemId ?? `new:${name.toLocaleLowerCase()}`;
      if (seen.has(identity))
        throw new Error(
          "El ingrediente está repetido. Combina sus cantidades en una sola línea.",
        );
      seen.add(identity);
      return {
        ...(line.itemId ? { itemId: line.itemId } : { newItem: { name } }),
        quantity,
        unit: line.unit,
      };
    } catch (cause) {
      throw new Error(`Ingrediente ${index + 1}: ${recipeError(cause)}`);
    }
  });
}
