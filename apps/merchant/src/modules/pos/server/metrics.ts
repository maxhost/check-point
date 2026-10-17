import type {
  MetricTranslator,
  MetricRow,
} from "@mi-pasaporte/domain/analytics/metrics";
import {
  originalMoney,
  toMinor,
} from "@mi-pasaporte/domain/financial/rational";
import { decodeSaleClosedEvent } from "../../../server/module-events/decode";
export const metricTranslators: readonly MetricTranslator[] = [
  {
    eventType: "sale.closed",
    translate(event) {
      const p = decodeSaleClosedEvent(event.payload);
      const rows: MetricRow[] = [];
      if (p.eventVersion !== 1) {
        const money = (amount: string) => ({
          amountMinor: String(
            toMinor(originalMoney(amount), p.money.minorUnit),
          ),
          currencyCode: p.money.currencyCode,
          minorUnit: p.money.minorUnit,
        });
        rows.push({
          metric: "revenue",
          locationId: p.locationId,
          occurredAt: p.closedAt,
          dimensionKind: "none",
          dimensionId: null,
          count: 1,
          ...money(p.money.collected),
        });
        const countedProducts = new Set<string | null>();
        for (const line of p.lines) {
          const base = {
            locationId: p.locationId,
            occurredAt: p.closedAt,
            dimensionKind: "product" as const,
            dimensionId: line.productId,
            dimensionLabel:
              "productLabel" in line ? String(line.productLabel) : undefined,
          };
          rows.push(
            {
              ...base,
              metric: "product_revenue",
              count: countedProducts.has(line.productId) ? 0 : 1,
              ...money(line.money.net),
            },
            { ...base, metric: "units_sold", quantity: String(line.quantity) },
          );
          countedProducts.add(line.productId);
        }
      }
      return {
        sourceKey: `sale.closed:${p.sourceOrderId}`,
        sourceRevision: 1,
        rows,
      };
    },
  },
];
