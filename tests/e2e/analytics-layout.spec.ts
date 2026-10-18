import { expect, test } from "@playwright/test";
import {
  analyticsInput,
  setupAnalytics,
  startAnalyticsHarness,
} from "./support/analytics-fixture";
import { financeSnapshot } from "./support/finance-plan-fixture";
import { buildHistory } from "../../packages/domain/src/analytics/history";
let harness: Awaited<ReturnType<typeof startAnalyticsHarness>>;
test.beforeAll(async () => {
  harness = await startAnalyticsHarness();
});
test.afterAll(async () => {
  await harness.close();
});
const section = (page: import("@playwright/test").Page, name: string) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .last();
for (const width of [390, 768, 1440]) {
  test(`analytics composition, losses and long names at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setupAnalytics(page);
    const data = buildHistory(analyticsInput, "month");
    await page.route(/\/api\/analytics\/history\?/, (route) =>
      route.fulfill({
        json: {
          ...data,
          coverage: 1,
          grossProfitMinor: 10000,
          costOfGoodsMinor: 11000,
          fixedExpensesMinor: 20000,
          variableExpensesMinor: 0,
          resultMinor: -10000,
          previous: { revenueMinor: 30000, variation: -0.3 },
          topProducts: [
            {
              id: "long",
              label:
                "Café de especialidad con leche y acompañamiento para compartir en familia",
              units: 40,
              revenueMinor: 21000,
            },
          ],
          customers: { count: 12, visits: 30, returning: 4 },
          promos: [
            {
              id: "promo",
              label: "Descuento de clientes frecuentes",
              discountMinor: 1000,
              salesMinor: 12000,
              costMinor: 500,
            },
          ],
          recentMovements: [
            {
              id: "sale-1",
              date: "2026-10-20",
              kind: "sale",
              label: "Venta registrada",
              amountMinor: 21000,
            },
            {
              id: "expense-1",
              date: "2026-10-19",
              kind: "expense",
              label: "Alquiler del local principal",
              amountMinor: 20000,
            },
            {
              id: "expense-2",
              date: "2026-10-18",
              kind: "expense",
              label: "Servicios",
              amountMinor: 10000,
            },
          ],
          goal: {
            ...data.goal,
            finance: {
              ...financeSnapshot(),
              recordedExpensesMinor: 20000,
              pendingExpensesMinor: 10000,
              forecastExpensesMinor: 30000,
              monthRevenueMinor: 21000,
              monthContributionMinor: 10000,
              remainingSalesMinor: 40000,
              totalSalesTargetMinor: 61000,
              expenses: [
                {
                  id: "rent",
                  label: "Alquiler",
                  kind: "fixed",
                  recordedMinor: 20000,
                  referenceMinor: 20000,
                  referenceMonths: 1,
                  pendingMinor: 0,
                  forecastMinor: 20000,
                },
                {
                  id: "variables",
                  label: "Gastos variables",
                  kind: "variable",
                  recordedMinor: 0,
                  referenceMinor: 10000,
                  referenceMonths: 1,
                  pendingMinor: 10000,
                  forecastMinor: 10000,
                },
              ],
            },
            closedMonth: true,
            coverage: 1,
            concepts: [
              {
                id: "services",
                label: "Servicios",
                amountMinor: 10000,
                estimated: true,
              },
              {
                id: "rent",
                label: "Alquiler",
                amountMinor: 20000,
                estimated: false,
              },
            ],
            breakEvenMinor: 60000,
            monthRevenueMinor: 21000,
            margin: 0.5,
            expensesMinor: 30000,
            estimated: true,
            targetMinor: 3000,
            remainingDays: 13,
          },
        },
      }),
    );
    await page.goto(`${harness.url}/backoffice/analytics`);
    const sales = section(page, "Ventas del período");
    const profit = section(page, "Gastos");
    const goal = section(page, "Para cubrir los gastos del mes");
    await expect(sales).toContainText("30% menos");
    await expect(
      profit.locator("dd").filter({ hasText: "-" }).first(),
    ).toContainText("100");
    await expect(profit).toContainText("$0,00");
    await expect(goal).toContainText("Total previsto");
    await expect(
      goal.getByText("Margen de contribución", { exact: true }),
    ).toHaveCount(0);
    await expect(
      goal.getByRole("button", { name: "Ver detalle de gastos", exact: true }),
    ).toHaveCount(1);
    await expect(goal.getByRole("link")).toHaveCount(0);
    await expect(goal.getByRole("listitem")).toHaveCount(3);
    await expect(
      goal.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
    await expect(goal.getByText("Alquiler del local principal")).toBeVisible();
    await expect(goal.getByText("Servicios", { exact: true })).toBeVisible();
    await expect(page.getByText(/Estas ventas no indican/)).toBeVisible();
    const a = await profit.boundingBox();
    const b = await goal.boundingBox();
    if (width >= 1024) {
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
      expect(b!.x).toBeGreaterThan(a!.x + a!.width);
    } else {
      expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/private/tmp/checkpass-0241-evidence/ui/layout-${width}.png`,
      fullPage: true,
    });
  });
}
test("unknown costs and empty data remain explicit; filters and day still work", async ({
  page,
}) => {
  const fixture = await setupAnalytics(page);
  await page.goto(`${harness.url}/backoffice/analytics`);
  await expect(section(page, "Gastos")).toContainText("Pendiente");
  await expect(section(page, "Para cubrir los gastos del mes")).toContainText(
    "No hay movimientos recientes disponibles de este mes.",
  );
  await expect(
    page.getByText("Los costos de estas ventas todavía no están incluidos."),
  ).toBeVisible();
  await expect(page.getByText("Aún no podemos estimarlo")).toBeVisible();
  await page.getByRole("button", { name: /Período/ }).click();
  await page.getByRole("option", { name: "3 meses", exact: true }).click();
  await expect
    .poll(() => fixture.reads.some((q) => q.includes("period=3m")))
    .toBe(true);
  await page.getByRole("button", { name: /Local/ }).click();
  await page.getByRole("option", { name: "Norte", exact: true }).click();
  await expect(section(page, "Ventas del período")).toContainText("$0,00");
  await expect(
    page.getByText("No hay ventas de productos en este período."),
  ).toBeVisible();
  await page.goto(`${harness.url}/backoffice/analytics?date=2026-10-19`);
  await expect(
    page.getByText("El 2026-10-19 vendiste", { exact: false }),
  ).toBeVisible();
});
test("failed read stays recoverable", async ({ page }) => {
  await setupAnalytics(page);
  await page.route(/\/api\/analytics\/history\?/, (route) =>
    route.fulfill({ status: 500, json: {} }),
  );
  await page.goto(`${harness.url}/backoffice/analytics`);
  await expect(
    page.getByText("No pudimos leer este período. Intenta otra vez."),
  ).toBeVisible();
  await page.unroute(/\/api\/analytics\/history\?/);
  await setupAnalytics(page);
  await page.getByRole("button", { name: "Volver a intentar" }).click();
  await expect(
    page.getByRole("heading", { name: "Ventas del período" }),
  ).toBeVisible();
});
