import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import { assertFinancialSettlement } from "@mi-pasaporte/domain/financial/validate";
import { decodeSaleClosedEvent } from "./decode";
import type { SaleClosedEventV2 } from "./types";
function financialEvent(): SaleClosedEventV2 {
  const sourceLineId = randomUUID(),
    methodId = randomUUID(),
    paymentId = randomUUID();
  const s = buildFinancialSettlement({
    currencyCode: "COP",
    lines: [{ sourceLineId, position: 0, unitPrice: "10.40", quantity: 1 }],
    discount: {
      amount: "0.60",
      origin: {
        type: "campaign_coupon",
        sourceId: randomUUID(),
        scope: "order",
      },
    },
    payments: [{ paymentId, methodId, amount: "9.80" }],
  });
  return {
    eventVersion: 2,
    sourceOrderId: randomUUID(),
    locationId: randomUUID(),
    closedAt: new Date().toISOString(),
    userId: "user",
    lines: s.lines.map((l) => ({
      ...l,
      productId: randomUUID(),
      quantity: 1,
      resourceVersions: [
        {
          providerId: "resource-producer",
          slot: "composition",
          versionId: randomUUID(),
        },
      ],
    })),
    money: {
      gross: s.gross,
      discount: s.discount,
      roundingAdjustment: s.roundingAdjustment,
      collected: s.collected,
      currencyCode: s.currencyCode,
      minorUnit: s.minorUnit,
      originalGross: s.originals.gross,
      originalDiscount: s.originals.discount,
      originalNet: s.originals.net,
      normalizationAdjustments: s.normalizationAdjustments,
    },
    payments: s.payments.map((p) => ({
      ...p,
      methodProviderId: "method-producer",
      methodName: "Card",
      chargeShape: "percent",
      resourceVersions: [],
    })),
    paymentOriginals: s.paymentOriginals,
  };
}
describe("P1 durable v1/v2 decoder", () => {
  it("rejects a fabricated zero with coherent signed deltas but a positive original net", () => {
    const v = financialEvent();
    v.money.collected = "0";
    v.money.roundingAdjustment = "-9";
    v.money.normalizationAdjustments.net = {
      numerator: "-980",
      denominator: "1",
      scale: 2,
    };
    v.lines[0].money.net = "0";
    v.lines[0].money.roundingAdjustment = "-9";
    v.lines[0].money.normalizationAdjustments.net = {
      numerator: "-980",
      denominator: "1",
      scale: 2,
    };
    v.payments = [];
    v.paymentOriginals = [];
    expect(() => decodeSaleClosedEvent(v)).toThrow("invalid_financial_input");
  });
  it("rejects gross and discount values different from their approved HALF_UP originals", () => {
    const gross = financialEvent();
    gross.money.gross = "11";
    gross.money.roundingAdjustment = "0";
    gross.money.normalizationAdjustments.gross = {
      numerator: "60",
      denominator: "1",
      scale: 2,
    };
    gross.lines[0].money.gross = "11";
    gross.lines[0].money.roundingAdjustment = "0";
    gross.lines[0].money.normalizationAdjustments.gross = {
      numerator: "60",
      denominator: "1",
      scale: 2,
    };
    const discount = financialEvent();
    discount.money.discount = "0";
    discount.money.roundingAdjustment = "0";
    discount.money.normalizationAdjustments.discount = {
      numerator: "-60",
      denominator: "1",
      scale: 2,
    };
    discount.lines[0].money.discount = "0";
    discount.lines[0].money.roundingAdjustment = "0";
    discount.lines[0].money.normalizationAdjustments.discount = {
      numerator: "-60",
      denominator: "1",
      scale: 2,
    };
    expect(() => decodeSaleClosedEvent(gross)).toThrow(
      "invalid_financial_input",
    );
    expect(() => decodeSaleClosedEvent(discount)).toThrow(
      "invalid_financial_input",
    );
  });
  it("accepts historical envelopes without inventing money and preserves v2 product resource slots", () => {
    const v2 = financialEvent();
    expect(decodeSaleClosedEvent(v2)).toBe(v2);
    const v1 = {
      eventVersion: 1,
      sourceOrderId: v2.sourceOrderId,
      locationId: v2.locationId,
      closedAt: v2.closedAt,
      userId: v2.userId,
      lines: v2.lines.map(
        ({ sourceLineId, productId, quantity, resourceVersions }) => ({
          sourceLineId,
          productId,
          quantity,
          resourceVersions,
        }),
      ),
    };
    expect(decodeSaleClosedEvent(v1)).toBe(v1);
    expect(v1).not.toHaveProperty("money");
  });
  it("rejects changed money, noncanonical originals, extra effective payments and unknown versions", () => {
    for (const mutate of [
      (v: SaleClosedEventV2) => {
        v.money.collected = "11";
      },
      (v: SaleClosedEventV2) => {
        v.money.originalGross.denominator = "0";
      },
      (v: SaleClosedEventV2) => {
        v.payments.push({ ...v.payments[0] });
      },
    ]) {
      const v = financialEvent();
      mutate(v);
      expect(() => decodeSaleClosedEvent(v)).toThrow();
    }
    expect(() =>
      decodeSaleClosedEvent({ ...financialEvent(), eventVersion: 3 }),
    ).toThrow();
  });
  it("validates both aligned and fractional line allocations without redistributing", () => {
    for (const currencyCode of ["USD", "COP"]) {
      const s = buildFinancialSettlement({
        currencyCode,
        lines: [
          { sourceLineId: "a", position: 0, unitPrice: "0.60", quantity: 1 },
          { sourceLineId: "b", position: 1, unitPrice: "0.40", quantity: 1 },
        ],
        discount: {
          amount: "0.60",
          origin: {
            type: "campaign_coupon",
            sourceId: "coupon",
            scope: "order",
          },
        },
        payments:
          currencyCode === "COP"
            ? []
            : [{ paymentId: "p", methodId: "m", amount: "0.40" }],
      });
      expect(() => assertFinancialSettlement(s)).not.toThrow();
    }
  });
});
