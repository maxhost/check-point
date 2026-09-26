import { expect, test as base, type Page } from "@playwright/test";
import { startCatalogHarness } from "./catalog-harness-server";
export const test = base.extend<object, { catalogHarness: string }>({
  catalogHarness: [
    async ({ browserName }, use) => {
      void browserName;
      const harness = await startCatalogHarness();
      try {
        await use(harness.url);
      } finally {
        await harness.close();
      }
    },
    { scope: "worker" },
  ],
});
export const title = (page: Page) => page.locator(".driver-popover-title");
export const next = (page: Page) =>
  page.locator(".driver-popover-next-btn").click();
export async function help(page: Page, task: string) {
  await page.getByRole("button", { name: "Ayuda", exact: true }).click();
  await page
    .getByRole("dialog", { name: "¿Qué querés hacer?" })
    .getByRole("button", { name: task })
    .click();
  await expect(page.locator(".driver-popover")).toBeVisible();
}
export async function fieldsToSave(page: Page) {
  for (const expected of [
    "Completá el nombre",
    "Elegí una categoría",
    "Precio y costo son opcionales",
    "Imagen del producto",
  ]) {
    await expect(title(page)).toHaveText(expected);
    await next(page);
  }
  await expect(title(page)).toHaveText("Guardá los datos");
}
