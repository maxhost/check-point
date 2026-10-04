import { describe, expect, it } from "vitest";
import {
  type CounterCoupon,
  type CounterCouponFacts,
  decideCounterCouponState,
} from "./coupon-state";

/**
 * Spec 0148 — what the counter sees of the consumer's coupon (contract M0/M1), the PURE
 * decision: one case per row of the table, plus the order. ORACULO DE M6: a choice of
 * ANOTHER business is not this counter's `selected`.
 */

const HERE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ELSEWHERE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function coupon(id: string, label = `Cupón ${id.slice(0, 4)}`): CounterCoupon {
  return {
    couponId: id,
    label,
    kind: "two_for_one",
    rule: null,
    productId: null,
    productName: null,
    discountUnit: null,
    discountValue: null,
    currencyCode: "USD",
    extraUnits: null,
    validUntil: new Date("2026-12-31T00:00:00.000Z"),
  };
}

function facts(over: Partial<CounterCouponFacts>): CounterCouponFacts {
  return {
    businessId: HERE,
    today: [],
    selection: null,
    validCount: 0,
    ...over,
  };
}

const chosen = coupon("11111111-1111-4111-8111-111111111111", "2x1 en picadas");
const validatedToday = coupon("22222222-2222-4222-8222-222222222222", "Postre");

describe("decideCounterCouponState (spec 0148)", () => {
  it("validated: a row of today without a sale, not extra", () => {
    expect(
      decideCounterCouponState(
        facts({
          today: [
            { kind: "two_for_one", orderId: null, coupon: validatedToday },
          ],
        }),
      ),
    ).toEqual({ status: "validated", coupon: validatedToday });
  });

  it("used_today: a row of today tied to a sale, or an extra_* (consumed when validated)", () => {
    expect(
      decideCounterCouponState(
        facts({
          today: [
            { kind: "discount", orderId: "order-1", coupon: validatedToday },
          ],
        }),
      ),
    ).toEqual({ status: "used_today", label: "Postre" });
    expect(
      decideCounterCouponState(
        facts({
          today: [
            { kind: "extra_points", orderId: null, coupon: validatedToday },
          ],
          selection: { businessId: HERE, status: "valid", coupon: chosen },
          validCount: 3,
        }),
      ),
    ).toEqual({ status: "used_today", label: "Postre" });
  });

  it("selected: the consumer's choice is a VALID coupon of this business", () => {
    expect(
      decideCounterCouponState(
        facts({
          selection: { businessId: HERE, status: "valid", coupon: chosen },
          validCount: 2,
        }),
      ),
    ).toEqual({ status: "selected", coupon: chosen });
  });

  it("hint: valid coupons here and no usable choice — only the count travels", () => {
    expect(decideCounterCouponState(facts({ validCount: 2 }))).toEqual({
      status: "hint",
      count: 2,
    });
  });

  it("none: nothing of the above", () => {
    expect(decideCounterCouponState(facts({}))).toEqual({ status: "none" });
  });

  it("ORDER: validated wins over a choice and over the count", () => {
    expect(
      decideCounterCouponState(
        facts({
          today: [
            { kind: "free_product", orderId: null, coupon: validatedToday },
          ],
          selection: { businessId: HERE, status: "valid", coupon: chosen },
          validCount: 4,
        }),
      ),
    ).toEqual({ status: "validated", coupon: validatedToday });
  });

  it("ORACULO DE M6 — a choice of ANOTHER business is hint (valid ones here) or none", () => {
    const foreign = {
      businessId: ELSEWHERE,
      status: "valid" as const,
      coupon: chosen,
    };
    expect(
      decideCounterCouponState(facts({ selection: foreign, validCount: 1 })),
    ).toEqual({ status: "hint", count: 1 });
    expect(decideCounterCouponState(facts({ selection: foreign }))).toEqual({
      status: "none",
    });
  });

  it("a choice that is not valid in E3 (expired, scheduled, redeemed) is not selected", () => {
    for (const status of ["expired", "scheduled", "redeemed"] as const)
      expect(
        decideCounterCouponState(
          facts({ selection: { businessId: HERE, status, coupon: chosen } }),
        ),
      ).toEqual({ status: "none" });
  });
});
