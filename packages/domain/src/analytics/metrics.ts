/** Core vocabulary. Translators are deterministic functions of a captured event only. */
export const METRICS = {
  stock_purchase: { type: "sum", unit: "money_quantity", dimension: "item" },
  stock_count_gap: { type: "sum", unit: "money_quantity", dimension: "item" },
  stock_consumption: { type: "sum", unit: "quantity", dimension: "item" },
  stock_unit_cost: { type: "gauge", unit: "money", dimension: "item" },
  stock_on_hand: { type: "gauge", unit: "quantity", dimension: "item" },
  product_unit_cost_change: {
    type: "sum",
    unit: "money",
    dimension: "product",
  },
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
export type DimensionKind = "none" | "product" | "concept" | "item";
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
/** Gauge money is exact decimal minor units, unlike summed money (integer). */
export type MetricGauge = Omit<MetricRow, "day" | "count"> & {
  occurredAt: string;
  unit: string;
};
export type AnalyticsFact =
  | {
      kind: "unit_cost_change";
      occurredAt: string;
      locationId: string;
      itemId: string;
      itemLabel: string;
      itemUnit: string;
      itemUnitCostBefore: string;
      itemUnitCostAfter: string;
      productId: string;
      productLabel: string;
      unitCostBefore: string;
      unitCostAfter: string;
      currencyCode: string;
      minorUnit: number;
    }
  | {
      kind: "count_gap";
      occurredAt: string;
      locationId: string;
      itemId: string;
      itemLabel: string;
      itemUnit: string;
      quantity: string;
      amountMinor: string;
      currencyCode: string;
      minorUnit: number;
      actionHref: string;
    };
export type MetricTranslation = {
  sourceKey: string;
  sourceRevision: number;
  rows: readonly MetricRow[];
  gauges?: readonly MetricGauge[];
  facts?: readonly AnalyticsFact[];
};
export type MetricTranslator = {
  eventType: string;
  translate: (event: MetricEvent) => MetricTranslation;
};
