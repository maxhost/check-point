import { defineConfig, type Page } from "@playwright/test";
import type { StockCostHistory } from "../../../packages/domain/src/analytics/stock-cost-contract";
import { buildHistory } from "../../../packages/domain/src/analytics/history";
import { analyticsInput, setupAnalytics } from "./analytics-fixture";
export { startAnalyticsHarness } from "./analytics-fixture";

export default defineConfig({
  testDir: "..",
  testMatch: ["stock-cost.spec.ts"],
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "/private/tmp/checkpass-0241-evidence/ui/stock-browser",
  use: { browserName: "chromium", headless: true },
});
// Baseline + sparse observations are real fixture events, never filled days.
export const stockCosts: StockCostHistory = {
  from: "2026-10-01",
  to: "2026-10-20",
  currencyCode: "USD",
  minorUnit: 2,
  defaultSeriesId: "flour-local",
  series: [
    {
      id: "flour-local",
      itemId: "flour",
      label: "Harina de trigo para pan artesanal con nombre largo",
      locationId: "local",
      locationName: "Centro",
      unit: "g",
      points: [
        { date: "2026-09-30", amountMinor: "0.1", isBaseline: true },
        { date: "2026-10-05", amountMinor: "0.125", isBaseline: false },
        { date: "2026-10-19", amountMinor: "0.15", isBaseline: false },
      ],
    },
    {
      id: "flour-north",
      itemId: "flour",
      label: "Harina",
      locationId: "north",
      locationName: "Norte",
      unit: "g",
      points: [
        { date: "2026-10-02", amountMinor: "0", isBaseline: false },
        { date: "2026-10-19", amountMinor: "0", isBaseline: false },
      ],
    },
    {
      id: "milk-local",
      itemId: "milk",
      label: "Leche",
      locationId: "local",
      locationName: "Centro",
      unit: "ml",
      points: [{ date: "2026-10-18", amountMinor: "0.2", isBaseline: false }],
    },
  ],
};
export async function setupStockCosts(page: Page, costs = stockCosts) {
  await setupAnalytics(page);
  const reads: string[] = [];
  await page.route(/\/api\/analytics\/history\?/, (route) => {
    const url = new URL(route.request().url());
    reads.push(url.search);
    const locationId = url.searchParams.get("locationId");
    const series = costs.series.filter(
      (s) => !locationId || s.locationId === locationId,
    );
    const defaultId =
      series.find((s) => s.points.length >= 2)?.id ?? series[0]?.id ?? null;
    const history = buildHistory(
      analyticsInput,
      (url.searchParams.get("period") ?? "month") as "month",
      locationId || undefined,
    );
    return route.fulfill({
      json: {
        ...history,
        stock: {
          ...history.stock,
          valueMinor: null,
          knownValueMinor: 1250,
          valuedItems: 1,
          unvaluedItems: 1,
          averageIncrease: 0.25,
          increaseDays: 1,
        },
        stockCosts: { ...costs, series, defaultSeriesId: defaultId },
      },
    });
  });
  return { reads };
}
