import { describe, expect, it } from "vitest";
import {
  type CouponDiscountInput,
  decideCouponDiscount,
} from "./coupon-discount";

/**
 * Spec 0148 — how much a coupon takes off a sale (contract M4), the PURE rule. In cents.
 * ORACULO DE M4: the amount discount is capped at the total (ADR 0119 §13).
 */

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function input(over: Partial<CouponDiscountInput>): CouponDiscountInput {
  return {
    kind: "discount",
    discountUnit: "percent",
    discountValue: "10.00",
    currencyCode: null,
    businessCurrency: "USD",
    mode: "detailed",
    items: [],
    totalCents: 2000,
    productId: null,
    ...over,
  };
}

const twoOfProduct = [
  { productId: PRODUCT, unitPrice: "3.50", quantity: 2 },
  { productId: OTHER, unitPrice: "9.00", quantity: 1 },
];

describe("decideCouponDiscount (spec 0148)", () => {
  it("percent: 50 % of 20.00 is 10.00 — the owner's example (ADR 0119 §12)", () => {
    expect(decideCouponDiscount(input({ discountValue: "50.00" }))).toEqual({
      ok: true,
      discountCents: 1000,
    });
  });

  it("percent rounds half-UP to the cent", () => {
    // 15 % of 10.50 = 1.575 → 1.58 (half-up), not 1.57.
    expect(
      decideCouponDiscount(input({ discountValue: "15.00", totalCents: 1050 })),
    ).toEqual({ ok: true, discountCents: 158 });
    // 15 % of 10.30 = 1.545 → 1.55.
    expect(
      decideCouponDiscount(input({ discountValue: "15.00", totalCents: 1030 })),
    ).toEqual({ ok: true, discountCents: 155 });
  });

  it("amount: 15.00 off a 10.00 sale takes 10.00 — charged 0, the rest is lost (ADR 0119 §13)", () => {
    expect(
      decideCouponDiscount(
        input({
          discountUnit: "amount",
          discountValue: "15.00",
          currencyCode: "USD",
          totalCents: 1000,
        }),
      ),
    ).toEqual({ ok: true, discountCents: 1000 });
  });

  it("amount below the total takes its value", () => {
    expect(
      decideCouponDiscount(
        input({
          discountUnit: "amount",
          discountValue: "5.00",
          currencyCode: "USD",
          totalCents: 1000,
        }),
      ),
    ).toEqual({ ok: true, discountCents: 500 });
  });

  it("amount in another currency than the business's → 409 coupon_currency_mismatch", () => {
    expect(
      decideCouponDiscount(
        input({
          discountUnit: "amount",
          discountValue: "5.00",
          currencyCode: "ARS",
        }),
      ),
    ).toMatchObject({
      ok: false,
      status: 409,
      code: "coupon_currency_mismatch",
    });
  });

  it("2x1 detailed: ONE unit of the coupon's product", () => {
    expect(
      decideCouponDiscount(
        input({
          kind: "two_for_one",
          discountUnit: null,
          discountValue: null,
          items: twoOfProduct,
          totalCents: 1600,
          productId: PRODUCT,
        }),
      ),
    ).toEqual({ ok: true, discountCents: 350 });
  });

  it("free product detailed: the line the counter picked (the coupon names none) — another line, another price", () => {
    expect(
      decideCouponDiscount(
        input({
          kind: "free_product",
          discountUnit: null,
          discountValue: null,
          items: twoOfProduct,
          totalCents: 1600,
          productId: OTHER,
        }),
      ),
    ).toEqual({ ok: true, discountCents: 900 });
  });

  it("2x1 without its line → 409 coupon_product_missing; with ONE unit → 409 coupon_quantity", () => {
    const base = {
      kind: "two_for_one" as const,
      discountUnit: null,
      discountValue: null,
      totalCents: 900,
    };
    expect(
      decideCouponDiscount(
        input({ ...base, items: [twoOfProduct[1]], productId: PRODUCT }),
      ),
    ).toMatchObject({ ok: false, code: "coupon_product_missing" });
    expect(
      decideCouponDiscount(
        input({ ...base, items: twoOfProduct, productId: null }),
      ),
    ).toMatchObject({ ok: false, code: "coupon_product_missing" });
    expect(
      decideCouponDiscount(
        input({
          ...base,
          items: [{ productId: PRODUCT, unitPrice: "3.50", quantity: 1 }],
          productId: PRODUCT,
        }),
      ),
    ).toMatchObject({ ok: false, status: 409, code: "coupon_quantity" });
  });

  it("quick sale with a 2x1 / free product, and custom anywhere: 0 — the counter types the value", () => {
    for (const kind of ["two_for_one", "free_product"] as const)
      expect(
        decideCouponDiscount(
          input({
            kind,
            discountUnit: null,
            discountValue: null,
            mode: "quick",
            productId: PRODUCT,
          }),
        ),
      ).toEqual({ ok: true, discountCents: 0 });
    for (const mode of ["quick", "detailed"] as const)
      expect(
        decideCouponDiscount(
          input({
            kind: "custom",
            discountUnit: null,
            discountValue: null,
            mode,
            items: twoOfProduct,
          }),
        ),
      ).toEqual({ ok: true, discountCents: 0 });
  });

  it("extra stamps/points take nothing off the sale: they credit with it (spec 0153)", () => {
    for (const kind of ["extra_stamps", "extra_points"] as const)
      for (const mode of ["detailed", "quick"] as const)
        expect(
          decideCouponDiscount(
            input({ kind, mode, discountUnit: null, discountValue: null }),
          ),
        ).toEqual({ ok: true, discountCents: 0 });
  });
});
