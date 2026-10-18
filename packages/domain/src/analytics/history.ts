import { summarizeCustomerPromoHistory } from "./customer-promo-history";
import { summarizeStockHistory } from "./stock-history";
import { sumIntegers, moneyRatio } from "./money";
import { addDays, addMonths, daysBetween, monthStart } from "./date";
import { calculateGoal, contribution, products } from "./cards/index";
import type { AnalyticsInput, AnalyticsMetric } from "./types";
export type RecentMovement = {
  id: string;
  date: string;
  kind: "sale" | "expense";
  label: string;
  amountMinor: number;
};
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
export function summarizeHistory(
  input: AnalyticsInput,
  rows: readonly AnalyticsMetric[],
) {
  const c = contribution(input, rows);
  const tickets = rows
    .filter((r) => r.metric === "revenue")
    .map((r) => r.count);
  const ticketCount = sumIntegers(tickets);
  const expense = (metric: string) =>
    rows.filter((r) => r.metric === metric).map((r) => r.amountMinor);
  const fixedExpensesMinor = sumIntegers(expense("expense_fixed"));
  const variableExpensesMinor = sumIntegers(expense("expense_variable"));
  return {
    revenueMinor: Math.round(c.revenue),
    tickets: ticketCount,
    averageTicketMinor: ticketCount
      ? moneyRatio(BigInt(c.revenue), BigInt(ticketCount))
      : 0,
    grossProfitMinor: sumIntegers([c.revenue, -c.goods, -c.commission]),
    coverage: c.coverage,
    soldUnits: c.units,
    unitsWithoutCost: Math.max(0, c.units - c.knownUnits),
    costOfGoodsMinor: c.goods,
    paymentCommissionMinor: c.commission,
    fixedExpensesMinor,
    variableExpensesMinor,
    resultMinor:
      c.coverage >= 0.8
        ? sumIntegers([
            c.revenue,
            -c.goods,
            -c.commission,
            -fixedExpensesMinor,
            -variableExpensesMinor,
          ])
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
  const current = summarizeHistory(input, within(range.from, range.to));
  const previous = summarizeHistory(
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
    stock: summarizeStockHistory(input, range.from, range.to, locationId),
    ...summarizeCustomerPromoHistory(input, range.from, range.to, locationId),
    previous: {
      revenueMinor: previous.revenueMinor,
      variation:
        previous.revenueMinor > 0
          ? (current.revenueMinor - previous.revenueMinor) /
            previous.revenueMinor
          : null,
    },
    annual: annualComplete ? summarizeHistory(input, annualRows) : null,
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
    ...summarizeHistory(input, rows),
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
