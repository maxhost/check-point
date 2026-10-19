import { describe, expect, it } from "vitest";
import {
  buildFinancialAmountsFromSnapshots,
  buildFinancialSettlementFromSnapshots,
} from "@mi-pasaporte/domain/financial";
import { assertFinancialSettlement } from "@mi-pasaporte/domain/financial/validate";
import {
  exact,
  fromExact,
  multiply,
  rational,
} from "@mi-pasaporte/domain/financial/rational";
import { UNIT_MEASURE } from "@mi-pasaporte/domain/measures";
import {
  decideMeasuredBenefit,
  type AuthorizedMeasuredCoupon,
  type MeasuredBenefitLine,
} from "./measured-benefit";
const mass: MeasuredBenefitLine = {
  sourceLineId: "mass",
  position: 0,
  productId: "p",
  quantity: "3",
  unitPrice: "1",
  measure: {
    kind: "mass",
    quantityUnit: "g",
    priceUnit: "lb",
    conversionVersion: "mass-si-1",
  },
};
const unit: MeasuredBenefitLine = {
  ...mass,
  sourceLineId: "unit",
  position: 1,
  quantity: "2",
  unitPrice: "0.015",
  measure: UNIT_MEASURE,
};
const coupon: AuthorizedMeasuredCoupon = {
  couponId: "coupon",
  campaignId: "campaign",
  kind: "discount",
  productId: "p",
  discountUnit: "percent",
  discountValue: "100",
  currencyCode: null,
};
function result(
  lines: readonly MeasuredBenefitLine[],
  c: AuthorizedMeasuredCoupon | null = coupon,
  currencyCode = "USD",
) {
  const decision = decideMeasuredBenefit({ lines, coupon: c, currencyCode });
  if (!decision.ok) throw new Error(decision.code);
  const input = { lines, currencyCode, discount: decision.discount };
  const amounts = buildFinancialAmountsFromSnapshots(input);
  const settled = buildFinancialSettlementFromSnapshots({
    ...input,
    payments: /[1-9]/.test(amounts.collected)
      ? [{ paymentId: "p", methodId: "cash", amount: amounts.collected }]
      : [],
  });
  assertFinancialSettlement(settled);
  return settled;
}
describe("shared measured benefit decision", () => {
  it.each(["USD", "COP"])(
    "full/partial nonterminating mass discounts use original gross in %s",
    (currency) => {
      const full = result([mass], coupon, currency);
      expect(full.payments).toEqual([]);
      expect(full.originals.net).toEqual(exact(rational(0n)));
      const partial = result(
        [mass],
        { ...coupon, discountValue: "37" },
        currency,
      );
      expect(partial.originals.discount).toEqual(
        exact(multiply(fromExact(full.originals.gross), rational(37n, 100n))),
      );
      for (const discountValue of ["0", "0.01", "1"]) {
        const fixed = result(
          [mass],
          { ...coupon, discountUnit: "amount", discountValue },
          currency,
        );
        expect(fixed.originals.discount).toEqual(
          discountValue === "0" ? exact(rational(0n)) : full.originals.gross,
        );
      }
      const small = result(
        [{ ...mass, quantity: "3000" }],
        { ...coupon, discountUnit: "amount", discountValue: "0.01" },
        currency,
      );
      expect(small.originals.discount).toEqual(exact(rational(1n)));
    },
  );
  it("preserves legacy null currency and rejects a different specific currency", () => {
    expect(() =>
      result([mass], { ...coupon, discountUnit: "amount", discountValue: "1" }),
    ).not.toThrow();
    expect(
      decideMeasuredBenefit({
        currencyCode: "USD",
        lines: [mass],
        coupon: {
          ...coupon,
          discountUnit: "amount",
          discountValue: "1",
          currencyCode: "COP",
        },
      }),
    ).toEqual({ ok: false, status: 409, code: "coupon_currency_mismatch" });
  });
  it.each(["free_product", "two_for_one"] as const)(
    "%s selects discrete snapshots and never falls back from explicit mass",
    (kind) => {
      const c = { ...coupon, kind };
      expect(
        decideMeasuredBenefit({
          currencyCode: "USD",
          lines: [mass, unit],
          coupon: { ...c, targetSourceLineId: "mass" },
        }),
      ).toEqual({
        ok: false,
        status: 409,
        code: "coupon_measure_not_supported",
      });
      expect(
        decideMeasuredBenefit({
          currencyCode: "USD",
          lines: [mass],
          coupon: c,
        }),
      ).toMatchObject({ ok: false, code: "coupon_measure_not_supported" });
      const settlement = result([mass, unit], c);
      expect(settlement.lines[0].discountOrigin).toBeNull();
      expect(settlement.lines[1].discountOrigin).toEqual({
        type: "campaign_coupon",
        sourceId: "coupon",
        campaignId: "campaign",
        benefitKind: kind,
        scope: "line",
        targetSourceLineId: "unit",
      });
      expect(settlement.originals.discount).toEqual(exact(rational(3n, 2n)));
    },
  );
  it("uses stable source identity for different frozen prices of the same product", () => {
    const old = { ...unit, quantity: "1", unitPrice: "4" };
    const newer = { ...unit, sourceLineId: "new", position: 2, unitPrice: "7" };
    expect(
      result([mass, old, newer], { ...coupon, kind: "two_for_one" }).originals
        .discount,
    ).toEqual(exact(rational(700n)));
    expect(
      result([mass, old, newer], { ...coupon, kind: "free_product" }).originals
        .discount,
    ).toEqual(exact(rational(400n)));
    expect(
      result([mass, old, newer], {
        ...coupon,
        kind: "free_product",
        targetSourceLineId: "new",
      }).originals.discount,
    ).toEqual(exact(rational(700n)));
    expect(
      decideMeasuredBenefit({
        currencyCode: "USD",
        lines: [old],
        coupon: { ...coupon, kind: "two_for_one" },
      }),
    ).toMatchObject({ ok: false, code: "coupon_quantity" });
    expect(
      decideMeasuredBenefit({
        currencyCode: "USD",
        lines: [old, newer],
        coupon: { ...coupon, kind: "two_for_one", targetSourceLineId: "unit" },
      }),
    ).toMatchObject({ ok: false, code: "coupon_quantity" });
  });
  it("keeps deleted products, historical extremes, zero tariffs and tiny prices exact", () => {
    expect(
      decideMeasuredBenefit({
        currencyCode: "USD",
        lines: [{ ...unit, productId: null }],
        coupon: { ...coupon, kind: "free_product" },
      }),
    ).toMatchObject({ ok: false, code: "coupon_product_missing" });
    expect(
      decideMeasuredBenefit({
        currencyCode: "USD",
        lines: [unit],
        coupon: { ...coupon, kind: "free_product", productId: null },
      }),
    ).toMatchObject({ ok: false, code: "coupon_product_missing" });
    for (const unitPrice of [
      "0",
      "0.000000001",
      "0.005",
      "9999999999.990000000",
    ]) {
      const settled = result([{ ...unit, quantity: "1", unitPrice }], {
        ...coupon,
        kind: "free_product",
      });
      expect(settled.payments).toEqual([]);
      expect(settled.originals.discount).toEqual(settled.originals.gross);
    }
    expect(() =>
      result(
        [{ ...unit, quantity: "2147483647.000000000", unitPrice: "0.01" }],
        { ...coupon, kind: "two_for_one" },
      ),
    ).not.toThrow();
    expect(() =>
      result([{ ...mass, quantity: "2147483647", unitPrice: "0" }]),
    ).toThrow("invalid_quantity");
  });
  it.each(["custom", "extra_stamps", "extra_points"] as const)(
    "%s does not discount or execute rule/program extras",
    (kind) => {
      expect(
        decideMeasuredBenefit({
          currencyCode: "USD",
          lines: [mass],
          coupon: { ...coupon, kind },
        }),
      ).toEqual({ ok: true, discount: null });
    },
  );
  it("explicit local absence leaves coupon and snapshot inputs unchanged", () => {
    const lines = Object.freeze([Object.freeze({ ...unit })]);
    const frozen = Object.freeze({ ...coupon });
    const before = structuredClone({ lines, frozen });
    expect(result(lines, null).discount).toBe("0.00");
    result(lines, frozen);
    expect({ lines, frozen }).toEqual(before);
  });
  it.each(["0", "101", "01", "1.0", "1e2", "-1", null, 50])(
    "rejects malformed percentage %s",
    (discountValue) => {
      expect(() =>
        result([mass], {
          ...coupon,
          discountValue,
        } as AuthorizedMeasuredCoupon),
      ).toThrow("invalid_financial_input");
    },
  );
  it.each(["1e2", "0.001", null, "10000000000"])(
    "rejects malformed or overflowing fixed %s",
    (discountValue) => {
      expect(() =>
        result([mass], { ...coupon, discountUnit: "amount", discountValue }),
      ).toThrow();
    },
  );
});
