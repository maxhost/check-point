import { describe, expect, it } from "vitest";
import { couponStatus } from "@mi-pasaporte/domain/server/consumer/coupon-status";

/** Spec 0106 E3b + spec 0107 (`scheduled`) — the precedence of the calculated state, the
 * first that applies: redeemed → expired → unavailable → scheduled → valid. */
describe("couponStatus", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  const future = new Date("2026-10-01T00:00:00Z");
  const past = new Date("2026-09-20T00:00:00Z");
  /** Tomorrow local: the welcome gift «desde mañana». */
  const tomorrow = new Date("2026-09-28T05:00:00Z");
  const at = (over: Partial<Parameters<typeof couponStatus>[0]>) =>
    couponStatus({
      redeemedAt: null,
      validFrom: past,
      validUntil: future,
      businessStatus: "active",
      now,
      ...over,
    });

  it.each([
    ["valid", {}, "valid", null],
    [
      "suspended",
      { businessStatus: "suspended" },
      "unavailable",
      "business_suspended",
    ],
    ["closed", { businessStatus: "closed" }, "unavailable", "business_closed"],
    ["scheduled", { validFrom: tomorrow }, "scheduled", null],
    ["valid from exactly now", { validFrom: now }, "valid", null],
    [
      "unavailable beats scheduled",
      { validFrom: tomorrow, businessStatus: "suspended" },
      "unavailable",
      "business_suspended",
    ],
    [
      "expired beats unavailable",
      { validUntil: past, businessStatus: "suspended" },
      "expired",
      null,
    ],
    [
      "redeemed beats expired",
      { redeemedAt: past, validUntil: past },
      "redeemed",
      null,
    ],
  ] as const)("%s", (_name, over, status, reason) => {
    expect(at(over)).toEqual({ status, reason });
  });
});
