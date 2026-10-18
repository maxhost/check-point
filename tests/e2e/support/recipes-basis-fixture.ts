import { defineConfig, type Page } from "@playwright/test";
import path from "node:path";
import { startCatalogHarness } from "./catalog-harness-server";
export default defineConfig({
  testDir: "..",
  testMatch: "recipes-basis.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "/private/tmp/checkpass-pos-0242/recipes-basis-results",
  use: { browserName: "chromium", headless: true },
});
export const startRecipesHarness = () =>
  startCatalogHarness(
    path.resolve("tests/e2e/support/recipes-basis-harness.tsx"),
    "recipes",
  );
export const libraryRecipe = {
  id: "recipe-1",
  name: "Masa",
  revisionId: "library-1",
  status: "active",
  lines: [
    {
      itemId: "flour",
      itemName: "Harina",
      itemStatus: "active",
      unit: "g",
      quantity: "50",
    },
  ],
};
export const baseComposition = {
  productId: "bread",
  productName: "Pan",
  isCombo: false,
  revisionId: "composition-1",
  resolutionId: "resolution-1",
  recipes: [
    {
      recipeId: "recipe-1",
      recipeName: "Masa",
      recipeRevisionId: "library-1",
      quantity: "2",
      position: 0,
    },
  ],
};
export async function setupRecipes(
  page: Page,
  metadata: Record<string, unknown> = {},
  costStatus = "complete",
) {
  const writes: { url: string; body: Record<string, unknown> }[] = [];
  let composition = { ...baseComposition, ...metadata };
  let failure: number | "network" | null = null;
  let delay = 0;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (method !== "GET") {
      writes.push({ url: url.pathname, body: route.request().postDataJSON() });
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (url.pathname.endsWith("composition")) {
        if (failure === "network") return route.abort();
        if (failure)
          return route.fulfill({
            status: failure,
            json: {
              error: "Revisa el guardado",
              code:
                failure === 409
                  ? "composition_revision_conflict"
                  : "test_error",
            },
          });
        composition = {
          ...composition,
          ...route.request().postDataJSON(),
          revisionId: "composition-2",
        };
        return route.fulfill({ json: { composition } });
      }
      return route.fulfill({
        json: {
          recipe: {
            ...libraryRecipe,
            revisionId: "library-2",
            name: route.request().postDataJSON().name,
          },
        },
      });
    }
    if (url.pathname.endsWith("locations"))
      return route.fulfill({
        json: {
          locations: [
            { id: "center", name: "Centro", status: "active" },
            { id: "north", name: "Norte", status: "active" },
          ],
          defaultLocationId: "center",
        },
      });
    if (url.pathname.endsWith("composition"))
      return route.fulfill({ json: { composition } });
    if (url.pathname.endsWith("library/recipe-1"))
      return route.fulfill({ json: { recipe: libraryRecipe } });
    if (url.pathname.endsWith("library"))
      return route.fulfill({
        json: {
          recipes: [{ ...libraryRecipe, lineCount: 1 }],
          nextCursor: null,
        },
      });
    if (url.pathname.endsWith("products"))
      return route.fulfill({
        json: {
          products: [
            {
              productId: "bread",
              productName: "Pan",
              isCombo: false,
              compositionRevisionId: "composition-1",
            },
          ],
          nextCursor: null,
        },
      });
    if (url.pathname.endsWith("items"))
      return route.fulfill({
        json: {
          items: [{ id: "flour", name: "Harina", unit: "g", status: "active" }],
        },
      });
    if (url.pathname.endsWith("costs"))
      return route.fulfill({
        json: {
          locationId: url.searchParams.get("locationId"),
          currencyCode: "USD",
          minorUnits: 2,
          recipes: [
            {
              ...baseComposition,
              ...metadata,
              pricingUnit: "unit",
              costStatus,
              compositionRevisionId: "composition-1",
              ingredientCount: 1,
              recipeCount: 1,
              recipeCost: costStatus === "complete" ? "0.00" : null,
              price: "10.00",
              profit: costStatus === "complete" ? "10.00" : null,
              marginPercent: costStatus === "complete" ? "100.0" : null,
              missingCosts:
                costStatus === "missing_costs"
                  ? [{ itemId: "flour", itemName: "Harina" }]
                  : [],
            },
          ],
        },
      });
    return route.fulfill({
      status: 404,
      json: { error: "Unexpected fixture route" },
    });
  });
  return {
    writes,
    fail: (status: typeof failure) => {
      failure = status;
    },
    delay: (ms: number) => {
      delay = ms;
    },
    remote: (data: Record<string, unknown>) => {
      composition = { ...composition, ...data };
    },
  };
}
export async function editRecipe(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole("button", { name: "Editar receta de Pan" }).click();
  await page
    .getByRole("textbox", { name: "Cantidad de producto obtenido" })
    .waitFor();
  return page.getByRole("dialog");
}
export async function chooseUnit(page: Page, label: string) {
  await page
    .getByRole("button", { name: /Unidad del producto obtenido/ })
    .click();
  await page.getByRole("option", { name: label, exact: true }).click();
}
