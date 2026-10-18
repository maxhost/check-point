import { addDays, addMonths, monthEnd, monthStart } from "./date";
import { moneyRatio, sumIntegers } from "./money";
import { exactQuantity, sameQuantity, sumQuantity } from "./quantity";
import { financialMetrics } from "./financial-metrics";
import type { AnalyticsInput, AnalyticsMetric } from "./types";
import type {
  MonthlyExpenseEstimate,
  MonthlyFinance,
  MonthlyFinanceReason,
} from "./monthly-finance-contract";

const sum = (
  rows: readonly AnalyticsMetric[],
  metric: string,
  field: "amountMinor" | "count" = "amountMinor",
) => sumIntegers(rows.filter((r) => r.metric === metric).map((r) => r[field]));
const physicalMetrics = [
  "units_sold",
  "units_with_cost",
  "mass_sold_g",
  "mass_with_cost_g",
];
const nonempty = (row: AnalyticsMetric) =>
  row.amountMinor !== 0 ||
  row.count !== 0 ||
  (physicalMetrics.includes(row.metric)
    ? exactQuantity(row)?.n !== 0n
    : row.quantity !== 0);

/** Complete captured sales, with no extrapolation from a known fraction. */
function segmentBasis(rows: readonly AnalyticsMetric[]) {
  const revenue = sum(rows, "revenue"),
    knownRevenue = sum(rows, "revenue_with_cost"),
    goods = sum(rows, "cost_of_goods"),
    commission = sum(rows, "payment_commission"),
    knownCommission = sum(rows, "payment_commission_with_cost"),
    sold = sumQuantity(rows, "units_sold"),
    known = sumQuantity(rows, "units_with_cost"),
    massSold = sumQuantity(rows, "mass_sold_g"),
    massKnown = sumQuantity(rows, "mass_with_cost_g");
  const validQuantities = [sold, known, massSold, massKnown].every(
    (value) => value !== null,
  );
  const hasSales =
    sum(rows, "revenue", "count") > 0 ||
    revenue !== 0 ||
    sold?.n !== 0n ||
    massSold?.n !== 0n;
  const ids = new Set(
    rows
      .filter((r) =>
        [
          "units_sold",
          "units_with_cost",
          "mass_sold_g",
          "mass_with_cost_g",
          "product_revenue",
          "cost_of_goods",
          "revenue_with_cost",
          "payment_commission_with_cost",
        ].includes(r.metric),
      )
      .map((r) => r.dimensionId),
  );
  const complete =
    validQuantities &&
    (!hasSales
      ? knownRevenue === 0 &&
        goods === 0 &&
        commission === 0 &&
        known?.n === 0n &&
        massKnown?.n === 0n &&
        knownCommission === 0 &&
        sum(rows, "cost_of_goods", "count") === 0 &&
        sum(rows, "revenue_with_cost", "count") === 0 &&
        sum(rows, "payment_commission_with_cost", "count") === 0
      : revenue >= 0 &&
        goods >= 0 &&
        commission >= 0 &&
        revenue === knownRevenue &&
        revenue === sum(rows, "product_revenue") &&
        commission === knownCommission &&
        ((sold !== null && sold.n > 0n) ||
          (massSold !== null && massSold.n > 0n)) &&
        sameQuantity(sold, known) &&
        sameQuantity(massSold, massKnown) &&
        [
          ...new Set(
            rows
              .filter(
                (r) =>
                  r.metric === "revenue" &&
                  (r.count > 0 || r.amountMinor !== 0),
              )
              .map((r) => r.day),
          ),
        ].every((day) =>
          rows.some((r) => r.metric === "payment_commission" && r.day === day),
        ) &&
        [...ids].every((id) => {
          const product = rows.filter((r) => r.dimensionId === id),
            lines = sum(product, "cost_of_goods", "count");
          if (!product.some(nonempty)) return true;
          return (
            lines > 0 &&
            sum(product, "product_revenue", "count") > 0 &&
            sum(product, "product_revenue") >= 0 &&
            sum(product, "cost_of_goods") >= 0 &&
            sum(product, "payment_commission_with_cost") >= 0 &&
            lines >= sum(product, "product_revenue", "count") &&
            lines === sum(product, "revenue_with_cost", "count") &&
            lines === sum(product, "payment_commission_with_cost", "count") &&
            sum(product, "product_revenue") ===
              sum(product, "revenue_with_cost") &&
            sameQuantity(
              sumQuantity(product, "units_sold"),
              sumQuantity(product, "units_with_cost"),
            ) &&
            sameQuantity(
              sumQuantity(product, "mass_sold_g"),
              sumQuantity(product, "mass_with_cost_g"),
            )
          );
        }));
  return {
    revenue,
    knownRevenue,
    goods,
    commission,
    hasSales,
    complete,
    contribution: complete ? sumIntegers([revenue, -goods, -commission]) : null,
    unitCoverage:
      sold !== null && known !== null && sold.n > 0n
        ? Number(known.n * sold.d) / Number(known.d * sold.n)
        : 0,
    revenueCoverage: revenue > 0 ? knownRevenue / revenue : 0,
  };
}

export function salesBasis(rows: readonly AnalyticsMetric[]) {
  const basis = segmentBasis(rows);
  const segments = new Map<string, AnalyticsMetric[]>();
  for (const row of rows) {
    if (
      ![
        "revenue",
        "product_revenue",
        "units_sold",
        "units_with_cost",
        "mass_sold_g",
        "mass_with_cost_g",
        "cost_of_goods",
        "revenue_with_cost",
        "payment_commission",
        "payment_commission_with_cost",
      ].includes(row.metric)
    )
      continue;
    const key = JSON.stringify([row.day, row.locationId]);
    segments.set(key, [...(segments.get(key) ?? []), row]);
  }
  const complete =
    basis.complete &&
    [...segments.values()].every((segment) => segmentBasis(segment).complete);
  return {
    ...basis,
    complete,
    contribution: complete ? basis.contribution : null,
  };
}

export function buildMonthlyFinance(
  input: AnalyticsInput,
  windows: { salesDays: number; closedMonths: number } = {
    salesDays: 28,
    closedMonths: 3,
  },
): MonthlyFinance {
  const start = monthStart(input.today),
    referenceFrom = addDays(input.today, -windows.salesDays),
    referenceTo = addDays(input.today, -1);
  const rows = financialMetrics(input),
    current = rows.filter((r) => r.day >= start && r.day <= input.today),
    closed = rows.filter(
      (r) => r.day >= addMonths(start, -windows.closedMonths) && r.day < start,
    );
  const reference = (source: readonly AnalyticsMetric[], metric: string) => {
    const months = new Map<string, number>();
    for (const row of source.filter((r) => r.metric === metric)) {
      const month = row.day.slice(0, 7);
      months.set(month, sumIntegers([months.get(month) ?? 0, row.amountMinor]));
    }
    const observed = [...months.values()].filter((amount) => amount > 0);
    return {
      referenceMonths: observed.length,
      referenceMinor: observed.length
        ? moneyRatio(BigInt(sumIntegers(observed)), BigInt(observed.length))
        : null,
    };
  };
  const estimate = (
    id: string,
    label: string,
    kind: "fixed" | "variable",
    source: readonly AnalyticsMetric[],
    actual: readonly AnalyticsMetric[],
    metric: string,
  ): MonthlyExpenseEstimate => {
    const ref = reference(source, metric),
      recordedMinor = sum(actual, metric);
    const forecastMinor =
      ref.referenceMinor === null
        ? null
        : Math.max(recordedMinor, ref.referenceMinor);
    return {
      id,
      label,
      kind,
      recordedMinor,
      ...ref,
      forecastMinor,
      pendingMinor:
        forecastMinor === null
          ? null
          : sumIntegers([forecastMinor, -recordedMinor]),
    };
  };
  const ids = [
    ...new Set(
      [...current, ...closed]
        .filter((r) => r.metric === "expense_fixed" && r.amountMinor > 0)
        .map((r) => r.dimensionId ?? "unknown"),
    ),
  ].sort();
  const expenses = ids.map((id) =>
    estimate(
      id,
      input.labels.find((l) => l.kind === "concept" && l.id === id)?.label ??
        "Gasto fijo",
      "fixed",
      closed.filter((r) => (r.dimensionId ?? "unknown") === id),
      current.filter((r) => (r.dimensionId ?? "unknown") === id),
      "expense_fixed",
    ),
  );
  expenses.push(
    estimate(
      "variable",
      "Gastos variables",
      "variable",
      closed,
      current,
      "expense_variable",
    ),
  );
  const recordedExpensesMinor = sumIntegers(
    expenses.map((e) => e.recordedMinor),
  );
  const available = expenses.every((e) => e.forecastMinor !== null);
  const forecastExpensesMinor = available
    ? sumIntegers(expenses.map((e) => e.forecastMinor!))
    : null;
  const pendingExpensesMinor = available
    ? sumIntegers(expenses.map((e) => e.pendingMinor!))
    : null;
  const month = salesBasis(current),
    ref = salesBasis(
      rows.filter((r) => r.day >= referenceFrom && r.day <= referenceTo),
    );
  const reasons: MonthlyFinanceReason[] = [];
  if (!month.complete || (ref.hasSales && !ref.complete))
    reasons.push("sales_costs");
  if (!ref.hasSales || ref.revenue <= 0) reasons.push("reference_sales");
  if (!available) reasons.push("expense_history");
  if (ref.hasSales && ref.complete && ref.revenue > 0 && ref.contribution! <= 0)
    reasons.push("positive_margin");
  const remainingSalesMinor = reasons.length
    ? null
    : moneyRatio(
        BigInt(
          Math.max(
            sumIntegers([forecastExpensesMinor!, -month.contribution!]),
            0,
          ),
        ) * BigInt(ref.revenue),
        BigInt(ref.contribution!),
        "ceil",
      );
  return {
    version: 2,
    from: start,
    to: monthEnd(input.today),
    asOf: input.today,
    status:
      remainingSalesMinor === null
        ? "unavailable"
        : remainingSalesMinor === 0
          ? "covered"
          : "estimated",
    reasons,
    recordedExpensesMinor,
    pendingExpensesMinor,
    forecastExpensesMinor,
    monthRevenueMinor: month.revenue,
    monthContributionMinor: month.contribution,
    remainingSalesMinor,
    totalSalesTargetMinor:
      remainingSalesMinor === null
        ? null
        : sumIntegers([month.revenue, remainingSalesMinor]),
    unitCoverage: month.unitCoverage,
    revenueCoverage: month.revenueCoverage,
    referenceFrom,
    referenceTo,
    expenses,
  };
}
