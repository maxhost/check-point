import { panelRequest } from "../../../app/backoffice/panel-request";
import type { ProductCompositionDTO } from "../server/contracts";
import {
  compositionUrl,
  type LibrarySummary,
  type RecipeProduct,
  type RecipeSummary,
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

export async function loadRecipes() {
  const [products, library] = await Promise.all([
    allPages<RecipeProduct>("/api/modules/recipes/products", "products"),
    allPages<LibrarySummary>("/api/modules/recipes/library", "recipes"),
  ]);
  const recipes: RecipeSummary[] = [];
  // Keep concurrent detail reads bounded for businesses with a large catalog.
  const configured = products.filter(
    (product) => product.compositionRevisionId,
  );
  for (let offset = 0; offset < configured.length; offset += 10) {
    const rows = await Promise.all(
      configured.slice(offset, offset + 10).map(async (product) => {
        const { composition } = await panelRequest<{
          composition: ProductCompositionDTO;
        }>(compositionUrl(product.productId));
        if (!composition.recipes.length) return null;
        return {
          ...product,
          isCombo: composition.isCombo,
          ingredientCount: composition.recipes.reduce(
            (count, component) =>
              count +
              (library.find((entry) => entry.id === component.recipeId)
                ?.lineCount ?? 0),
            0,
          ),
          recipeCount: composition.recipes.length,
        };
      }),
    );
    for (const row of rows) if (row) recipes.push(row);
  }
  return { products, library, recipes };
}
