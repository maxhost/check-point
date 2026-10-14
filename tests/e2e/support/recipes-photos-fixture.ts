import { createRequire } from "node:module";
import path from "node:path";
import type { Page } from "@playwright/test";
import { businessModules } from "./modules-fixture";

export const flour = {
  id: "flour",
  name: "Harina",
  unit: "g",
  status: "active",
};
export const pizza = { productId: "pizza", productName: "Pizza", lineCount: 0 };
export const photoDraft = {
  yield: 10,
  lines: [
    {
      itemId: flour.id,
      name: flour.name,
      isNew: false,
      quantity: "7.5",
      unit: "g",
      sourceText: "75 g de harina",
    },
    {
      itemId: null,
      name: "Sal",
      isNew: true,
      quantity: null,
      unit: "g",
      sourceText: "Sal a gusto",
    },
  ],
  unparsed: ["Una cucharada de ingrediente ilegible"],
};

export async function recipePhotoFixture(page: Page) {
  const writes: unknown[] = [];
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: {
        membership: { role: "owner" },
        business: {
          enabledModules: ["stock", "recipes"],
          timezone: "America/Guayaquil",
          currencyCode: "USD",
        },
      },
    }),
  );
  await page.route("**/api/modules", (route) =>
    route.fulfill({ json: { modules: businessModules(true, true) } }),
  );
  await page.route("**/api/modules/recipes", (route) =>
    route.fulfill({ json: { recipes: [pizza] } }),
  );
  await page.route(/\/api\/modules\/stock\/items(?:\?|$)/, (route) =>
    route.fulfill({ json: { items: [flour] } }),
  );
  await page.route("**/api/modules/recipes/pizza", (route) => {
    if (route.request().method() === "PUT")
      writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { recipe: { ...pizza, lines: [] } } });
  });
  return writes;
}

export async function openPhotoRecipe(page: Page, url: string, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${url}/backoffice/recipes?surface=recipes`);
  await page.getByRole("button", { name: "Nueva receta", exact: true }).click();
  await page.getByRole("button", { name: "Pizza", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Pizza", exact: true });
  await dialog.getByRole("button", { name: "Foto", exact: true }).click();
  return dialog;
}

const merchantRequire = createRequire(
  path.resolve("apps/merchant/package.json"),
);
export const sharp = merchantRequire("sharp") as typeof import("sharp");
export async function recipeImage() {
  return {
    name: "receta.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 3000, height: 1800, channels: 3, background: "#efe7cf" },
    })
      .png()
      .toBuffer(),
  };
}
