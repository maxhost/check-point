import { describe, expect, it } from "vitest";
import {
  type CounterCoupon,
  type CounterCouponFacts,
  decideCounterCouponState,
} from "./coupon-state";
import type { VerdictFacts } from "./coupon-decision";

/**
 * Spec 0153 — what the counter sees of the consumer's coupon (contract M0/M1), the PURE
 * decision: one case per row of the table, plus the order. The chosen coupon of THIS business
 * travels with its verdict, valid (green) or not (red, with the reason). ORACULO DE M6 (0148):
 * a choice of ANOTHER business is not this counter's `selected`. ORACULO DE M3 (0153): the
 * daily limit paints the choice red.
 */

const HERE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ELSEWHERE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = new Date("2026-10-04T15:00:00.000Z");
const DAY = 86_400_000;

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

function verdictFacts(over: Partial<VerdictFacts> = {}): VerdictFacts {
  return {
    validFrom: new Date(NOW.getTime() - DAY),
    validUntil: new Date(NOW.getTime() + DAY),
    redeemed: false,
    couponMaxRedemptions: null,
    redeemedCount: 0,
    usedToday: false,
    extra: null,
    timezone: "America/Guayaquil",
    now: NOW,
    ...over,
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
const here = (over: Partial<VerdictFacts> = {}) => ({
  businessId: HERE,
  coupon: chosen,
  verdictFacts: verdictFacts(over),
});

describe("decideCounterCouponState (spec 0153)", () => {
  it("selected + green: the consumer's choice is a valid coupon of this business", () => {
    expect(
      decideCounterCouponState(facts({ selection: here(), validCount: 2 })),
    ).toEqual({ status: "selected", coupon: chosen, verdict: { valid: true } });
  });

  it("selected + red: an EXPIRED choice still shows, with the reason and the local date", () => {
    expect(
      decideCounterCouponState(
        facts({
          selection: here({
            validFrom: new Date("2026-09-01T12:00:00.000Z"),
            validUntil: new Date("2026-10-03T12:00:00.000Z"),
          }),
        }),
      ),
    ).toEqual({
      status: "selected",
      coupon: chosen,
      verdict: {
        valid: false,
        code: "coupon_expired",
        message: "Este cupón venció el 03/10/2026.",
      },
    });
  });

  it("ORACULO DE M3 — selected + red: a choice when a coupon was already used today here", () => {
    expect(
      decideCounterCouponState(
        facts({
          today: [{ label: "Postre" }],
          selection: here({ usedToday: true }),
          validCount: 1,
        }),
      ),
    ).toEqual({
      status: "selected",
      coupon: chosen,
      verdict: {
        valid: false,
        code: "coupon_daily_limit",
        message: "El cliente ya usó un cupón hoy en este comercio.",
      },
    });
  });

  it("used_today: no choice here, and a redemption of today", () => {
    expect(
      decideCounterCouponState(
        facts({ today: [{ label: "Postre" }], validCount: 3 }),
      ),
    ).toEqual({ status: "used_today", label: "Postre" });
  });

  it("hint: valid coupons here and no choice of this business — only the count travels", () => {
    expect(decideCounterCouponState(facts({ validCount: 2 }))).toEqual({
      status: "hint",
      count: 2,
    });
  });

  it("none: nothing of the above", () => {
    expect(decideCounterCouponState(facts({}))).toEqual({ status: "none" });
  });

  it("ORACULO DE M6 — a choice of ANOTHER business is used_today, hint or none — never selected", () => {
    const foreign = {
      businessId: ELSEWHERE,
      coupon: chosen,
      verdictFacts: verdictFacts(),
    };
    expect(
      decideCounterCouponState(facts({ selection: foreign, validCount: 1 })),
    ).toEqual({ status: "hint", count: 1 });
    expect(decideCounterCouponState(facts({ selection: foreign }))).toEqual({
      status: "none",
    });
    expect(
      decideCounterCouponState(
        facts({ selection: foreign, today: [{ label: "Postre" }] }),
      ),
    ).toEqual({ status: "used_today", label: "Postre" });
  });
});
