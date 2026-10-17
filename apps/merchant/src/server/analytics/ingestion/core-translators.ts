import type {
  VisitRecorded,
  CouponRedeemed,
} from "../../counter/analytics-events";
import type {
  CampaignSnapshot,
  MetricRow,
} from "@mi-pasaporte/domain/analytics/metrics";
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
  {
    eventType: "visit.recorded",
    translate(event) {
      const p = event.payload as VisitRecorded;
      return {
        sourceKey: `visit:${p.orderId}`,
        sourceRevision: 1,
        rows: [
          {
            metric: "visits",
            locationId: p.locationId,
            occurredAt: p.occurredAt,
            dimensionKind: "customer",
            dimensionId: p.customerId,
            dimensionLabel: p.customerLabel,
            amountMinor: p.amountMinor,
            currencyCode: p.currencyCode,
            minorUnit: p.minorUnit,
            count: 1,
            quantity: "1",
          },
        ],
      };
    },
  },
  {
    eventType: "coupon.redeemed",
    translate(event) {
      const p = event.payload as CouponRedeemed;
      const base = {
        locationId: p.locationId,
        occurredAt: p.occurredAt,
        dimensionKind: "campaign" as const,
        dimensionId: p.campaignId,
        dimensionLabel: p.campaignLabel,
        currencyCode: p.currencyCode,
        minorUnit: p.minorUnit,
      };
      return {
        sourceKey: `coupon:${p.couponId}`,
        sourceRevision: 1,
        rows: [
          {
            ...base,
            metric: "promo_discount",
            amountMinor: p.discountMinor,
            count: 1,
          },
          {
            ...base,
            metric: "promo_sales",
            amountMinor: p.salesMinor,
            count: 1,
          },
        ] satisfies MetricRow[],
        additionalSources: [
          {
            sourceKey: `coupon.cost:${p.couponId}`,
            sourceRevision: 1,
            rows: [
              {
                ...base,
                metric: "promo_cost",
                amountMinor: p.costMinor,
                count: 1,
              },
            ],
          },
        ],
      };
    },
  },
  {
    eventType: "campaign.snapshot",
    translate(event) {
      const p = event.payload as CampaignSnapshot;
      return {
        sourceKey: `campaign.snapshot:${event.id}`,
        sourceRevision: 1,
        rows: [],
        campaignSnapshots: [p],
      };
    },
  },
];
