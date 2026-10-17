import type {
  MetricTranslator,
  MetricGauge,
  MetricRow,
} from "@mi-pasaporte/domain/analytics/metrics";
import {
  exactMinorCost,
  stockMoneyMinor,
  type PurchaseRecorded,
  type AdjustmentRecorded,
} from "./analytics-facts";
const base = (p: PurchaseRecorded | AdjustmentRecorded) => ({
  locationId: p.locationId,
  occurredAt: p.occurredAt,
  dimensionKind: "item" as const,
  dimensionId: p.itemId,
  dimensionLabel: p.itemLabel,
});
export const metricTranslators: readonly MetricTranslator[] = [
  {
    eventType: "stock.purchase.recorded",
    translate(event) {
      const p = event.payload as PurchaseRecorded;
      const gauges: MetricGauge[] = [
        {
          ...base(p),
          occurredAt: p.observedAt,
          metric: "stock_on_hand",
          quantity: p.onHandAfter,
          unit: p.itemUnit,
        },
      ];
      if (p.unitCostAfter !== null)
        gauges.push({
          ...base(p),
          occurredAt: p.observedAt,
          metric: "stock_unit_cost",
          amountMinor: exactMinorCost(p.unitCostAfter, p.minorUnit),
          currencyCode: p.currencyCode,
          minorUnit: p.minorUnit,
          unit: p.itemUnit,
        });
      const rows: MetricRow[] = [
        {
          ...base(p),
          metric: "stock_purchase",
          quantity: p.quantity,
          amountMinor:
            p.totalCost === null
              ? "0"
              : stockMoneyMinor(p.totalCost, p.minorUnit),
          currencyCode: p.currencyCode,
          minorUnit: p.minorUnit,
          count: p.totalCost === null ? 0 : 1,
        },
      ];
      return {
        sourceKey: `stock.purchase.recorded:${p.movementId}`,
        sourceRevision: 1,
        rows,
        gauges,
      };
    },
  },
  {
    eventType: "stock.adjustment.recorded",
    translate(event) {
      const p = event.payload as AdjustmentRecorded;
      return {
        sourceKey: `stock.adjustment.recorded:${p.movementId}`,
        sourceRevision: 1,
        rows: [
          {
            ...base(p),
            metric: "stock_count_gap",
            quantity: p.quantity,
            amountMinor: p.gapAmountMinor ?? "0",
            currencyCode: p.currencyCode,
            minorUnit: p.minorUnit,
            count: p.gapAmountMinor === null ? 0 : 1,
          },
        ],
        gauges: [
          {
            ...base(p),
            occurredAt: p.observedAt,
            metric: "stock_on_hand",
            quantity: p.onHandAfter,
            unit: p.itemUnit,
          },
        ],
        facts:
          p.gapAmountMinor === null
            ? []
            : [
                {
                  kind: "count_gap",
                  occurredAt: p.occurredAt,
                  locationId: p.locationId,
                  itemId: p.itemId,
                  itemLabel: p.itemLabel,
                  itemUnit: p.itemUnit,
                  quantity: p.quantity,
                  amountMinor: p.gapAmountMinor,
                  currencyCode: p.currencyCode,
                  minorUnit: p.minorUnit,
                  actionHref: `/backoffice/stock?movementId=${p.movementId}&itemId=${p.itemId}&locationId=${p.locationId}`,
                },
              ],
      };
    },
  },
];
