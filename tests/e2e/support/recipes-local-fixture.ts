import type { Page } from "@playwright/test";
import { recipePhotoFixture } from "./recipes-photos-fixture";
import { localLocations } from "./stock-local-fixture";

export async function recipesLocalFixture(page: Page) {
  const writes = await recipePhotoFixture(page);
  const reads: string[] = [];
  await page.route("**/api/modules/recipes/locations", (route) =>
    route.fulfill({
      json: { locations: localLocations, defaultLocationId: "first" },
    }),
  );
  const recipe = (locationId: string) => ({
    productId: "pizza",
    productName: "Pizza",
    lineCount: 1,
    cost: locationId === "second" ? "15.00" : "7.50",
    costComplete: true,
    lines: [
      {
        itemId: "flour",
        itemName: "Harina",
        itemStatus: "active",
        quantity: "250.000",
        unit: "g",
      },
    ],
  });
  await page.route(/\/api\/modules\/recipes(?:\?|$)/, (route) => {
    const id =
      new URL(route.request().url()).searchParams.get("locationId") ?? "";
    reads.push(id);
    return route.fulfill({ json: { recipes: [recipe(id)] } });
  });
  await page.route(/\/api\/modules\/recipes\/pizza(?:\?|$)/, (route) => {
    if (route.request().method() === "PUT")
      writes.push(route.request().postDataJSON());
    return route.fulfill({
      json: {
        recipe: recipe(
          new URL(route.request().url()).searchParams.get("locationId") ?? "",
        ),
      },
    });
  });
  return { writes, reads };
}
