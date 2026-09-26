import { expect } from "@playwright/test";
import { test, help, title } from "./support/catalog-tour-fixture";
import { catalogApiFixture } from "./support/catalog-api-fixture";

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

for (const task of ["Editar un producto", "Eliminar un producto"] as const) {
  test(`${task}: permite ajustar un filtro vacío y seleccionar la segunda fila`, async ({
    page,
    catalogHarness,
  }) => {
    const api = await catalogApiFixture(page);
    await page.goto(catalogHarness);
    const search = page.getByRole("searchbox", { name: "Buscar producto" });
    await search.fill("inexistente");
    await help(page, task);
    await expect(title(page)).toHaveText("Elegí qué querés gestionar");
    await search.click({ timeout: 2000 });
    await search.fill("Torta");
    const row = page.locator('[data-catalog-id="product-second"]');
    await expect(row).toBeVisible();
    await row
      .getByRole("button", {
        name: task.startsWith("Editar") ? "Editar" : "Borrar",
        exact: true,
      })
      .click();
    if (task.startsWith("Editar")) {
      await expect(
        page.getByRole("textbox", { name: "Nombre del producto" }),
      ).toHaveValue("Torta");
    } else {
      await expect(
        page.getByRole("alertdialog").getByRole("heading"),
      ).toContainText("Torta");
    }
    expect(api.writes).toEqual([]);
  });
}
