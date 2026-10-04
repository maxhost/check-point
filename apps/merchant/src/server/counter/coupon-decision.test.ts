import { describe, expect, it } from "vitest";
import {
  type ExtraFacts,
  type VerdictFacts,
  decideCouponVerdict,
} from "./coupon-decision";

/**
 * THE DECLARED ORDER OF THE VERDICT (spec 0153 / contract M0/M1; spec 0065 phase C, over the
 * coupon since spec 0102), which the contract calls normative: «si aplican varios, va el
 * primero». The cases at the bottom are the ones that can only pass if the order is the
 * declared one, because they violate TWO rules at once.
 */

const NOW = new Date("2026-09-16T12:00:00.000Z");
const DAY = 86_400_000;
const TZ = "America/Guayaquil";

const stampsExtra = (over: Partial<ExtraFacts> = {}): ExtraFacts => ({
  kind: "extra_stamps",
  units: 2,
  membership: { programId: "p1", stampsCount: 4, pointsBalance: 0 },
  program: { id: "p1", status: "active", kind: "stamps" },
  ...over,
});

function decide(over: Partial<VerdictFacts> = {}) {
  return decideCouponVerdict({
    validFrom: new Date(NOW.getTime() - DAY),
    validUntil: new Date(NOW.getTime() + DAY),
    redeemed: false,
    couponMaxRedemptions: 100,
    redeemedCount: 0,
    usedToday: false,
    extra: null,
    timezone: TZ,
    now: NOW,
    ...over,
  });
}

const future = {
  validFrom: new Date("2026-09-20T03:00:00.000Z"),
  validUntil: new Date(NOW.getTime() + 5 * DAY),
};
const expired = {
  validFrom: new Date(NOW.getTime() - 5 * DAY),
  validUntil: new Date("2026-09-15T03:00:00.000Z"),
};

describe("decideCouponVerdict (spec 0153)", () => {
  it("a coupon inside its validity, unused, under the cap: valid", () => {
    expect(decide()).toEqual({ valid: true });
  });

  it("not yet valid → `coupon_not_yet_valid`, with the date in the BUSINESS's zone", () => {
    // 03:00Z of the 20th is 22:00 of the 19th in Guayaquil (UTC-5): the local date wins.
    expect(decide(future)).toEqual({
      valid: false,
      code: "coupon_not_yet_valid",
      message: "Este cupón vale desde el 19/09/2026.",
    });
  });

  it("past its end → `coupon_expired`, with the date in the BUSINESS's zone", () => {
    expect(decide(expired)).toEqual({
      valid: false,
      code: "coupon_expired",
      message: "Este cupón venció el 14/09/2026.",
    });
  });

  it("the edges are INSIDE: valid «from now» and «until now» are valid now", () => {
    expect(decide({ validUntil: NOW })).toEqual({ valid: true });
    expect(decide({ validFrom: NOW })).toEqual({ valid: true });
  });

  it("a PAUSED or ENDED campaign is not a reason: the verdict never receives the status", () => {
    // ADR 0094 §2. The facts of the campaign are its cap and nothing else; an extra key
    // is ignored, so a campaign reading `paused` still hands over a coupon in date.
    for (const status of ["paused", "ended", "archived"])
      expect(decide({ status } as Partial<VerdictFacts>), status).toEqual({
        valid: true,
      });
  });

  it("a coupon already handed over is `already_redeemed`", () => {
    expect(decide({ redeemed: true })).toEqual({
      valid: false,
      code: "already_redeemed",
      message: "Este cupón ya fue canjeado.",
    });
  });

  it("a redemption of today here is `coupon_daily_limit`", () => {
    expect(decide({ usedToday: true })).toEqual({
      valid: false,
      code: "coupon_daily_limit",
      message: "El cliente ya usó un cupón hoy en este comercio.",
    });
  });

  it("the campaign cap is `coupon_cap_reached`, and it is `>=`, not `>`", () => {
    const cap = (redeemedCount: number) =>
      decide({ couponMaxRedemptions: 3, redeemedCount });
    expect(cap(2)).toEqual({ valid: true });
    expect(cap(3)).toEqual({
      valid: false,
      code: "coupon_cap_reached",
      message: "Se agotaron los cupones de esta campaña.",
    });
    expect(cap(4)).toMatchObject({ code: "coupon_cap_reached" });
  });

  it("a null cap is NO cap, never a cap of zero", () => {
    expect(decide({ couponMaxRedemptions: null, redeemedCount: 999 })).toEqual({
      valid: true,
    });
  });

  it("an extra_* whose unit is still the program's is valid; otherwise `program_changed`", () => {
    expect(decide({ extra: stampsExtra() })).toEqual({ valid: true });
    const changed = {
      valid: false,
      code: "program_changed",
      message:
        "El programa de fidelidad cambió: este cupón ya no se puede canjear.",
    };
    expect(
      decide({
        extra: stampsExtra({
          program: { id: "p1", status: "active", kind: "points" },
        }),
      }),
    ).toEqual(changed);
    expect(decide({ extra: stampsExtra({ program: null }) })).toEqual(changed);
    expect(decide({ extra: stampsExtra({ membership: null }) })).toEqual(
      changed,
    );
  });

  // ─── The order, which is the part a comment cannot prove ───────────────────────
  it("ORDER: an expired coupon already used today is `coupon_expired`", () => {
    expect(decide({ ...expired, usedToday: true })).toMatchObject({
      code: "coupon_expired",
    });
  });

  it("ORDER: the dates win over `already_redeemed` and over the cap", () => {
    expect(
      decide({
        ...expired,
        redeemed: true,
        couponMaxRedemptions: 1,
        redeemedCount: 5,
      }),
    ).toMatchObject({ code: "coupon_expired" });
    expect(decide({ ...future, redeemed: true })).toMatchObject({
      code: "coupon_not_yet_valid",
    });
  });

  it("ORDER: `already_redeemed` wins over the day and the cap: it is about THIS coupon", () => {
    expect(
      decide({
        redeemed: true,
        usedToday: true,
        couponMaxRedemptions: 1,
        redeemedCount: 5,
      }),
    ).toMatchObject({ code: "already_redeemed" });
  });

  it("ORDER: the daily limit wins over the cap, and the cap over the program", () => {
    expect(
      decide({ usedToday: true, couponMaxRedemptions: 1, redeemedCount: 5 }),
    ).toMatchObject({ code: "coupon_daily_limit" });
    expect(
      decide({
        couponMaxRedemptions: 1,
        redeemedCount: 5,
        extra: stampsExtra({ program: null }),
      }),
    ).toMatchObject({ code: "coupon_cap_reached" });
  });
});
