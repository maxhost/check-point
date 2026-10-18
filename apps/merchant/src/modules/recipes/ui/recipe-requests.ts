import { panelRequest } from "../../../app/backoffice/panel-request";
import type {
  LibraryRecipeDTO,
  ProductCompositionDTO,
  RecipeCostListDTO,
} from "../server/contracts";
import {
  compositionUrl,
  recipeUrl,
  type LibrarySummary,
  type RecipeProduct,
} from "./recipe-types";

async function allPages<T>(url: string, key: string): Promise<T[]> {
  const entries: T[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "100", status: "all" });
    if (cursor) query.set("cursor", cursor);
    const page: { [key: string]: T[] | string | null } = await panelRequest(
      `${url}?${query}`,
    );
    entries.push(...(page[key] as T[]));
    cursor = page.nextCursor as string | null;
  } while (cursor);
  return entries;
}

export async function loadRecipes(locationId: string) {
  const [products, library, costs] = await Promise.all([
    allPages<RecipeProduct>("/api/modules/recipes/products", "products"),
    allPages<LibrarySummary>("/api/modules/recipes/library", "recipes"),
    panelRequest<RecipeCostListDTO>(
      `/api/modules/recipes/costs?${new URLSearchParams({ locationId })}`,
    ),
  ]);
  return { products, library, ...costs };
}

/** Consult only: adopting the returned revision remains an explicit editor action. */
export async function loadRecipeReview(
  productId: string,
  target: "composition" | "library" | "unknown-library" | null,
  recipeId: string | null,
  name: string,
): Promise<ProductCompositionDTO | LibraryRecipeDTO> {
  if (target === "unknown-library") {
    const library = await allPages<LibrarySummary>(
      "/api/modules/recipes/library",
      "recipes",
    );
    const candidates = library.filter(
      (entry) => entry.name === name.trim() && entry.status === "active",
    );
    if (candidates.length !== 1)
      throw new Error(
        "No podemos identificar una única receta guardada. Revisa la biblioteca antes de continuar; tu borrador permanece aquí.",
      );
    recipeId = candidates[0].id;
  }
  if ((target === "library" || target === "unknown-library") && recipeId)
    return (
      await panelRequest<{ recipe: LibraryRecipeDTO }>(recipeUrl(recipeId))
    ).recipe;
  return (
    await panelRequest<{ composition: ProductCompositionDTO }>(
      compositionUrl(productId),
    )
  ).composition;
}
