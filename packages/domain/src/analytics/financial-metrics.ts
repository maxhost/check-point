import { METRICS } from "./metrics";
import type { AnalyticsInput, AnalyticsMetric } from "./types";

/** Monetary projections stay segregated; quantity-only facts remain available. */
export function financialMetrics(
  input: AnalyticsInput,
  rows: readonly AnalyticsMetric[] = input.metrics,
) {
  return rows.filter(
    (row) =>
      METRICS[row.metric as keyof typeof METRICS]?.unit === "quantity" ||
      (row.currencyCode === input.currencyCode &&
        row.minorUnit === input.minorUnit),
  );
}
