import { validBasis, type BasisDraft } from "./composition-basis-draft";
import {
  countedQuantity,
  editableAmount,
  baseUnit,
  type EntryUnit,
  type StockItem,
} from "../../stock/ui/stock-types";

import type { LibraryRecipeDTO, RecipeCostListDTO } from "../server/contracts";

export type RecipeProduct = {
  productId: string;
  productName: string;
  isCombo: boolean;
  compositionRevisionId: string | null;
};
export type LibrarySummary = Omit<LibraryRecipeDTO, "lines"> & {
  lineCount: number;
};
export type RecipeSummary = RecipeCostListDTO["recipes"][number];

/** Intl groups the integer as BigInt; the server's exact fraction is preserved. */
export function recipeMoney(
  value: string,
  currencyCode: string,
  minorUnits: 0 | 2,
) {
  const negative = value.startsWith("-");
  const [integer, fraction = ""] = value.replace(/^-/, "").split(".");
  const magnitude = BigInt(integer);
  const signed = negative ? (magnitude === 0n ? -0 : -magnitude) : magnitude;
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "code",
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  })
    .formatToParts(signed)
    .map((part) =>
      part.type === "fraction" ? fraction.padEnd(minorUnits, "0") : part.value,
    )
    .join("");
}
export type RecipeComponent = {
  recipeId: string;
  recipeName: string;
  quantity: string;
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
export const compositionUrl = (id: string) =>
  `/api/modules/recipes/products/${encodeURIComponent(id)}/composition`;
export const recipeUrl = (id: string) =>
  `/api/modules/recipes/library/${encodeURIComponent(id)}`;
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
export function savedIngredients(recipe: LibraryRecipeDTO): RecipeLine[] {
  return recipe.lines.map((line, index) => ({
    key: `existing-${index}`,
    itemId: line.itemId,
    name: line.itemName,
    quantity: editableAmount(line.quantity),
    unit: line.unit as EntryUnit,
  }));
}

export function compositionPayload(
  isCombo: boolean,
  components: RecipeComponent[],
  expectedRevisionId: string | null,
  basis?: BasisDraft,
) {
  if (!components.length || components.length > (isCombo ? 50 : 1))
    throw new Error(
      isCombo ? "Añade entre 1 y 50 recetas." : "Elige una receta.",
    );
  const seen = new Set<string>();
  const recipes = components.map((component, index) => {
    if (seen.has(component.recipeId))
      throw new Error("Una receta aparece dos veces.");
    seen.add(component.recipeId);
    const quantity = component.quantity.trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0)
      throw new Error(
        `Receta ${index + 1}: usa una cantidad mayor que cero, con hasta 3 decimales.`,
      );
    countedQuantity(quantity, "unit");
    return { recipeId: component.recipeId, quantity };
  });
  return {
    isCombo,
    recipes,
    expectedRevisionId,
    ...(basis ? validBasis(basis) : {}),
  };
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

/** Canonical saved identity/body shared by initial load, partial persistence and review. */
export function savedRecipeState(
  recipe: LibraryRecipeDTO,
  existingItems: StockItem[] = [],
) {
  const resolved: StockItem[] = recipe.lines.map((line) => ({
    id: line.itemId,
    name: line.itemName,
    unit: line.unit as StockItem["unit"],
    status: line.itemStatus,
  }));
  const items = [
    ...existingItems.filter(
      (item) => !resolved.some((entry) => entry.id === item.id),
    ),
    ...resolved,
  ];
  const lines = savedIngredients(recipe);
  return {
    items,
    lines,
    body: JSON.stringify({
      name: recipe.name,
      lines: recipePayload(
        lines,
        items,
        recipe.lines.map((line) => line.itemId),
        true,
      ),
    }),
  };
}
export function reconcileRecipeDraft(
  recipe: LibraryRecipeDTO,
  draft: RecipeLine[],
  existingItems: StockItem[] = [],
) {
  const state = savedRecipeState(recipe, existingItems);
  return {
    ...state,
    lines: draft.map((line) => {
      const resolved = recipe.lines.find(
        (entry) => entry.itemName === line.name && entry.unit === line.unit,
      );
      return !line.itemId && resolved
        ? { ...line, itemId: resolved.itemId }
        : line;
    }),
  };
}
