import { describe, expect, it } from "vitest";
import {
  capAllows,
  decideWelcomeGift,
  localMonthStart,
  startOfNextLocalDay,
  welcomeValidFrom,
  welcomeValidUntil,
} from "@mi-pasaporte/domain/server/marketing/welcome-rules";

/**
 * The PURE rules of the welcome gift (spec 0107 §3). The zones: Guayaquil (UTC−5, no DST)
 * is the seed's; Buenos Aires (UTC−3) and Madrid (DST) prove the rule is the zone's and
 * not a fixed offset.
 */
const GYE = "America/Guayaquil";

describe("welcome time rules", () => {
  it("startOfNextLocalDay: 21:00 local in Guayaquil (02:00Z of the next UTC day) → 05:00Z of that day", () => {
    expect(
      startOfNextLocalDay(
        new Date("2026-10-02T02:00:00.000Z"),
        GYE,
      ).toISOString(),
    ).toBe("2026-10-02T05:00:00.000Z");
    expect(
      startOfNextLocalDay(
        new Date("2026-10-01T10:00:00.000Z"),
        GYE,
      ).toISOString(),
    ).toBe("2026-10-02T05:00:00.000Z");
    // Month and year roll over.
    expect(
      startOfNextLocalDay(
        new Date("2026-12-31T20:00:00.000Z"),
        GYE,
      ).toISOString(),
    ).toBe("2027-01-01T05:00:00.000Z");
    expect(
      startOfNextLocalDay(
        new Date("2026-10-01T12:00:00.000Z"),
        "America/Argentina/Buenos_Aires",
      ).toISOString(),
    ).toBe("2026-10-02T03:00:00.000Z");
  });

  it("startOfNextLocalDay crosses a DST change on the zone's clock", () => {
    // Madrid leaves summer time on 2026-10-25 (03:00 CEST → 02:00 CET).
    expect(
      startOfNextLocalDay(
        new Date("2026-10-24T12:00:00.000Z"),
        "Europe/Madrid",
      ).toISOString(),
    ).toBe("2026-10-24T22:00:00.000Z");
    expect(
      startOfNextLocalDay(
        new Date("2026-10-25T12:00:00.000Z"),
        "Europe/Madrid",
      ).toISOString(),
    ).toBe("2026-10-25T23:00:00.000Z");
  });

  it("localMonthStart: 30-09 21:00 local is still SEPTEMBER; 01-10 10:00 local opens at 05:00Z", () => {
    expect(
      localMonthStart(new Date("2026-10-01T02:00:00.000Z"), GYE).toISOString(),
    ).toBe("2026-09-01T05:00:00.000Z");
    expect(
      localMonthStart(new Date("2026-10-01T15:00:00.000Z"), GYE).toISOString(),
    ).toBe("2026-10-01T05:00:00.000Z");
  });

  it("valid from next day or now; valid until delivery + days", () => {
    const now = new Date("2026-10-02T02:00:00.000Z");
    expect(welcomeValidFrom(now, "same_visit", GYE)).toEqual(now);
    expect(welcomeValidFrom(now, "next_day", GYE).toISOString()).toBe(
      "2026-10-02T05:00:00.000Z",
    );
    expect(welcomeValidUntil(now, 15).toISOString()).toBe(
      "2026-10-17T02:00:00.000Z",
    );
  });
});

describe("decideWelcomeGift", () => {
  const base = {
    enrolledAt: new Date("2026-10-01T00:00:00.000Z"),
    activatedAt: new Date("2026-09-01T00:00:00.000Z"),
    homeLaunched: true,
    pushSubscribed: true,
    deviceAlreadyGifted: false,
    crossCouponFromBusiness: false,
  };

  it("requires home launch and active push before issuing the gift", () => {
    expect(decideWelcomeGift(base)).toBe("issue");
    expect(
      decideWelcomeGift({
        ...base,
        enrolledAt: new Date("2026-08-31T23:59:59.000Z"),
      }),
    ).toBe("enrolled_before");
    // The switch-on instant itself counts as «after».
    expect(decideWelcomeGift({ ...base, enrolledAt: base.activatedAt })).toBe(
      "issue",
    );
    expect(decideWelcomeGift({ ...base, homeLaunched: false })).toBe(
      "home_not_opened",
    );
    expect(decideWelcomeGift({ ...base, pushSubscribed: false })).toBe(
      "notifications_not_active",
    );
    expect(decideWelcomeGift({ ...base, deviceAlreadyGifted: true })).toBe(
      "device_already_gifted",
    );
  });

  it("spec 0136: a cross coupon of the business is `came_by_cross`, right after `enrolled_before`", () => {
    const cross = { ...base, crossCouponFromBusiness: true };
    expect(decideWelcomeGift(cross)).toBe("came_by_cross");
    // After `enrolled_before` …
    expect(
      decideWelcomeGift({
        ...cross,
        enrolledAt: new Date("2026-08-31T23:59:59.000Z"),
      }),
    ).toBe("enrolled_before");
    // … and before every installation fact.
    expect(decideWelcomeGift({ ...cross, homeLaunched: false })).toBe(
      "came_by_cross",
    );
    expect(decideWelcomeGift({ ...cross, deviceAlreadyGifted: true })).toBe(
      "came_by_cross",
    );
  });

  it("capAllows is strict: cap N gives N, never N + 1", () => {
    expect(capAllows(0, 1)).toBe(true);
    expect(capAllows(1, 1)).toBe(false);
    expect(capAllows(49, 50)).toBe(true);
    expect(capAllows(50, 50)).toBe(false);
  });
});
