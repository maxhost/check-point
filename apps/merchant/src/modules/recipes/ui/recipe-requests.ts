import { panelRequest } from "../../../app/backoffice/panel-request";
import type { RecipeCostListDTO } from "../server/contracts";
import { type LibrarySummary, type RecipeProduct } from "./recipe-types";

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
