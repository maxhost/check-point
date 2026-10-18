import { describe, expect, it } from "vitest";
import { buildDashboardSummary } from "./dashboard-summary-calculation";
import { parseDashboardSummary } from "./dashboard-summary";
import { addDays, addMonths, monthStart, localDay } from "./date";
import type { AnalyticsInput, AnalyticsMetric } from "./types";

const now = new Date("2026-10-20T01:00:00Z");
function fixture(
  today = "2026-10-20",
  currencyCode = "USD",
  minorUnit = 2,
): AnalyticsInput & { timezone: string; metrics: AnalyticsMetric[] } {
  const row = (
    day: string,
    metric: string,
    amountMinor: number,
    quantity = 0,
    count = 1,
  ): AnalyticsMetric => ({
    day,
    metric,
    amountMinor,
    quantity,
    count,
    dimensionId: "product",
    locationId: "local",
    currencyCode,
    minorUnit,
  });
  const recent = addDays(today, -1);
  return {
    today,
    timezone: "America/Mexico_City",
    currencyCode,
    minorUnit,
    labels: [],
    locations: [],
    hasClosedExpenseMonth: true,
    metrics: [
      row(recent, "units_sold", 0, 10),
      row(recent, "units_with_cost", 0, 10),
      row(recent, "revenue", 1000),
      row(recent, "product_revenue", 1000),
      row(recent, "payment_commission", 0),
      row(recent, "revenue_with_cost", 1000),
      row(recent, "cost_of_goods", 500),
      row(recent, "payment_commission_with_cost", 0),
      row(today.slice(0, 8) + "01", "expense_fixed", 101),
      row(addMonths(monthStart(today), -1), "expense_fixed", 101),
      row(addMonths(monthStart(today), -1), "expense_variable", 1),
    ],
  } satisfies AnalyticsInput & { timezone: string };
}

describe("dashboard projection summary", () => {
  it.each([
    ["2025-02-20", 28],
    ["2024-02-20", 29],
    ["2026-04-20", 30],
    ["2026-10-20", 31],
  ] as const)("uses calendar denominator for %s", (date, days) => {
    const result = buildDashboardSummary(fixture(date), now);
    expect(result.monthBreakEvenMinor).toBe(1000); // current net contribution already covers forecast102
    // Summary retains the calendar average of the dynamic total-sales target.
    expect(result.dailyBreakEvenMinor).toBe(Math.ceil(1000 / days));
    expect(parseDashboardSummary(result)).toEqual(result);
  });
  it.each([
    ["USD", 2],
    ["JPY", 0],
    ["KWD", 3],
  ] as const)("preserves %s minor units and zero sales", (currency, unit) => {
    const result = buildDashboardSummary(
      fixture("2026-10-20", currency, unit),
      now,
    );
    expect(result).toMatchObject({
      currencyCode: currency,
      minorUnit: unit,
      todayRevenueMinor: 0,
    });
  });
  it("sums net revenue across locations only on the supplied local day", () => {
    const input = fixture(localDay(now, "America/Mexico_City"));
    const sample = input.metrics[0]!;
    input.metrics.push(
      { ...sample, day: input.today, metric: "revenue", amountMinor: 300 },
      {
        ...sample,
        day: input.today,
        metric: "revenue",
        locationId: "north",
        amountMinor: -50,
      },
      { ...sample, day: "2026-10-20", metric: "revenue", amountMinor: 999 },
    );
    expect(buildDashboardSummary(input, now)).toMatchObject({
      date: "2026-10-19",
      todayRevenueMinor: 250,
    });
  });
  it("keeps unknown equilibrium null with accurate reasons", () => {
    const first = fixture();
    first.hasClosedExpenseMonth = false;
    first.metrics = first.metrics.filter(
      (r) => !r.metric.startsWith("expense_") || r.day.startsWith("2026-10"),
    );
    expect(buildDashboardSummary(first, now)).toMatchObject({
      monthBreakEvenMinor: null,
      dailyBreakEvenMinor: null,
      unavailableReason: "expense_history",
    });
    const missing = fixture();
    missing.metrics = missing.metrics.filter(
      (r) => r.metric !== "units_with_cost",
    );
    expect(buildDashboardSummary(missing, now).unavailableReason).toBe(
      "cost_coverage",
    );
    const inexact = fixture();
    inexact.metrics = inexact.metrics.filter(
      (r) => r.metric !== "payment_commission_with_cost",
    );
    expect(buildDashboardSummary(inexact, now).unavailableReason).toBe(
      "cost_coverage",
    );
    const negative = fixture();
    negative.metrics.find((r) => r.metric === "cost_of_goods")!.amountMinor =
      1100;
    expect(buildDashboardSummary(negative, now).unavailableReason).toBe(
      "positive_margin",
    );
  });
  it("preserves estimated expense semantics and rejects unsafe arithmetic", () => {
    const input = fixture();
    input.metrics.find((r) => r.metric === "expense_fixed")!.day = "2026-09-01";
    expect(buildDashboardSummary(input, now).estimated).toBe(true);
    const row = {
      ...input.metrics[0]!,
      day: input.today,
      metric: "revenue",
      amountMinor: Number.MAX_SAFE_INTEGER,
    };
    input.metrics.push(row, { ...row, amountMinor: 1 });
    expect(() => buildDashboardSummary(input, now)).toThrow();
  });
  it("validates transport including nullable amounts, timezone and date", () => {
    const good = buildDashboardSummary(fixture(), now);
    for (const patch of [
      { todayRevenueMinor: undefined },
      { todayRevenueMinor: 1.1 },
      { dailyBreakEvenMinor: null },
      { timezone: "Invalid/Zone" },
      { date: "2026-02-30" },
      { unavailableReason: "other" },
    ]) {
      expect(() => parseDashboardSummary({ ...good, ...patch })).toThrow();
    }
  });
});
