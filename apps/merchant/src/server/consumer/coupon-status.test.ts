import { describe, expect, it } from "vitest";
import { couponStatus } from "./coupon-status";

/** Spec 0106 E3b — the precedence of the calculated state, the first that applies. */
describe("couponStatus", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  const future = new Date("2026-10-01T00:00:00Z");
  const past = new Date("2026-09-20T00:00:00Z");
  const at = (over: Partial<Parameters<typeof couponStatus>[0]>) =>
    couponStatus({
      redeemedAt: null,
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
