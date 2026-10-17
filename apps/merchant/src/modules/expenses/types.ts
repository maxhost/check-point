/** Public JSON contracts. Amounts are decimal integer strings in minor currency units. */
export const EXPENSE_CATEGORIES = [
  { id: "rent", label: "Alquiler" },
  { id: "gas", label: "Gas" },
  { id: "electricity", label: "Electricidad" },
  { id: "water", label: "Agua" },
  { id: "personnel", label: "Personal" },
  { id: "other", label: "Otro" },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["id"];
export type ExpenseConcept = {
  id: string;
  category: ExpenseCategory;
  name: string;
  normalizedName: string;
};
export type ExpenseContext = {
  currencyCode: string;
  minorUnit: 0 | 2;
  timeZone: string;
  defaultLocationId: string | null;
  locations: { id: string; name: string; status: string }[];
  categories: readonly { id: ExpenseCategory; label: string }[];
};
export type ExpenseLine = {
  paidOn: string;
  amountMinor: string;
  category: ExpenseCategory;
  conceptId: string | null;
  conceptName: string;
  name: string;
  isFixed: boolean;
  locationId: string | null;
};
export type ExpenseDraftLine = {
  [K in keyof ExpenseLine]: ExpenseLine[K] | null;
} & { sourceText: string };
export type ExpenseDraft = { lines: ExpenseDraftLine[]; unparsed: string[] };
export type Expense = Omit<ExpenseLine, "conceptId"> & {
  id: string;
  revision: number;
  revisionId: string;
  paymentTimeZone: string;
  currencyCode: string;
  minorUnit: 0 | 2;
  conceptId: string;
  conceptNormalizedName: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
