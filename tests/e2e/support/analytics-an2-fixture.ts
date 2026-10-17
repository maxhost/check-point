import path from "node:path";
import { defineConfig, type Page } from "@playwright/test";
import { analyticsInput, setupAnalytics } from "./analytics-fixture";
import { buildHistory } from "../../../packages/domain/src/analytics/history";
import type { AnalyticsGauge } from "../../../packages/domain/src/analytics/types";
export { startAnalyticsHarness } from "./analytics-fixture";
export default defineConfig({
  testDir: "..",
  testMatch: ["analytics-an2.spec.ts"],
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: path.resolve("test-results/analytics-an2"),
  use: { browserName: "chromium", headless: true },
});
const gauge = (
  metric: string,
  day: string,
  quantity: string,
  amountMinor: string,
  locationId = "local",
): AnalyticsGauge => ({
  metric,
  day,
  locationId,
  dimensionId: "flour",
  amountMinor,
  quantity,
  unit: "kg",
  currencyCode: "USD",
  minorUnit: 2,
  observedAt: `${day}T12:00:00Z`,
  eventId: day,
});
export async function setupStockHistory(page: Page) {
  await setupAnalytics(page);
  const reads: string[] = [];
  const input = {
    ...analyticsInput,
    gauges: [
      gauge("stock_unit_cost", "2026-09-01", "0", "100"),
      gauge("stock_unit_cost", "2026-10-01", "0", "110"),
      gauge("stock_unit_cost", "2026-10-20", "0", "121"),
      gauge("stock_on_hand", "2026-10-20", "20", "0"),
      gauge("stock_on_hand", "2026-10-20", "3", "0", "north"),
    ],
  };
  await page.route(/\/api\/analytics\/history\?/, (route) => {
    const url = new URL(route.request().url());
    reads.push(url.search);
    return route.fulfill({
      json: buildHistory(
        input,
        (url.searchParams.get("period") ?? "month") as "month",
        url.searchParams.get("locationId") || undefined,
      ),
    });
  });
  return { reads };
}
