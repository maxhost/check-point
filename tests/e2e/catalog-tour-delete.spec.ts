import { expect } from "@playwright/test";
import { test, title, help } from "./support/catalog-tour-fixture";
import { catalogApiFixture } from "./support/catalog-api-fixture";

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

for (const kind of ["producto", "categoría"] as const) {
  test(`eliminar ${kind}: entidad elegida, cancelar sin borrar y confirmación explícita`, async ({
    page,
    catalogHarness,
  }) => {
    const api = await catalogApiFixture(page);
    const id = kind === "producto" ? "product-second" : "category-second";
    const name = kind === "producto" ? "Torta" : "Postres";
    await page.goto(catalogHarness);
    await help(
      page,
      `Eliminar ${kind === "producto" ? "un producto" : "una categoría"}`,
    );
    await page
      .locator(`[data-catalog-id="${id}"]`)
      .getByRole("button", { name: "Borrar", exact: true })
      .click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading")).toContainText(name);
    expect(api.writes).toEqual([]);
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page.locator(".driver-popover")).toHaveCount(0);
    expect(api.writes).toEqual([]);
    await help(
      page,
      `Eliminar ${kind === "producto" ? "un producto" : "una categoría"}`,
    );
    await page
      .locator(`[data-catalog-id="${id}"]`)
      .getByRole("button", { name: "Borrar", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Borrar", exact: true }).click();
    await expect(title(page)).toHaveText("Operación confirmada");
    expect(api.writes).toEqual([
      {
        method: "DELETE",
        path: `/api/catalog/${kind === "producto" ? "product" : "category"}/${id}`,
        body: {},
      },
    ]);
    if (kind === "categoría") expect(api.products[1].categoryId).toBeNull();
    expect(api.progress).toEqual([]);
  });
}
