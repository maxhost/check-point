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
            { ...base, metric: "cost_of_goods", count: 1, ...line.cost },
            { ...base, metric: "units_with_cost", quantity: line.quantity },
          );
          if (
            typeof line.revenueMinor === "string" &&
            p.currencyCode &&
            (p.minorUnit === 0 || p.minorUnit === 2)
          ) {
            const money = {
              currencyCode: p.currencyCode,
              minorUnit: p.minorUnit,
              count: 1,
            };
            rows.push({
              ...base,
              ...money,
              metric: "revenue_with_cost",
              amountMinor: line.revenueMinor,
            });
            if (typeof line.allocatedCommissionMinor === "string")
              rows.push({
                ...base,
                ...money,
                metric: "payment_commission_with_cost",
                amountMinor: line.allocatedCommissionMinor,
              });
          }
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
