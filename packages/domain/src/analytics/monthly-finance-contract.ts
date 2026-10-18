/** Exact integer minor units at every public monetary boundary. */
export type MonthlyFinanceReason =
  | "sales_costs"
  | "expense_history"
  | "reference_sales"
  | "positive_margin";

export type MonthlyExpenseEstimate = {
  id: string;
  label: string;
  kind: "fixed" | "variable";
  recordedMinor: number;
  referenceMinor: number | null;
  referenceMonths: number;
  pendingMinor: number | null;
  forecastMinor: number | null;
};

export type MonthlyFinance = {
  version: 2;
  from: string;
  to: string;
  asOf: string;
  status: "unavailable" | "estimated" | "covered";
  reasons: MonthlyFinanceReason[];
  recordedExpensesMinor: number;
  pendingExpensesMinor: number | null;
  forecastExpensesMinor: number | null;
  monthRevenueMinor: number;
  monthContributionMinor: number | null;
  remainingSalesMinor: number | null;
  totalSalesTargetMinor: number | null;
  unitCoverage: number;
  revenueCoverage: number;
  referenceFrom: string;
  referenceTo: string;
  expenses: MonthlyExpenseEstimate[];
};
