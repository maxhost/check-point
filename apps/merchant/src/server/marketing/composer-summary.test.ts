import { describe, expect, it } from "vitest";
import {
  BUSINESS_QUOTA,
  remainingQuota,
  summarizeComposer,
} from "./composer-summary";

/**
 * The two numbers of block 5 (spec 0065). This is the oracle the DECISION has; that the
 * composer renders them is `screens.test.ts`, and what the owner reads on a real screen
 * is the oracle that defines (CLAUDE.md).
 */
describe("summarizeComposer (spec 0065, block 5)", () => {
  const noCoupon = { couponCost: null, couponMaxRedemptions: null };

  it("the turns are the SMALLER of the reachable audience and the free quota", () => {
    expect(
      summarizeComposer({ reachable: 12, remainingQuota: 50, ...noCoupon })
        .turns,
    ).toBe(12);
    expect(
      summarizeComposer({ reachable: 900, remainingQuota: 50, ...noCoupon })
        .turns,
    ).toBe(50);
  });

  it("a business with the quota full occupies zero turns, not a negative number", () => {
    expect(remainingQuota(BUSINESS_QUOTA)).toBe(0);
    expect(remainingQuota(BUSINESS_QUOTA + 7)).toBe(0);
    expect(
      summarizeComposer({ reachable: 30, remainingQuota: 0, ...noCoupon })
        .turns,
    ).toBe(0);
  });

  it("no coupon is no cost — `null`, never «0.00»", () => {
    expect(
      summarizeComposer({ reachable: 5, remainingQuota: 50, ...noCoupon })
        .maxCost,
    ).toBeNull();
    // Half a coupon is still no cost: the trio travels together or not at all.
    expect(
      summarizeComposer({
        reachable: 5,
        remainingQuota: 50,
        couponCost: "1.50",
        couponMaxRedemptions: null,
      }).maxCost,
    ).toBeNull();
  });

  it("the maximum cost is `costo × tope`, in cents and not in floats", () => {
    // `0.1 * 3` is 0.30000000000000004 in IEEE: the assertion is on the STRING for that
    // reason, and it is what the owner reads next to their money.
    expect(
      summarizeComposer({
        reachable: 5,
        remainingQuota: 50,
        couponCost: "0.10",
        couponMaxRedemptions: 3,
      }).maxCost,
    ).toBe("0.30");
    expect(
      summarizeComposer({
        reachable: 5,
        remainingQuota: 50,
        couponCost: "2.35",
        couponMaxRedemptions: 200,
      }).maxCost,
    ).toBe("470.00");
  });

  it("a cost the owner is still typing is `null`, never «NaN»", () => {
    for (const couponCost of ["", "abc", "-3"])
      expect(
        summarizeComposer({
          reachable: 5,
          remainingQuota: 50,
          couponCost,
          couponMaxRedemptions: 10,
        }).maxCost,
      ).toBeNull();
  });
});
