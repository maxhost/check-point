import { addDays, addMonths, daysBetween, monthStart } from "./date";
import { calculateGoal, contribution, products } from "./cards/index";
import type { AnalyticsInput, AnalyticsMetric } from "./types";
export const HISTORY_PERIODS = ["month", "3m", "6m", "9m", "12m"] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];
export function historyRange(today: string, period: HistoryPeriod) {
  const months = period === "month" ? 1 : Number(period.slice(0, -1));
  const from = addMonths(monthStart(today), -(months - 1));
  const to = today;
  const days = daysBetween(from, to) + 1;
  return {
    from,
    to,
    previousFrom: addDays(from, -days),
    previousTo: addDays(from, -1),
    annualFrom: addMonths(from, -12),
    annualTo: addMonths(to, -12),
  };
}
function summarize(input: AnalyticsInput, rows: readonly AnalyticsMetric[]) {
  const c = contribution(input, rows);
  const tickets = rows
    .filter((r) => r.metric === "revenue")
    .reduce((n, r) => n + r.count, 0);
  const expense = (metric: string) =>
    rows
      .filter((r) => r.metric === metric)
      .reduce((n, r) => n + r.amountMinor, 0);
  const fixedExpensesMinor = expense("expense_fixed");
  const variableExpensesMinor = expense("expense_variable");
  return {
    revenueMinor: Math.round(c.revenue),
    tickets,
    averageTicketMinor: tickets ? Math.round(c.revenue / tickets) : 0,
    grossProfitMinor: Math.round(c.grossProfit),
    coverage: c.coverage,
    fixedExpensesMinor,
    variableExpensesMinor,
    resultMinor:
      c.coverage >= 0.8
        ? Math.round(c.grossProfit - fixedExpensesMinor - variableExpensesMinor)
        : null,
    topProducts: products(input, rows)
      .sort((a, b) => b.revenue - a.revenue || a.id.localeCompare(b.id))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        label: p.label,
        revenueMinor: Math.round(p.revenue),
        units: p.units,
      })),
  };
}
export function buildHistory(
  input: AnalyticsInput,
  period: HistoryPeriod,
  locationId?: string,
) {
  const range = historyRange(input.today, period);
  const rows = locationId
    ? input.metrics.filter((r) => r.locationId === locationId)
    : input.metrics;
  const within = (from: string, to: string) =>
    rows.filter((r) => r.day >= from && r.day <= to);
  const current = summarize(input, within(range.from, range.to));
  const previous = summarize(
    input,
    within(range.previousFrom, range.previousTo),
  );
  const annualRows = within(range.annualFrom, range.annualTo);
  const annualDays = new Set(annualRows.map((r) => r.day));
  const annualComplete =
    annualDays.size === daysBetween(range.annualFrom, range.annualTo) + 1;
  return {
    period,
    ...range,
    locationId: locationId ?? null,
    currencyCode: input.currencyCode,
    minorUnit: input.minorUnit,
    ...current,
    previous: {
      revenueMinor: previous.revenueMinor,
      variation:
        previous.revenueMinor > 0
          ? (current.revenueMinor - previous.revenueMinor) /
            previous.revenueMinor
          : null,
    },
    annual: annualComplete ? summarize(input, annualRows) : null,
    goal: calculateGoal({ ...input, metrics: rows }),
    locations: input.locations,
  };
}
export function buildDay(
  input: AnalyticsInput,
  date: string,
  locationId?: string,
) {
  const rows = input.metrics.filter(
    (r) => r.day === date && (!locationId || r.locationId === locationId),
  );
  return {
    date,
    locationId: locationId ?? null,
    currencyCode: input.currencyCode,
    minorUnit: input.minorUnit,
    ...summarize(input, rows),
    products: products(input, rows)
      .sort((a, b) => b.revenue - a.revenue)
      .map((p) => ({
        id: p.id,
        label: p.label,
        revenueMinor: Math.round(p.revenue),
        units: p.units,
      })),
    locations: input.locations,
  };
}
