import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { recipesLocalFixture } from "./support/recipes-local-fixture";
import { chooseLocal } from "./support/stock-local-fixture";

let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/modules-ui-harness.tsx",
    "recipes",
  );
});
test.afterAll(async () => {
  if (harness) await harness.close();
});
for (const width of [390, 1280]) {
  test(`Costo del local, elección retenida al guardar y cantidades por unidad (${width})`, async ({
    page,
  }, info) => {
    const { reads, writes } = await recipesLocalFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${harness.url}/backoffice/recipes?surface=recipes`);
    await expect(
      page.getByText("Costo de ingredientes: 7,5", { exact: true }),
    ).toBeVisible();
    await chooseLocal(page, "Norte");
    await expect(
      page.getByText("Costo de ingredientes: 15", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`recipes-local-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Editar receta de Pizza", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Pizza", exact: true });
    await expect(
      dialog.getByRole("textbox", {
        name: "Cantidad por unidad del producto",
        exact: true,
      }),
    ).toHaveValue("250");
    await dialog
      .getByRole("button", { name: "Guardar receta", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toEqual([
      {
        locationId: "second",
        lines: [{ itemId: "flour", quantity: "250", unit: "g" }],
      },
    ]);
    await expect(
      page.getByRole("button", { name: "Local", exact: false }),
    ).toContainText("Norte");
    await expect(
      page.getByText("Costo de ingredientes: 15", { exact: true }),
    ).toBeVisible();
    expect(reads[0]).toBe("first");
    expect(reads.slice(1).every((id) => id === "second")).toBe(true);
    await chooseLocal(page, "Sur · Archivado");
    await expect.poll(() => reads.includes("archived")).toBe(true);
  });
}
