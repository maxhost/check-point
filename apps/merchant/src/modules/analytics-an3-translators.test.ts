import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import { coreMetricTranslators } from "../server/analytics/ingestion/core-translators";
import { metricTranslators as pos } from "./pos/server/metrics";
import {
  analyticsCustomerId,
  analyticsMoney,
} from "../server/counter/analytics-events";
const translate = (eventType: string, payload: unknown) =>
  [...coreMetricTranslators, ...pos]
    .find((t) => t.eventType === eventType)!
    .translate({
      id: "f9b25355-e805-428b-95ad-f46de558109a",
      businessId: randomUUID(),
      eventType,
      eventVersion: 1,
      payload,
    });
describe("AN3 pure captured translators", () => {
  it("uses standard UUIDv5, normalizes case, and separates tenants", () => {
    const business = "11111111-1111-4111-8111-111111111111",
      consumer = "22222222-2222-4222-8222-222222222222";
    expect(analyticsCustomerId(business, consumer)).toBe(
      "02255803-7625-5f70-bf46-6871c7ef4a86",
    );
    expect(
      analyticsCustomerId(business.toUpperCase(), consumer.toUpperCase()),
    ).toBe(analyticsCustomerId(business, consumer));
    expect(
      analyticsCustomerId("33333333-3333-4333-8333-333333333333", consumer),
    ).not.toBe(analyticsCustomerId(business, consumer));
  });
  it("captures exact integer money and COP minor unit zero", () => {
    expect(analyticsMoney("90071992547409.93", "USD")).toEqual({
      amountMinor: "9007199254740993",
      currencyCode: "USD",
      minorUnit: 2,
    });
    expect(analyticsMoney("10.40", "COP")).toEqual({
      amountMinor: "10",
      currencyCode: "COP",
      minorUnit: 0,
    });
  });
  it("keeps visits separate per order, nullable location, and captured labels and spend", () => {
    const p = {
      eventVersion: 1,
      orderId: randomUUID(),
      customerId: randomUUID(),
      customerLabel: "Ana",
      locationId: null,
      occurredAt: "2026-10-18T04:30:00Z",
      amountMinor: "101",
      currencyCode: "USD",
      minorUnit: 2,
    };
    const before = structuredClone(p),
      result = translate("visit.recorded", p);
    expect(result).toEqual(translate("visit.recorded", p));
    expect(p).toEqual(before);
    expect(result.rows[0]).toMatchObject({
      metric: "visits",
      count: 1,
      quantity: "1",
      locationId: null,
      dimensionLabel: "Ana",
      amountMinor: "101",
      occurredAt: p.occurredAt,
    });
    expect(result.sourceKey).not.toBe(
      translate("visit.recorded", { ...p, orderId: randomUUID() }).sourceKey,
    );
  });
  it("void translates only its captured ticket, instant, local and integer money", () => {
    const p = {
      eventVersion: 1,
      sourceOrderId: randomUUID(),
      locationId: null,
      voidedAt: "2026-10-18T04:30:00Z",
      userId: "staff",
      lines: [
        {
          sourceLineId: randomUUID(),
          productId: null,
          productLabel: "Servicio",
          quantity: 2,
          unitPrice: "10.40",
        },
      ],
      amountMinor: "21",
      currencyCode: "COP",
      minorUnit: 0,
    };
    const snapshot = structuredClone(p),
      result = translate("pos.order.voided", p);
    expect(result).toEqual(translate("pos.order.voided", p));
    expect(p).toEqual(snapshot);
    expect(result.rows).toEqual([
      expect.objectContaining({
        metric: "voided_tickets",
        count: 1,
        amountMinor: "21",
        minorUnit: 0,
        occurredAt: p.voidedAt,
      }),
    ]);
  });
  it("coupon cost has an independent source so the POS priority cannot erase it", () => {
    const p = {
      eventVersion: 1,
      couponId: randomUUID(),
      orderId: randomUUID(),
      campaignId: randomUUID(),
      campaignLabel: "Promo",
      locationId: null,
      occurredAt: "2026-10-18T04:30:00Z",
      discountMinor: "1",
      salesMinor: "10",
      costMinor: "2",
      currencyCode: "COP",
      minorUnit: 0,
    };
    const result = translate("coupon.redeemed", p);
    expect(result.sourceKey).toBe(`coupon:${p.couponId}`);
    expect(result.sourceRevision).toBe(1);
    expect(result.rows.map((r) => r.amountMinor)).toEqual(["1", "10"]);
    expect(result.additionalSources?.[0]).toMatchObject({
      sourceKey: `coupon.cost:${p.couponId}`,
      rows: [
        { metric: "promo_cost", amountMinor: "2", dimensionLabel: "Promo" },
      ],
    });
  });
  it("POS counts the complete associated ticket once even for a discount limited to one line", () => {
    const couponId = randomUUID(),
      campaignId = randomUUID(),
      sourceLineId = randomUUID(),
      methodId = randomUUID(),
      paymentId = randomUUID();
    const financial = buildFinancialSettlement({
      currencyCode: "USD",
      lines: [
        { sourceLineId, position: 0, unitPrice: "2.00", quantity: 1 },
        {
          sourceLineId: randomUUID(),
          position: 1,
          unitPrice: "3.50",
          quantity: 2,
        },
      ],
      discount: {
        amount: "1.00",
        origin: {
          type: "campaign_coupon",
          sourceId: couponId,
          campaignId,
          benefitKind: "discount",
          scope: "line",
          targetSourceLineId: sourceLineId,
        },
      },
      payments: [{ methodId, paymentId, amount: "8.00" }],
    });
    const payload = {
      eventVersion: 3,
      sourceOrderId: randomUUID(),
      locationId: randomUUID(),
      closedAt: "2026-10-18T04:30:00Z",
      userId: "staff",
      money: {
        ...financial,
        originalGross: financial.originals.gross,
        originalDiscount: financial.originals.discount,
        originalNet: financial.originals.net,
      },
      lines: financial.lines.map((line, index) => ({
        ...line,
        quantity: index === 0 ? 1 : 2,
        productId: randomUUID(),
        productLabel: "Producto",
        resourceVersions: [],
        commissionMinor: null,
      })),
      payments: financial.payments.map((payment) => ({
        ...payment,
        methodProviderId: "core",
        methodName: "Efectivo",
        chargeShape: "none",
        resourceVersions: [],
      })),
      paymentOriginals: financial.paymentOriginals,
    };
    const original = structuredClone(payload),
      result = translate("sale.closed", payload);
    expect(result).toEqual(translate("sale.closed", payload));
    expect(payload).toEqual(original);
    expect(result.additionalSources).toEqual([
      {
        sourceKey: `coupon:${couponId}`,
        sourceRevision: 2,
        rows: [
          expect.objectContaining({
            metric: "promo_discount",
            amountMinor: "100",
            count: 1,
          }),
          expect.objectContaining({
            metric: "promo_sales",
            amountMinor: "800",
            count: 1,
          }),
        ],
      },
    ]);
    expect(result.rows.find((r) => r.metric === "revenue")?.amountMinor).toBe(
      "800",
    );
  });
  it("campaign snapshot copies only captured lifecycle without a clock or source read", () => {
    const p = {
      eventVersion: 1,
      campaignId: randomUUID(),
      label: "Bienvenida",
      status: "active",
      startsAt: "2026-10-01T00:00:00Z",
      endsAt: "2026-10-17T23:00:00Z",
      endedAt: null,
      capturedAt: "2026-10-17T15:00:00Z",
    };
    const result = translate("campaign.snapshot", p);
    expect(result).toEqual(translate("campaign.snapshot", p));
    expect(result.rows).toEqual([]);
    expect(result.campaignSnapshots).toEqual([p]);
  });
});
