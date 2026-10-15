export const MAX_RECIPE_LINES = 50;
export const MAX_COMPONENTS = 50;
export type RecipeCostListDTO = {
  locationId: string;
  currencyCode: string;
  minorUnits: 0 | 2;
  recipes: {
    productId: string;
    productName: string;
    isCombo: boolean;
    compositionRevisionId: string;
    resolutionId: string;
    ingredientCount: number;
    recipeCount: number;
    recipeCost: string | null;
    price: string | null;
    profit: string | null;
    marginPercent: string | null;
    missingCosts: { itemId: string; itemName: string }[];
  }[];
};
export type RecipeLineDTO = {
  itemId: string;
  itemName: string;
  itemStatus: "active" | "archived";
  unit: string;
  quantity: string;
};
export type LibraryRecipeDTO = {
  id: string;
  name: string;
  status: "active" | "archived";
  revisionId: string;
  lines: RecipeLineDTO[];
};
export type ProductCompositionDTO = {
  productId: string;
  productName: string;
  isCombo: boolean;
  revisionId: string | null;
  resolutionId: string | null;
  recipes: {
    recipeId: string;
    recipeName: string;
    recipeRevisionId: string;
    quantity: string;
    position: number;
  }[];
};
export type CompositionPreviewDTO = {
  productId: string;
  productName: string;
  isCombo: boolean;
  compositionRevisionId: string | null;
  resolutionId: null;
  components: {
    recipeId: string;
    recipeName: string;
    recipeRevisionId: string;
    quantity: string;
    ingredients: {
      itemId: string;
      itemName: string;
      unit: string;
      exactQuantity: string;
      allocatedQuantity: string;
    }[];
  }[];
  ingredients: {
    itemId: string;
    itemName: string;
    unit: string;
    exactQuantity: string;
    quantity: string;
  }[];
  rounding: {
    itemId: string;
    exactQuantity: string;
    quantity: string;
    reason: "rounded_to_zero" | "precision_changed";
  }[];
};
