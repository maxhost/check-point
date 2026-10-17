import type {
  MetricTranslator,
  MetricRow,
} from "@mi-pasaporte/domain/analytics/metrics";
import type { ConsumptionApplied } from "./consumption-event";
export const metricTranslators: readonly MetricTranslator[] = [
  {
    eventType: "recipes.consumption.applied",
    translate(event) {
      const p = event.payload as ConsumptionApplied;
      const rows: MetricRow[] = [];
      for (const line of p.lines) {
        if (line.cost) {
          const base = {
            locationId: p.locationId,
            occurredAt: p.closedAt,
            dimensionKind: "product" as const,
            dimensionId: line.productId,
            dimensionLabel: line.productLabel ?? undefined,
          };
          rows.push(
            { ...base, metric: "cost_of_goods", ...line.cost },
            { ...base, metric: "units_with_cost", quantity: line.quantity },
          );
        }
      }
      return {
        sourceKey: `recipes.consumption.applied:${p.sourceOrderId}`,
        sourceRevision: 1,
        rows,
      };
    },
  },
];
