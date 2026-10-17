import type {
  MetricTranslator,
  MetricRow,
  MetricSource,
} from "@mi-pasaporte/domain/analytics/metrics";
import {
  originalMoney,
  toMinor,
} from "@mi-pasaporte/domain/financial/rational";
import { decodeSaleClosedEvent } from "../../../server/module-events/decode";
export type OrderVoided = {
  eventVersion: 1;
  sourceOrderId: string;
  locationId: string | null;
  occurredAt: string;
  amountMinor: string;
  currencyCode: string;
  minorUnit: 0 | 2;
};
export const metricTranslators: readonly MetricTranslator[] = [
  {
    eventType: "pos.order.voided",
    translate(event) {
      const p = event.payload as OrderVoided;
      return {
        sourceKey: `voided:${p.sourceOrderId}`,
        sourceRevision: 1,
        rows: [
          {
            metric: "voided_tickets",
            locationId: p.locationId,
            occurredAt: p.occurredAt,
            dimensionKind: "none",
            dimensionId: null,
            amountMinor: p.amountMinor,
            currencyCode: p.currencyCode,
            minorUnit: p.minorUnit,
            count: 1,
          },
        ],
      };
    },
  },
  {
    eventType: "sale.closed",
    translate(event) {
      const p = decodeSaleClosedEvent(event.payload);
      const rows: MetricRow[] = [];
      const additionalSources: MetricSource[] = [];
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
        const coupons = new Map<
          string,
          { campaignId: string; discount: bigint }
        >();
        for (const line of p.lines) {
          const origin = line.discountOrigin;
          if (origin?.type !== "campaign_coupon" || !origin.campaignId)
            continue;
          const prior = coupons.get(origin.sourceId);
          if (prior && prior.campaignId !== origin.campaignId)
            throw new Error("Inconsistent campaign origin");
          coupons.set(origin.sourceId, {
            campaignId: origin.campaignId,
            discount:
              (prior?.discount ?? 0n) +
              toMinor(originalMoney(line.money.discount), p.money.minorUnit),
          });
        }
        for (const [couponId, coupon] of coupons) {
          const base = {
            locationId: p.locationId,
            occurredAt: p.closedAt,
            dimensionKind: "campaign" as const,
            dimensionId: coupon.campaignId,
            currencyCode: p.money.currencyCode,
            minorUnit: p.money.minorUnit,
          };
          additionalSources.push({
            sourceKey: `coupon:${couponId}`,
            sourceRevision: 2,
            rows: [
              {
                ...base,
                metric: "promo_discount",
                amountMinor: String(coupon.discount),
                count: 1,
              },
              {
                ...base,
                metric: "promo_sales",
                ...money(p.money.collected),
                count: 1,
              },
            ],
          });
        }
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
        additionalSources,
      };
    },
  },
];
