/** Core vocabulary. Translators are deterministic functions of a captured event only. */
export const METRICS = {
  revenue: { type: "sum", unit: "money", dimension: "none" },
  product_revenue: { type: "sum", unit: "money", dimension: "product" },
  units_sold: { type: "sum", unit: "quantity", dimension: "product" },
  payment_commission: { type: "sum", unit: "money", dimension: "none" },
  cost_of_goods: { type: "sum", unit: "money", dimension: "product" },
  revenue_with_cost: { type: "sum", unit: "money", dimension: "product" },
  payment_commission_with_cost: {
    type: "sum",
    unit: "money",
    dimension: "product",
  },
  units_with_cost: { type: "sum", unit: "quantity", dimension: "product" },
  expense_fixed: { type: "sum", unit: "money", dimension: "concept" },
  expense_variable: { type: "sum", unit: "money", dimension: "concept" },
} as const;
export type Metric = keyof typeof METRICS;
export type DimensionKind = "none" | "product" | "concept";
export type MetricEvent = {
  id: string;
  businessId: string;
  eventType: string;
  eventVersion: number;
  payload: unknown;
  capturedAt?: string;
};
export type MetricRow = {
  metric: Metric;
  locationId: string | null;
  /** Exactly one of day (already local) or occurredAt (instant). */
  day?: string;
  occurredAt?: string;
  dimensionKind: DimensionKind;
  dimensionId: string | null;
  dimensionLabel?: string;
  amountMinor?: string;
  currencyCode?: string;
  minorUnit?: number;
  quantity?: string;
  count?: number;
};
export type MetricTranslation = {
  sourceKey: string;
  sourceRevision: number;
  rows: readonly MetricRow[];
};
export type MetricTranslator = {
  eventType: string;
  translate: (event: MetricEvent) => MetricTranslation;
};
