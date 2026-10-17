import type { MetricTranslator } from "@mi-pasaporte/domain/analytics/metrics";
export type CommissionFrozen = {
  eventVersion: 1;
  sourceOrderId: string;
  locationId: string;
  closedAt: string;
  amountMinor: string;
  currencyCode: string;
  minorUnit: 0 | 2;
};
export const coreMetricTranslators: readonly MetricTranslator[] = [
  {
    eventType: "sale.commission.frozen",
    translate(event) {
      const p = event.payload as CommissionFrozen;
      return {
        sourceKey: `sale.commission.frozen:${p.sourceOrderId}`,
        sourceRevision: 1,
        rows: [
          {
            metric: "payment_commission",
            locationId: p.locationId,
            occurredAt: p.closedAt,
            dimensionKind: "none",
            dimensionId: null,
            amountMinor: p.amountMinor,
            currencyCode: p.currencyCode,
            minorUnit: p.minorUnit,
          },
        ],
      };
    },
  },
];
