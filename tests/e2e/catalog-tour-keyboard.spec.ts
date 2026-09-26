import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { catalogApiFixture } from "./support/catalog-api-fixture";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness();
});
test.afterAll(async () => {
  await harness?.close();
});
test.use({ reducedMotion: "reduce" });

test("selector de categoría, foco y spotlight en móvil y escritorio", async ({
  page,
}) => {
  const api = await catalogApiFixture(page);
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(harness.url);
    await page.getByRole("button", { name: "Ayuda", exact: true }).click();
    await page.getByRole("button", { name: /Crear un producto/ }).click();
    await expect(page.locator(".driver-popover-title")).toHaveText(
      "Abrí el formulario",
    );
    await page.getByRole("button", { name: "Nuevo producto" }).click();
    await expect(page.locator(".driver-popover-title")).toHaveText(
      "Completá el nombre",
    );
    await page
      .getByRole("textbox", { name: "Nombre del producto" })
      .fill("Nuevo");
    await page.locator(".driver-popover-next-btn").click();
    await expect(page.locator(".driver-popover-title")).toHaveText(
      "Elegí una categoría",
    );
    await page
      .getByRole("button", { name: "Sin categoría Categoría", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Postres", exact: true })
      .click({ timeout: 3000 });
    await expect(
      page.getByRole("button", { name: "Postres Categoría", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    const focusedInside = await page.evaluate(() =>
      Boolean(
        document.activeElement?.closest(".staff-modal, .catalog-tour-popover"),
      ),
    );
    expect(focusedInside).toBe(true);
    await expect(
      page.locator('[data-tour="catalog-product-category"]'),
    ).toHaveClass(/driver-active-element/);
    await expect(page.locator(".driver-popover")).toHaveCSS("opacity", "1");
    const box = await page.locator(".driver-popover").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: test.info().outputPath(`product-guide-${width}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(page.locator(".driver-popover")).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Nombre del producto" }),
    ).toHaveValue("Nuevo");
  }
  expect(api.writes).toEqual([]);
  expect(api.progress).toEqual([]);
});
