import { calculateGoal } from "./cards/index";
import { monthEnd } from "./date";
import { moneyRatio, sumIntegers } from "./money";
import { financialMetrics } from "./financial-metrics";
import type { AnalyticsInput } from "./types";
import type { DashboardSummary } from "./dashboard-summary";

export function buildDashboardSummary(
  input: AnalyticsInput & { timezone: string },
  readAt: Date,
): DashboardSummary {
  const goal = calculateGoal(input);
  const days = Number(monthEnd(input.today).slice(8));
  return {
    version: 1,
    date: input.today,
    timezone: input.timezone,
    currencyCode: input.currencyCode,
    minorUnit: input.minorUnit,
    readAt: readAt.toISOString(),
    monthBreakEvenMinor: goal.breakEvenMinor,
    dailyBreakEvenMinor:
      goal.breakEvenMinor === null
        ? null
        : moneyRatio(BigInt(goal.breakEvenMinor), BigInt(days), "ceil"),
    todayRevenueMinor: sumIntegers(
      financialMetrics(input)
        .filter((row) => row.metric === "revenue" && row.day === input.today)
        .map((row) => row.amountMinor),
    ),
    estimated: goal.estimated,
    unavailableReason:
      goal.breakEvenMinor !== null
        ? null
        : goal.finance.reasons.includes("sales_costs")
          ? "cost_coverage"
          : goal.finance.reasons.includes("reference_sales")
            ? "closed_month"
            : goal.finance.reasons.includes("expense_history")
              ? "expense_history"
              : "positive_margin",
  };
}
