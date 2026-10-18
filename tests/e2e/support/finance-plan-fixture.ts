import { defineConfig, type Page } from "@playwright/test";
import type { MonthlyFinance } from "../../../packages/domain/src/analytics/monthly-finance-contract";
import { buildHistory } from "../../../packages/domain/src/analytics/history";
import { analyticsInput, setupAnalytics } from "./analytics-fixture";
export { startAnalyticsHarness } from "./analytics-fixture";

export default defineConfig({
  testDir: "..",
  testMatch: [
    "finance-plan.spec.ts",
    "dashboard-summary.spec.ts",
    "analytics-layout.spec.ts",
    "analytics.spec.ts",
    "analytics-lifecycle.spec.ts",
    "stock-cost.spec.ts",
  ],
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "/private/tmp/checkpass-0241-evidence/ui/browser",
  use: { browserName: "chromium", headless: true },
});
export type FinanceScenario =
  "estimated" | "covered" | "unavailable" | "partial";
export function financeSnapshot(
  scenario: FinanceScenario = "estimated",
): MonthlyFinance {
  const finance: MonthlyFinance = {
    version: 2,
    from: "2026-10-01",
    to: "2026-10-31",
    asOf: "2026-10-20",
    status: "estimated",
    reasons: [],
    recordedExpensesMinor: 23000,
    pendingExpensesMinor: 28000,
    forecastExpensesMinor: 51000,
    monthRevenueMinor: 40000,
    monthContributionMinor: 30000,
    remainingSalesMinor: 28000,
    totalSalesTargetMinor: 68000,
    unitCoverage: 1,
    revenueCoverage: 1,
    referenceFrom: "2026-09-22",
    referenceTo: "2026-10-19",
    expenses: [
      {
        id: "rent",
        label: "Alquiler del local",
        kind: "fixed",
        recordedMinor: 20000,
        referenceMinor: 45000,
        referenceMonths: 1,
        pendingMinor: 25000,
        forecastMinor: 45000,
      },
      {
        id: "variables",
        label: "Gastos variables",
        kind: "variable",
        recordedMinor: 3000,
        referenceMinor: 6000,
        referenceMonths: 2,
        pendingMinor: 3000,
        forecastMinor: 6000,
      },
    ],
  };
  if (scenario === "covered")
    return {
      ...finance,
      status: "covered",
      recordedExpensesMinor: 51000,
      pendingExpensesMinor: 0,
      monthRevenueMinor: 80000,
      monthContributionMinor: 60000,
      remainingSalesMinor: 0,
      totalSalesTargetMinor: 80000,
      expenses: finance.expenses.map((e) => ({
        ...e,
        recordedMinor: e.referenceMinor!,
        pendingMinor: 0,
      })),
    };
  if (scenario === "unavailable")
    return {
      ...finance,
      status: "unavailable",
      reasons: ["sales_costs"],
      monthContributionMinor: null,
      remainingSalesMinor: null,
      totalSalesTargetMinor: null,
      unitCoverage: 0.5,
      revenueCoverage: 0.1,
    };
  if (scenario === "partial")
    return {
      ...finance,
      status: "unavailable",
      reasons: ["expense_history"],
      recordedExpensesMinor: 32000,
      pendingExpensesMinor: null,
      forecastExpensesMinor: null,
      remainingSalesMinor: null,
      totalSalesTargetMinor: null,
      expenses: [
        ...finance.expenses,
        {
          id: "new",
          label: "Equipo nuevo sin referencia histórica",
          kind: "fixed",
          recordedMinor: 9000,
          referenceMinor: null,
          referenceMonths: 0,
          pendingMinor: null,
          forecastMinor: null,
        },
      ],
    };
  return finance;
}
export async function setupFinancePlan(
  page: Page,
  scenario: FinanceScenario = "estimated",
  absent = false,
) {
  await setupAnalytics(page);
  const reads: string[] = [];
  await page.route(/\/api\/analytics\/history\?/, (route) => {
    const url = new URL(route.request().url());
    reads.push(url.search);
    const data = buildHistory(
      analyticsInput,
      (url.searchParams.get("period") ?? "month") as "month",
      url.searchParams.get("locationId") || undefined,
    );
    const finance = financeSnapshot(
      url.searchParams.get("locationId") === "north" ? "partial" : scenario,
    );
    return route.fulfill({
      json: {
        ...data,
        fixedExpensesMinor:
          url.searchParams.get("period") === "3m" ? 70000 : 23000,
        goal: { ...data.goal, ...(absent ? {} : { finance }) },
        recentMovements: [
          {
            id: "sale",
            date: "2026-10-20",
            kind: "sale",
            label: "Venta registrada",
            amountMinor: 15000,
          },
          {
            id: "expense",
            date: "2026-10-19",
            kind: "expense",
            label: "Pago parcial de alquiler",
            amountMinor: 20000,
          },
        ],
      },
    });
  });
  return { reads };
}
export async function setupSummary(page: Page, unavailable = false) {
  await setupAnalytics(page);
  const reads: string[] = [];
  await page.route("**/api/analytics/summary", (route) => {
    reads.push(route.request().url());
    return route.fulfill({
      json: {
        version: 1,
        date: "2026-10-20",
        timezone: "America/Guayaquil",
        currencyCode: "USD",
        minorUnit: 2,
        readAt: "2026-10-20T17:00:00Z",
        monthBreakEvenMinor: unavailable ? null : 68000,
        dailyBreakEvenMinor: unavailable ? null : 2194,
        todayRevenueMinor: 0,
        estimated: !unavailable,
        unavailableReason: unavailable ? "cost_coverage" : null,
      },
    });
  });
  return { reads };
}
