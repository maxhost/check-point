import { describe, expect, it } from "vitest";
import {
  buildFinancialAmounts,
  buildFinancialSettlement,
  FinancialError,
  normalizeMoney,
  type DiscountOrigin,
} from "@mi-pasaporte/domain/financial";
const origin: DiscountOrigin = {
  type: "campaign_coupon",
  sourceId: "coupon",
  campaignId: "campaign",
  benefitKind: "discount_percent",
  scope: "order",
};
const lines = (prices: string[]) =>
  prices.map((unitPrice, i) => ({
    sourceLineId: `l${i}`,
    position: i,
    unitPrice,
    quantity: 1,
  }));
describe("P1 financial snapshot exact settlement", () => {
  it("preserves COP originals and both distinct adjustments without changing approved net", () => {
    const v = buildFinancialSettlement({
      currencyCode: "COP",
      lines: lines(["10.40"]),
      discount: { amount: "0.60", origin },
      payments: [{ paymentId: "p", methodId: "m", amount: "9.80" }],
    });
    expect(v).toMatchObject({
      gross: "10",
      discount: "1",
      roundingAdjustment: "1",
      collected: "10",
      normalizationAdjustments: {
        gross: { numerator: "-40", denominator: "1", scale: 2 },
        discount: { numerator: "40", denominator: "1", scale: 2 },
        net: { numerator: "20", denominator: "1", scale: 2 },
      },
    });
    expect(v.lines[0].money).toMatchObject({
      gross: "10",
      discount: "1",
      net: "10",
      roundingAdjustment: "1",
    });
  });
  it("cumulative allocation closes four cents without negative last line", () => {
    const v = buildFinancialAmounts({
      currencyCode: "USD",
      lines: lines(["0.01", "0.01", "0.01", "0.01"]),
      discount: { amount: "0.02", origin },
    });
    expect(v.lines.map((l) => l.money.discount)).toEqual([
      "0.01",
      "0.00",
      "0.01",
      "0.00",
    ]);
    expect(v.lines.every((l) => l.discountOrigin?.sourceId === "coupon")).toBe(
      true,
    );
  });
  it("zero original base receives neither amount nor origin, even when it is last", () => {
    const v = buildFinancialAmounts({
      currencyCode: "USD",
      lines: lines(["1.00", "2.00", "0.00"]),
      discount: { amount: "1.00", origin },
    });
    expect(v.lines[2]).toMatchObject({
      discountOrigin: null,
      money: { gross: "0.00", discount: "0.00", net: "0.00" },
    });
    expect(v.lines[0].money.originals.discount).toEqual({
      numerator: "100",
      denominator: "3",
      scale: 2,
    });
  });
  it("full coverage requires no payments, including fractional zero-decimal prices", () => {
    const v = buildFinancialSettlement({
      currencyCode: "COP",
      lines: lines(["0.60"]),
      discount: { amount: "0.60", origin },
      payments: [],
    });
    expect(v).toMatchObject({
      gross: "1",
      discount: "1",
      collected: "0",
      payments: [],
      paymentOriginals: [],
    });
  });
  it("free item affects precisely its selected source line and one authorized unit", () => {
    const l = lines(["2.00", "3.00"]);
    l[1].quantity = 2;
    const v = buildFinancialAmounts({
      currencyCode: "USD",
      lines: l,
      discount: {
        amount: "3.00",
        origin: {
          ...origin,
          scope: "line",
          targetSourceLineId: "l1",
          benefitKind: "two_for_one",
        },
      },
    });
    expect(
      v.lines.map((x) => [x.money.gross, x.money.discount, x.money.net]),
    ).toEqual([
      ["2.00", "0.00", "2.00"],
      ["6.00", "3.00", "3.00"],
    ]);
    expect(v.lines[0].discountOrigin).toBeNull();
  });
  it("payment order preserves original zero allocation without creating a transaction", () => {
    const v = buildFinancialSettlement({
      currencyCode: "COP",
      lines: lines(["1.00"]),
      discount: null,
      payments: [
        { paymentId: "a", methodId: "first", amount: "0.10" },
        { paymentId: "b", methodId: "second", amount: "0.90" },
      ],
    });
    expect(
      v.paymentOriginals.map((p) => [
        p.paymentId,
        p.position,
        p.amount,
        p.effective,
      ]),
    ).toEqual([
      ["a", 0, "0", false],
      ["b", 1, "1", true],
    ]);
    expect(v.payments.map((p) => p.paymentId)).toEqual(["b"]);
  });
  it("validates required, duplicate, unexpected and mismatched payments", () => {
    const input = {
      currencyCode: "USD",
      lines: lines(["1.00"]),
      discount: null,
    };
    for (const [payments, code] of [
      [[], "payment_required"],
      [
        [{ paymentId: "a", methodId: "m", amount: "0.50" }],
        "payment_sum_mismatch",
      ],
      [
        [
          { paymentId: "a", methodId: "m", amount: "0.50" },
          { paymentId: "b", methodId: "m", amount: "0.50" },
        ],
        "duplicate_payment_method",
      ],
      [
        [{ paymentId: "a", methodId: "m", amount: "NaN" }],
        "invalid_payment_amount",
      ],
    ] as const) {
      try {
        buildFinancialSettlement({ ...input, payments });
        throw new Error("accepted");
      } catch (e) {
        expect(e).toBeInstanceOf(FinancialError);
        expect((e as FinancialError).code).toBe(code);
      }
    }
    expect(() =>
      buildFinancialSettlement({
        ...input,
        lines: lines(["0.00"]),
        payments: [{ paymentId: "a", methodId: "m", amount: "1.00" }],
      }),
    ).toThrow("payments_not_expected");
  });
  it("uses stable position/source identity and exact invariants for fractional distributions", () => {
    for (const currencyCode of ["COP", "USD"]) {
      const v = buildFinancialAmounts({
        currencyCode,
        lines: lines(["0.60", "0.40", "0.00"]).reverse(),
        discount: { amount: "0.60", origin },
      });
      const cents = (s: string) => BigInt(s.replace(".", ""));
      expect(v.lines.map((l) => l.sourceLineId)).toEqual(["l0", "l1", "l2"]);
      for (const l of v.lines)
        expect(cents(l.money.discount) <= cents(l.money.gross)).toBe(true);
      expect(v.lines.reduce((n, l) => n + cents(l.money.net), 0n)).toBe(
        cents(v.collected),
      );
    }
  });
  it("normalizes HALF_UP without increasing monetary input precision", () => {
    expect(normalizeMoney("10.50", 0)).toBe("11");
    expect(normalizeMoney("1.20", 2)).toBe("1.20");
    for (const invalid of ["NaN", "Infinity", "1.001", "-1", "1e3"])
      expect(() => normalizeMoney(invalid, 2)).toThrow(FinancialError);
  });
});
