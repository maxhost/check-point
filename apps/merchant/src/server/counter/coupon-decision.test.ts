import { describe, expect, it } from "vitest";
import {
  type CouponCampaignFacts,
  type CouponTurnFacts,
  decideCouponRedemption,
} from "./coupon-decision";

/**
 * Spec 0065 phase C — THE DECLARED ORDER OF THE GUARDS, which the spec calls normative.
 * A docblock that states an order is an affirmation like any other (ADR 0054); this is
 * its oracle, and the three cases at the bottom are the ones that can only pass if the
 * order is the declared one, because they violate TWO rules at once.
 */

const NOW = new Date("2026-09-16T12:00:00.000Z");
const DAY = 86_400_000;

const turn = (over: Partial<CouponTurnFacts> = {}): CouponTurnFacts => ({
  status: "active",
  holdout: false,
  couponLabelSnapshot: "2x1 en picadas",
  windowStart: new Date(NOW.getTime() - DAY),
  windowEnd: new Date(NOW.getTime() + DAY),
  outcome: null,
  ...over,
});

const campaign = (
  over: Partial<CouponCampaignFacts> = {},
): CouponCampaignFacts => ({
  status: "active",
  couponMaxRedemptions: 100,
  ...over,
});

function decide(
  t: Partial<CouponTurnFacts> = {},
  c: Partial<CouponCampaignFacts> = {},
  redeemedCount = 0,
) {
  return decideCouponRedemption({
    turn: turn(t),
    campaign: campaign(c),
    redeemedCount,
    now: NOW,
  });
}

describe("decideCouponRedemption", () => {
  it("hands over a live coupon inside its window", () => {
    expect(decide()).toEqual({ ok: true });
  });

  it("the five ways a turn is unusable all answer `turn_not_active`", () => {
    const cases: [
      string,
      Partial<CouponTurnFacts>,
      Partial<CouponCampaignFacts>,
    ][] = [
      ["turn queued", { status: "queued" }, {}],
      ["turn cancelled", { status: "cancelled" }, {}],
      // A holdout was decided but NEVER placed: the consumer never saw the offer, so
      // there is nothing to honour at the counter.
      ["holdout", { holdout: true }, {}],
      ["no coupon", { couponLabelSnapshot: null }, {}],
      ["campaign paused", {}, { status: "paused" }],
    ];
    for (const [label, t, c] of cases)
      expect(decide(t, c), label).toMatchObject({
        ok: false,
        status: 409,
        code: "turn_not_active",
      });
  });

  it("refuses a window that has not opened and one that already closed", () => {
    expect(
      decide({
        windowStart: new Date(NOW.getTime() + DAY),
        windowEnd: new Date(NOW.getTime() + 2 * DAY),
      }),
    ).toMatchObject({ code: "turn_not_active" });
    expect(
      decide({
        windowStart: new Date(NOW.getTime() - 2 * DAY),
        windowEnd: new Date(NOW.getTime() - DAY),
      }),
    ).toMatchObject({ code: "turn_not_active" });
    // The edges are INSIDE: a window that ends «today» is valid today.
    expect(decide({ windowEnd: NOW })).toEqual({ ok: true });
    expect(decide({ windowStart: NOW })).toEqual({ ok: true });
  });

  it("a turn with no window at all is not usable, and does not compare against null", () => {
    expect(decide({ windowStart: null, windowEnd: null })).toMatchObject({
      code: "turn_not_active",
    });
  });

  it("a coupon already handed over is `already_redeemed`", () => {
    expect(decide({ outcome: "coupon_redeemed" })).toMatchObject({
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
  it("an unusable turn wins over the cap: the operator is not sent to the wrong thing", () => {
    expect(
      decide({ status: "cancelled" }, { couponMaxRedemptions: 1 }, 5),
    ).toMatchObject({ code: "turn_not_active" });
  });

  it("an unusable turn wins over `already_redeemed` too", () => {
    expect(
      decide({ status: "cancelled", outcome: "coupon_redeemed" }),
    ).toMatchObject({ code: "turn_not_active" });
  });

  it("`already_redeemed` wins over the cap: it is about THIS turn", () => {
    expect(
      decide({ outcome: "coupon_redeemed" }, { couponMaxRedemptions: 1 }, 5),
    ).toMatchObject({ code: "already_redeemed" });
  });
});
