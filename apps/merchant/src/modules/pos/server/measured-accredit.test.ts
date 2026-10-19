import { describe, expect, it } from "vitest";
import { computeAccrualFromMoney } from "@mi-pasaporte/domain/server/loyalty-program/accrual";
import "@mi-pasaporte/domain/server/loyalty-program/accrual-exact.test";
import { buildFinancialSettlementFromSnapshots } from "@mi-pasaporte/domain/financial";
import {
  decideMeasuredBenefit,
  type AuthorizedMeasuredCoupon,
} from "../measured-benefit";

const line = {
  sourceLineId: "mass",
  productId: "p",
  position: 0,
  unitPrice: "4",
  quantity: "907.18474",
  measure: {
    kind: "mass" as const,
    quantityUnit: "g" as const,
    priceUnit: "lb" as const,
    conversionVersion: "mass-si-1" as const,
  },
};
const coupon: AuthorizedMeasuredCoupon = {
  couponId: "coupon",
  campaignId: "campaign",
  kind: "discount",
  productId: "p",
  discountUnit: "percent",
  discountValue: "25.00",
  currencyCode: "USD",
};
describe("measured accreditation exact decision inputs", () => {
  it("accrues directly over a zero-minor currency settlement", () => {
    const settlement = buildFinancialSettlementFromSnapshots({
      currencyCode: "JPY",
      lines: [line],
      discount: null,
      payments: [{ paymentId: "p", methodId: "m", amount: "8" }],
    });
    expect(settlement.collected).toBe("8");
    expect(
      computeAccrualFromMoney(
        { mode: "per_amount", grant: 1, blockAmount: "0.10" },
        settlement.collected,
      ),
    ).toBe(80);
  });
  it.each(["percent", "amount"] as const)(
    "retains mass originals and normalized %s discount",
    (discountUnit) => {
      const decision = decideMeasuredBenefit({
        currencyCode: "USD",
        lines: [line],
        coupon: {
          ...coupon,
          discountUnit,
          discountValue: discountUnit === "percent" ? "25.00" : "2.00",
        },
      });
      expect(decision.ok).toBe(true);
      if (!decision.ok) throw new Error(decision.code);
      const settlement = buildFinancialSettlementFromSnapshots({
        currencyCode: "USD",
        lines: [line],
        discount: decision.discount,
        payments: [{ paymentId: "p", methodId: "m", amount: "6.00" }],
      });
      expect(settlement).toMatchObject({
        gross: "8.00",
        discount: "2.00",
        collected: "6.00",
        originals: { gross: { numerator: "800", denominator: "1" } },
      });
    },
  );
  it("settles a nonterminating lb conversion at 100% without payments", () => {
    const lines = [{ ...line, quantity: "1", unitPrice: "1" }];
    const decision = decideMeasuredBenefit({
      currencyCode: "USD",
      lines,
      coupon: { ...coupon, discountValue: "100.00" },
    });
    if (!decision.ok) throw new Error(decision.code);
    const settlement = buildFinancialSettlementFromSnapshots({
      currencyCode: "USD",
      lines,
      discount: decision.discount,
      payments: [],
    });
    expect(settlement.collected).toBe("0.00");
    expect(settlement.originals.net.numerator).toBe("0");
    expect(settlement.originals.gross.denominator).not.toBe("1");
  });
});
