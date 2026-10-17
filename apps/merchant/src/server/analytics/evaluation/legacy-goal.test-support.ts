/** Deliberate portable legacy oracle: calculateGoal and dependencies from base65b5152e (same functional source as5fac), before policy/rational refactor. Never imported by runtime. */
import {
  addDays,
  addMonths,
  monthEnd,
  monthStart,
  weekday,
} from "@mi-pasaporte/domain/analytics/date";
import type {
  AnalyticsInput,
  AnalyticsMetric,
} from "@mi-pasaporte/domain/analytics/types";
import { moneyRatio, sumIntegers } from "@mi-pasaporte/domain/analytics/money";
const sum = (
  rows: readonly AnalyticsMetric[],
  metric: string,
  field: "amountMinor" | "quantity" | "count" = "amountMinor",
) =>
  field === "quantity"
    ? rows
        .filter((r) => r.metric === metric)
        .reduce((n, r) => n + r.quantity, 0)
    : sumIntegers(rows.filter((r) => r.metric === metric).map((r) => r[field]));
const period = (rows: readonly AnalyticsMetric[], from: string, to: string) =>
  rows.filter((r) => r.day >= from && r.day <= to);
export type ProductSummary = {
  id: string;
  label: string;
  revenue: number;
  units: number;
  knownUnits: number;
  salesCount: number;
  cost: number;
  knownRevenue: number;
  exact: boolean;
  profitPerUnit: number | null;
};
export function products(
  input: AnalyticsInput,
  rows: readonly AnalyticsMetric[],
): ProductSummary[] {
  const ids = [
    ...new Set(
      rows
        .filter((r) =>
          [
            "product_revenue",
            "units_sold",
            "cost_of_goods",
            "units_with_cost",
          ].includes(r.metric),
        )
        .map((r) => r.dimensionId ?? "unlisted"),
    ),
  ];
  return ids.map((id) => {
    const product = rows.filter((r) => (r.dimensionId ?? "unlisted") === id);
    const revenue = sum(product, "product_revenue");
    const units = sum(product, "units_sold", "quantity");
    const knownUnits = sum(product, "units_with_cost", "quantity");
    const cost = sum(product, "cost_of_goods");
    const knownRevenue = sum(product, "revenue_with_cost");
    const knownCommission = sum(product, "payment_commission_with_cost");
    const lines = sum(product, "cost_of_goods", "count");
    const exact =
      lines > 0 &&
      lines === sum(product, "revenue_with_cost", "count") &&
      lines === sum(product, "payment_commission_with_cost", "count");
    const profit = sumIntegers([knownRevenue, -cost, -knownCommission]);
    return {
      id,
      label:
        input.labels.find((l) => l.kind === "product" && l.id === id)?.label ??
        (id === "unlisted" ? "Producto sin catálogo" : "Producto"),
      revenue,
      units,
      knownUnits,
      salesCount: sum(product, "product_revenue", "count"),
      cost,
      knownRevenue,
      exact,
      profitPerUnit: exact && knownUnits > 0 ? profit / knownUnits : null,
    };
  });
}
export function contribution(
  input: AnalyticsInput,
  rows: readonly AnalyticsMetric[],
) {
  const product = products(input, rows);
  const units = sum(rows, "units_sold", "quantity");
  const knownUnits = product.reduce(
    (n, p) => n + Math.min(p.units, p.knownUnits),
    0,
  );
  const revenue = sum(rows, "revenue");
  const knownRevenue = sum(rows, "revenue_with_cost");
  const goods = sum(rows, "cost_of_goods");
  const commission = sum(rows, "payment_commission");
  const knownCommission = sum(rows, "payment_commission_with_cost");
  const lines = sum(rows, "cost_of_goods", "count");
  const exact =
    lines > 0 &&
    lines === sum(rows, "revenue_with_cost", "count") &&
    lines === sum(rows, "payment_commission_with_cost", "count");
  const grossProfit = sumIntegers([knownRevenue, -goods, -knownCommission]);
  return {
    coverage: units > 0 ? knownUnits / units : 0,
    revenue,
    knownRevenue,
    goods,
    commission,
    grossProfit,
    exact,
    margin: exact && knownRevenue > 0 ? grossProfit / knownRevenue : null,
  };
}
export type GoalCalculation = {
  expensesMinor: number;
  estimated: boolean;
  concepts: {
    id: string;
    label: string;
    amountMinor: number;
    estimated: boolean;
  }[];
  closedMonth: boolean;
  coverage: number;
  margin: number | null;
  breakEvenMinor: number | null;
  monthRevenueMinor: number;
  remainingDays: number;
  targetMinor: number | null;
  atRisk: boolean;
};
export function calculateGoal(input: AnalyticsInput): GoalCalculation {
  const { today, metrics } = input;
  const start = monthStart(today);
  const closed = period(metrics, addMonths(start, -3), addDays(start, -1));
  const current = period(metrics, start, today);
  const recent = period(metrics, addDays(today, -28), addDays(today, -1));
  const c = contribution(input, recent);
  const concepts = [
    ...new Set(
      [...metrics.filter((r) => r.day < start), ...current]
        .filter((r) => r.metric === "expense_fixed")
        .map((r) => r.dimensionId ?? "unknown"),
    ),
  ].map((id) => {
    const thisMonth = current.filter(
      (r) =>
        r.metric === "expense_fixed" &&
        (r.dimensionId ?? "unknown") === id &&
        r.amountMinor > 0,
    );
    const previous = new Map<string, number>();
    for (const row of metrics.filter(
      (r) =>
        r.day < start &&
        r.metric === "expense_fixed" &&
        (r.dimensionId ?? "unknown") === id,
    ))
      previous.set(
        row.day.slice(0, 7),
        sumIntegers([previous.get(row.day.slice(0, 7)) ?? 0, row.amountMinor]),
      );
    const paidMonths = [...previous.entries()]
      .filter(([, amount]) => amount > 0)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 3)
      .map(([, amount]) => amount);
    return {
      id,
      label:
        input.labels.find((l) => l.kind === "concept" && l.id === id)?.label ??
        "Gasto fijo",
      amountMinor: thisMonth.length
        ? sum(thisMonth, "expense_fixed")
        : paidMonths.length
          ? sumIntegers(paidMonths) / paidMonths.length
          : 0,
      estimated: !thisMonth.length,
    };
  });
  const variable = sum(closed, "expense_variable") / 3;
  const expenseSixths = concepts.reduce(
    (total, concept) => {
      if (!concept.estimated) return total + BigInt(concept.amountMinor) * 6n;
      const paid = metrics.filter(
        (r) =>
          r.metric === "expense_fixed" &&
          (r.dimensionId ?? "unknown") === concept.id &&
          r.day < start,
      );
      const months = new Map<string, number>();
      for (const r of paid)
        months.set(
          r.day.slice(0, 7),
          sumIntegers([months.get(r.day.slice(0, 7)) ?? 0, r.amountMinor]),
        );
      const amounts = [...months]
        .filter(([, v]) => v > 0)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 3)
        .map(([, v]) => v);
      return (
        total +
        (amounts.length
          ? BigInt(sumIntegers(amounts)) * (6n / BigInt(amounts.length))
          : 0n)
      );
    },
    BigInt(sum(closed, "expense_variable")) * 2n,
  );
  const expensesMinor = moneyRatio(expenseSixths, 6n);
  const monthRevenueMinor = sum(current, "revenue");
  const closedMonth =
    input.hasClosedExpenseMonth ??
    metrics
      .filter((r) => r.day < start)
      .some((r) => r.metric.startsWith("expense_") && r.amountMinor > 0);
  const weekdays = new Set(
    recent
      .filter(
        (r) => r.metric === "revenue" && (r.count > 0 || r.amountMinor > 0),
      )
      .map((r) => weekday(r.day)),
  );
  let remainingDays = 0;
  for (let day = today; day <= monthEnd(today); day = addDays(day, 1))
    if (weekdays.has(weekday(day))) remainingDays++;
  const breakEvenMinor =
    closedMonth &&
    c.coverage >= 0.8 &&
    c.exact &&
    c.margin !== null &&
    c.margin > 0
      ? moneyRatio(
          expenseSixths * BigInt(c.knownRevenue),
          6n * BigInt(c.grossProfit),
          "ceil",
        )
      : null;
  const elapsed = Number(today.slice(8)) - 1;
  const days = Number(monthEnd(today).slice(8));
  const atRisk =
    breakEvenMinor !== null &&
    BigInt(monthRevenueMinor) * BigInt(days) <
      BigInt(breakEvenMinor) * BigInt(Math.max(1, elapsed));
  return {
    expensesMinor,
    estimated: concepts.some((c) => c.estimated) || variable > 0,
    concepts,
    closedMonth,
    coverage: c.coverage,
    margin: c.margin,
    breakEvenMinor,
    monthRevenueMinor,
    remainingDays,
    targetMinor:
      breakEvenMinor !== null &&
      breakEvenMinor > monthRevenueMinor &&
      remainingDays > 0 &&
      atRisk
        ? moneyRatio(
            BigInt(sumIntegers([breakEvenMinor, -monthRevenueMinor])),
            BigInt(remainingDays),
            "ceil",
          )
        : null,
    atRisk,
  };
}
