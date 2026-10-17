import { expect, test } from "@playwright/test";
import {
  setupStockHistory,
  startAnalyticsHarness,
} from "./support/analytics-an2-fixture";
let harness: Awaited<ReturnType<typeof startAnalyticsHarness>>;
test.beforeAll(async () => {
  harness = await startAnalyticsHarness();
});
test.afterAll(async () => {
  await harness.close();
});
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`AN-2 stock history keeps values, missing costs and local/period filters at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const fixture = await setupStockHistory(page);
    await page.goto(`${harness.url}/backoffice/analytics`);
    await expect(
      page.getByRole("heading", { name: "Stock e insumos" }),
    ).toBeVisible();
    await expect(page.getByText(/Valor conocido del stock/)).toContainText(
      "24,20",
    );
    await expect(
      page.getByText(/Falta conocer el costo de 1 insumo/),
    ).toBeVisible();
    await expect(page.getByText(/varió en promedio/)).toContainText("21");
    await page.getByRole("button", { name: /Local/ }).click();
    await page.getByRole("option", { name: "Centro", exact: true }).click();
    await expect(page.getByText(/Valor del stock al/)).toContainText("24,20");
    await page.getByRole("button", { name: /Período/ }).click();
    await page.getByRole("option", { name: "6 meses", exact: true }).click();
    await expect
      .poll(() =>
        fixture.reads.some(
          (q) => q.includes("period=6m") && q.includes("locationId=local"),
        ),
      )
      .toBe(true);
    await expect(page.getByText(/varió en promedio/)).toContainText("21");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/analytics-an2/stock-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /Local/ }).click();
    await page.getByRole("option", { name: "Norte", exact: true }).click();
    await expect(
      page.getByText(/Todavía no hay existencias con costo registrado/),
    ).toBeVisible();
    await expect(
      page.getByText(/al menos dos costos registrados/),
    ).toBeVisible();
  });
}
