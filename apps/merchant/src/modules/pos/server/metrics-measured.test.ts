import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildFinancialAmountsFromSnapshots,
  buildFinancialSettlementFromSnapshots,
  type FinancialInputV2,
} from "@mi-pasaporte/domain/financial";
import { UNIT_MEASURE, type LineMeasure } from "@mi-pasaporte/domain/measures";
import type { MetricRow } from "@mi-pasaporte/domain/analytics/metrics";
import type {
  MeasuredSaleClosedEvent,
  SaleClosedEvent,
  SaleClosedEventV4,
} from "../../../server/module-events/types";
import { metricTranslators } from "./metrics";

const mass = (
  quantityUnit: "kg" | "lb" | "g",
  priceUnit = quantityUnit,
): LineMeasure => ({
  kind: "mass",
  quantityUnit,
  priceUnit,
  conversionVersion: "mass-si-1",
});
type Capture = { quantity: string; unitPrice: string; measure: LineMeasure };
function event(
  captures: Capture[] = [
    { quantity: "2", unitPrice: "2", measure: UNIT_MEASURE },
    { quantity: "3", unitPrice: "2", measure: UNIT_MEASURE },
  ],
  currencyCode = "USD",
  discountAmount: string | null = "1",
): SaleClosedEventV4 {
  const productId = randomUUID();
  const lines = captures.map((capture, position) => ({
    ...capture,
    sourceLineId: randomUUID(),
    position,
  }));
  const input: FinancialInputV2 = {
    currencyCode,
    lines,
    discount:
      discountAmount === null
        ? null
        : {
            amount: discountAmount,
            origin: {
              type: "campaign_coupon",
              sourceId: randomUUID(),
              campaignId: randomUUID(),
              scope: "order",
            },
          },
  };
  const amounts = buildFinancialAmountsFromSnapshots(input);
  const s = buildFinancialSettlementFromSnapshots({
    ...input,
    payments:
      BigInt(amounts.collected.replace(".", "")) === 0n
        ? []
        : [
            {
              paymentId: randomUUID(),
              methodId: randomUUID(),
              amount: amounts.collected,
            },
          ],
  });
  return {
    eventVersion: 4,
    sourceOrderId: randomUUID(),
    locationId: randomUUID(),
    closedAt: "2026-10-18T12:00:00Z",
    userId: "staff",
    lines: s.lines.map((financial, i) => ({
      ...financial,
      quantity: lines[i].quantity,
      measure: lines[i].measure,
      productId,
      productLabel: "Capturado",
      commissionMinor: null,
      resourceVersions: [],
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
      methodProviderId: "payments",
      methodName: "Cash",
      chargeShape: "none",
      resourceVersions: [],
    })),
    paymentOriginals: s.paymentOriginals,
  };
}
function legacy(
  p: SaleClosedEventV4,
  eventVersion: 1 | 2 | 3,
): SaleClosedEvent {
  const lines = p.lines.map((line) => ({
    sourceLineId: line.sourceLineId,
    productId: line.productId,
    quantity: Number(line.quantity),
    resourceVersions: line.resourceVersions,
    position: line.position,
    money: line.money,
    discountOrigin: line.discountOrigin,
    productLabel: line.productLabel,
    commissionMinor: line.commissionMinor,
  }));
  if (eventVersion === 1)
    return {
      eventVersion,
      sourceOrderId: p.sourceOrderId,
      locationId: p.locationId,
      closedAt: p.closedAt,
      userId: p.userId,
      lines: lines.map(
        ({ sourceLineId, productId, quantity, resourceVersions }) => ({
          sourceLineId,
          productId,
          quantity,
          resourceVersions,
        }),
      ),
    };
  if (eventVersion === 2)
    return {
      ...p,
      eventVersion,
      lines: lines.map((line) => ({
        sourceLineId: line.sourceLineId,
        productId: line.productId,
        quantity: line.quantity,
        resourceVersions: line.resourceVersions,
        position: line.position,
        money: line.money,
        discountOrigin: line.discountOrigin,
      })),
    };
  return { ...p, eventVersion, lines };
}
const translate = (
  payload: MeasuredSaleClosedEvent,
  eventVersion = payload.eventVersion,
) =>
  metricTranslators[0].translate({
    id: randomUUID(),
    businessId: randomUUID(),
    eventType: "sale.closed",
    eventVersion,
    payload,
  });
const physical = (rows: readonly MetricRow[]) =>
  rows.filter((r) => r.metric === "units_sold" || r.metric === "mass_sold_g");

describe("0242 measured POS metrics", () => {
  it.each([1, 2, 3] as const)(
    "preserves the exact v%s translation and payload",
    (version) => {
      const p = legacy(event(), version),
        before = structuredClone(p);
      const result = translate(p);
      const base = { locationId: p.locationId, occurredAt: p.closedAt };
      const product = {
        ...base,
        dimensionKind: "product",
        dimensionId: p.lines[0].productId,
        dimensionLabel: version === 3 ? "Capturado" : undefined,
      };
      const money = { currencyCode: "USD", minorUnit: 2 };
      const origin = p.eventVersion === 1 ? null : p.lines[0].discountOrigin!;
      expect(result).toEqual({
        sourceKey: `sale.closed:${p.sourceOrderId}`,
        sourceRevision: 1,
        rows:
          version === 1
            ? []
            : [
                {
                  ...base,
                  ...money,
                  metric: "revenue",
                  dimensionKind: "none",
                  dimensionId: null,
                  count: 1,
                  amountMinor: "900",
                },
                {
                  ...product,
                  ...money,
                  metric: "product_revenue",
                  count: 1,
                  amountMinor: "360",
                },
                { ...product, metric: "units_sold", quantity: "2" },
                {
                  ...product,
                  ...money,
                  metric: "product_revenue",
                  count: 0,
                  amountMinor: "540",
                },
                { ...product, metric: "units_sold", quantity: "3" },
              ],
        additionalSources:
          origin === null
            ? []
            : [
                {
                  sourceKey: `coupon:${origin.sourceId}`,
                  sourceRevision: 2,
                  rows: [
                    {
                      ...base,
                      ...money,
                      dimensionKind: "campaign",
                      dimensionId: origin.campaignId,
                      metric: "promo_discount",
                      count: 1,
                      amountMinor: "100",
                    },
                    {
                      ...base,
                      ...money,
                      dimensionKind: "campaign",
                      dimensionId: origin.campaignId,
                      metric: "promo_sales",
                      count: 1,
                      amountMinor: "900",
                    },
                  ],
                },
              ],
      });
      expect(translate(p)).toEqual(result);
      expect(p).toEqual(before);
    },
  );
  it.each([2, 3] as const)(
    "keeps historical safe-integer units and ignores extra measured fields in V%s",
    (version) => {
      const p = legacy(
        event(
          [{ quantity: "1", unitPrice: "0", measure: UNIT_MEASURE }],
          "USD",
          null,
        ),
        version,
      );
      p.lines[0].quantity = Number.MAX_SAFE_INTEGER;
      Object.assign(p.lines[0], { measure: mass("lb") });
      expect(physical(translate(p).rows)).toEqual([
        expect.objectContaining({
          metric: "units_sold",
          quantity: "9007199254740991",
        }),
      ]);
    },
  );
  it("makes unit V4 exactly equivalent to V3", () => {
    const p = event(),
      before = structuredClone(p);
    expect(translate(p)).toEqual(translate(legacy(p, 3)));
    expect(p).toEqual(before);
  });
  it.each([
    ["kg", "0.45359237", "453.59237"],
    ["lb", "1", "453.59237"],
    ["g", "453.59237", "453.59237"],
    ["lb", "0.000000001", "0.00000045359237"],
    ["lb", "999999999.999999999", "453592369999.99999954640763"],
  ] as const)("converts %s %s to exact grams %s", (unit, quantity, grams) => {
    const p = event(
      [{ quantity, unitPrice: "0", measure: mass(unit) }],
      "USD",
      null,
    );
    expect(physical(translate(p).rows)).toEqual([
      expect.objectContaining({ metric: "mass_sold_g", quantity: grams }),
    ]);
  });
  it.each(["USD", "COP"])(
    "separates mixed physics and preserves money, coupons and order frequency in %s",
    (currency) => {
      const p = event(
        [
          { quantity: "2", unitPrice: "2", measure: UNIT_MEASURE },
          { quantity: "1", unitPrice: "2", measure: mass("lb") },
          { quantity: "1", unitPrice: "4", measure: mass("g") },
        ],
        currency,
      );
      const before = structuredClone(p),
        result = translate(p);
      expect(
        physical(result.rows).map(({ metric, quantity }) => ({
          metric,
          quantity,
        })),
      ).toEqual([
        { metric: "units_sold", quantity: "2" },
        { metric: "mass_sold_g", quantity: "453.59237" },
        { metric: "mass_sold_g", quantity: "1" },
      ]);
      expect(
        result.rows
          .filter((r) => r.metric === "product_revenue")
          .map((r) => r.count),
      ).toEqual([1, 0, 0]);
      expect(result.rows[0].amountMinor).toBe(currency === "USD" ? "900" : "9");
      expect(result.additionalSources).toHaveLength(1);
      expect(
        result.additionalSources?.[0].rows.map((r) => r.amountMinor),
      ).toEqual(currency === "USD" ? ["100", "900"] : ["1", "9"]);
      expect(translate(p)).toEqual(result);
      expect(p).toEqual(before);
    },
  );
  it("priceUnit does not change mass or reconstruct nonterminating financial originals", () => {
    const p = event(
      [{ quantity: "1", unitPrice: "1", measure: mass("g", "lb") }],
      "USD",
      null,
    );
    const before = structuredClone(p);
    expect(p.money.originalGross.denominator).toBe("45359237");
    expect(translate(p).rows[0].amountMinor).toBe("0");
    expect(physical(translate(p).rows)[0].quantity).toBe("1");
    p.lines[0].measure = mass("g", "kg");
    expect(physical(translate(p).rows)[0].quantity).toBe("1");
    expect(p.money).toEqual(before.money);
  });
  it.each(["USD", "COP"])(
    "keeps fully discounted net-zero coupons in %s",
    (currency) => {
      const p = event(undefined, currency, "10");
      expect(p.payments).toEqual([]);
      expect(
        translate(p)
          .rows.filter((r) => r.amountMinor !== undefined)
          .map((r) => r.amountMinor),
      ).toEqual(["0", "0", "0"]);
      expect(
        translate(p).additionalSources?.[0].rows.map((r) => r.amountMinor),
      ).toEqual(currency === "USD" ? ["1000", "0"] : ["10", "0"]);
    },
  );
  it.each([1, 2, 3, 4] as const)(
    "rejects external version mismatch for V%s",
    (version) => {
      const p = version === 4 ? event() : legacy(event(), version);
      expect(() => translate(p, version === 4 ? 3 : 4)).toThrow(
        "Event version mismatch",
      );
    },
  );
  it.each([
    { measure: undefined },
    { measure: { ...mass("g"), quantityUnit: "oz" } },
    { measure: { ...mass("g"), conversionVersion: "future" } },
    { quantity: "0" },
    { quantity: 1 },
    { quantity: "1.5" },
    { quantity: "0.0000000001", measure: mass("lb") },
  ])(
    "rejects invalid measured evidence %# without partial output",
    (invalid) => {
      const p = event();
      Object.assign(p.lines[1], invalid);
      expect(() => translate(p)).toThrow();
    },
  );
  it("rejects inconsistent campaign origin without partial output", () => {
    const p = event();
    p.lines[1].discountOrigin = {
      ...p.lines[1].discountOrigin!,
      campaignId: randomUUID(),
    };
    expect(() => translate(p)).toThrow("Inconsistent campaign origin");
  });
});
