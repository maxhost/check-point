import { calculateGoal } from "./cards/index";
import { monthEnd } from "./date";
import { moneyRatio, sumIntegers } from "./money";
import { ANALYTICS_POLICY } from "./policy/index";
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
      input.metrics
        .filter((row) => row.metric === "revenue" && row.day === input.today)
        .map((row) => row.amountMinor),
    ),
    estimated: goal.estimated,
    unavailableReason:
      goal.breakEvenMinor !== null
        ? null
        : !goal.closedMonth
          ? "closed_month"
          : goal.coverage < ANALYTICS_POLICY.finance.minimumCoverage ||
              goal.margin === null
            ? "cost_coverage"
            : "positive_margin",
  };
}
