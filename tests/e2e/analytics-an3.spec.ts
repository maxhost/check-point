import { expect, test } from "@playwright/test";
import {
  setupCustomerPromoHistory,
  setupCustomerPromoInbox,
  startAnalyticsHarness,
} from "./support/analytics-an3-fixture";
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
  test(`AN-3 customer/promo history period/local at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const fixture = await setupCustomerPromoHistory(page);
    await page.goto(`${harness.url}/backoffice/analytics`);
    await expect(
      page.getByRole("heading", { name: "Clientes del período" }),
    ).toBeVisible();
    await expect(page.getByText(/1 cliente registró 4 visitas/)).toBeVisible();
    await expect(page.getByText(/Café de la tarde:/)).toContainText("30,00");
    await expect(page.getByText(/Café de la tarde:/)).toContainText("140,00");
    await expect(
      page.getByText(/Estas ventas no indican que la promo/),
    ).toBeVisible();
    await page.getByRole("button", { name: /Período/ }).click();
    await page.getByRole("option", { name: "6 meses", exact: true }).click();
    await expect(page.getByText(/1 cliente registró 5 visitas/)).toBeVisible();
    await page.getByRole("button", { name: /Local/ }).click();
    await page.getByRole("option", { name: "Norte", exact: true }).click();
    await expect(
      page.getByText("No hay visitas registradas en este período y local."),
    ).toBeVisible();
    await expect(
      page.getByText("No hay promos registradas en este período y local."),
    ).toBeVisible();
    expect(
      fixture.reads.some(
        (q) => q.includes("period=6m") && q.includes("locationId=north"),
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/analytics-an3/history-${viewport.width}.png`,
      fullPage: true,
    });
  });
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`AN-3 inbox honors category decisions and parks customer marketing at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const fixture = await setupCustomerPromoInbox(page);
    await page.goto(harness.url);
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(
      page.getByText(
        "Juan solía venir cada 12 días. Su última visita fue hace 26 días.",
      ),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Ver cliente", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/Estas ventas no indican/)).toBeVisible();
    await page.screenshot({
      path: `test-results/analytics-an3/inbox-${viewport.width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", { name: "Más tickets anulados" }),
      })
      .getByRole("button", { name: "Ignorar", exact: true })
      .click();
    await expect(page.getByRole("article")).toHaveCount(1);
    await page
      .getByRole("link", { name: "Ver resultados", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/backoffice/marketing/${fixture.campaign}$`),
    );
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]).toMatch(/000000000010\/ignore$/);
  });
}
