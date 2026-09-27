import { describe, expect, it } from "vitest";
import {
  type CouponCampaignFacts,
  type CouponFacts,
  decideCouponRedemption,
} from "./coupon-decision";

/**
 * THE DECLARED ORDER OF THE GUARDS (spec 0065 phase C, over the coupon since spec 0102),
 * which the spec calls normative. The cases at the bottom are the ones that can only pass
 * if the order is the declared one, because they violate TWO rules at once.
 */

const NOW = new Date("2026-09-16T12:00:00.000Z");
const DAY = 86_400_000;

const coupon = (over: Partial<CouponFacts> = {}): CouponFacts => ({
  validFrom: new Date(NOW.getTime() - DAY),
  validUntil: new Date(NOW.getTime() + DAY),
  redeemed: false,
  ...over,
});

const campaign = (
  over: Partial<CouponCampaignFacts> = {},
): CouponCampaignFacts => ({
  couponMaxRedemptions: 100,
  ...over,
});

function decide(
  k: Partial<CouponFacts> = {},
  c: Partial<CouponCampaignFacts> = {},
  redeemedCount = 0,
) {
  return decideCouponRedemption({
    coupon: coupon(k),
    campaign: campaign(c),
    redeemedCount,
    now: NOW,
  });
}

describe("decideCouponRedemption", () => {
  it("hands over a coupon inside its validity", () => {
    expect(decide()).toEqual({ ok: true });
  });

  it("refuses a coupon that is not valid yet and one that ran out: `coupon_not_active`", () => {
    expect(
      decide({
        validFrom: new Date(NOW.getTime() + DAY),
        validUntil: new Date(NOW.getTime() + 2 * DAY),
      }),
    ).toMatchObject({ ok: false, status: 409, code: "coupon_not_active" });
    expect(
      decide({
        validFrom: new Date(NOW.getTime() - 2 * DAY),
        validUntil: new Date(NOW.getTime() - DAY),
      }),
    ).toMatchObject({ ok: false, status: 409, code: "coupon_not_active" });
    // The edges are INSIDE: a coupon valid «until now» is valid now.
    expect(decide({ validUntil: NOW })).toEqual({ ok: true });
    expect(decide({ validFrom: NOW })).toEqual({ ok: true });
  });

  it("a PAUSED or ENDED campaign is not a reason: the decision never receives the status", () => {
    // ADR 0094 §2. The facts of the campaign are its cap and nothing else; an extra key
    // is ignored, so a campaign reading `paused` still hands over a coupon in date.
    for (const status of ["paused", "ended", "archived"])
      expect(
        decideCouponRedemption({
          coupon: coupon(),
          campaign: { ...campaign(), status } as CouponCampaignFacts,
          redeemedCount: 0,
          now: NOW,
        }),
        status,
      ).toEqual({ ok: true });
  });

  it("a coupon already handed over is `already_redeemed`", () => {
    expect(decide({ redeemed: true })).toMatchObject({
      status: 409,
      code: "already_redeemed",
    });
  });

  it("the campaign cap is `coupon_cap_reached`, and it is `>=`, not `>`", () => {
    expect(decide({}, { couponMaxRedemptions: 3 }, 2)).toEqual({ ok: true });
    expect(decide({}, { couponMaxRedemptions: 3 }, 3)).toMatchObject({
      code: "coupon_cap_reached",
    });
    expect(decide({}, { couponMaxRedemptions: 3 }, 4)).toMatchObject({
      code: "coupon_cap_reached",
    });
  });

  it("a null cap is NO cap, never a cap of zero", () => {
    expect(decide({}, { couponMaxRedemptions: null }, 999)).toEqual({
      ok: true,
    });
  });

  // ─── The order, which is the part a comment cannot prove ───────────────────────
  const expired = {
    validFrom: new Date(NOW.getTime() - 2 * DAY),
    validUntil: new Date(NOW.getTime() - DAY),
  };

  it("`coupon_not_active` wins over the cap: the operator is not sent to the wrong thing", () => {
    expect(decide(expired, { couponMaxRedemptions: 1 }, 5)).toMatchObject({
      code: "coupon_not_active",
    });
  });

  it("`coupon_not_active` wins over `already_redeemed` too", () => {
    expect(decide({ ...expired, redeemed: true })).toMatchObject({
      code: "coupon_not_active",
    });
  });

  it("`already_redeemed` wins over the cap: it is about THIS coupon", () => {
    expect(
      decide({ redeemed: true }, { couponMaxRedemptions: 1 }, 5),
    ).toMatchObject({ code: "already_redeemed" });
  });
});
