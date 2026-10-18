import { validDay } from "./date";

export type DashboardSummary = {
  version: 1;
  date: string;
  timezone: string;
  currencyCode: string;
  minorUnit: number;
  readAt: string;
  monthBreakEvenMinor: number | null;
  dailyBreakEvenMinor: number | null;
  todayRevenueMinor: number;
  estimated: boolean;
  unavailableReason:
    | "closed_month"
    | "cost_coverage"
    | "positive_margin"
    | "expense_history"
    | null;
};

/** Reject malformed transport data instead of presenting a fabricated zero. */
export function parseDashboardSummary(value: unknown): DashboardSummary {
  if (!value || typeof value !== "object") throw new Error("summary-contract");
  const s = value as DashboardSummary;
  const money = (n: unknown) =>
    typeof n === "number" && Number.isSafeInteger(n);
  if (
    s.version !== 1 ||
    !validDay(s.date) ||
    typeof s.timezone !== "string" ||
    typeof s.currencyCode !== "string" ||
    !/^[A-Z]{3}$/.test(s.currencyCode) ||
    !Number.isInteger(s.minorUnit) ||
    s.minorUnit < 0 ||
    s.minorUnit > 4 ||
    typeof s.readAt !== "string" ||
    !Number.isFinite(Date.parse(s.readAt)) ||
    !money(s.todayRevenueMinor) ||
    typeof s.estimated !== "boolean" ||
    !(s.monthBreakEvenMinor === null || money(s.monthBreakEvenMinor)) ||
    !(s.dailyBreakEvenMinor === null || money(s.dailyBreakEvenMinor)) ||
    ![
      null,
      "closed_month",
      "cost_coverage",
      "positive_margin",
      "expense_history",
    ].includes(s.unavailableReason) ||
    (s.monthBreakEvenMinor === null) !== (s.dailyBreakEvenMinor === null) ||
    (s.monthBreakEvenMinor === null) !== (s.unavailableReason !== null)
  )
    throw new Error("summary-contract");
  try {
    new Intl.DateTimeFormat("es", { timeZone: s.timezone });
  } catch {
    throw new Error("summary-contract");
  }
  return s;
}
