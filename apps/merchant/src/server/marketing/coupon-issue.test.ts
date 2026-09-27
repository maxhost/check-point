import { describe, expect, it } from "vitest";
import { couponToIssue } from "./coupon-issue";

/**
 * Spec 0102 — which activation issues a campaign coupon. PURE; the WIRING in `applyPlan`
 * has its own oracle in `marketing-coupon-issue.neon.integration.test.ts`.
 */

const START = new Date("2026-09-16T12:00:00.000Z");
const ENDS = new Date("2026-09-30T05:00:00.000Z");

const activation = (
  over: Partial<Parameters<typeof couponToIssue>[0]> = {},
) => ({
  turnId: "11111111-1111-4111-8111-111111111111",
  holdout: false,
  windowStart: START,
  couponLabelSnapshot: "2x1 en picadas",
  couponCostSnapshot: "2.50",
  ...over,
});

describe("couponToIssue", () => {
  it("a placed turn with a coupon issues one valid from the window's start until the campaign's ends_at", () => {
    expect(couponToIssue(activation(), ENDS)).toEqual({
      turnId: "11111111-1111-4111-8111-111111111111",
      labelSnapshot: "2x1 en picadas",
      costSnapshot: "2.50",
      validFrom: START,
      validUntil: ENDS,
    });
  });

  it("a HOLDOUT issues nothing, although the plan copied the label onto it", () => {
    expect(couponToIssue(activation({ holdout: true }), ENDS)).toBeNull();
  });

  it("no label, no coupon", () => {
    expect(
      couponToIssue(activation({ couponLabelSnapshot: null }), ENDS),
    ).toBeNull();
  });

  it("a null cost is snapshotted as 0.00", () => {
    expect(
      couponToIssue(activation({ couponCostSnapshot: null }), ENDS)
        ?.costSnapshot,
    ).toBe("0.00");
  });

  it("no ends_at, or an ends_at already reached, issues nothing instead of an invalid row", () => {
    expect(couponToIssue(activation(), null)).toBeNull();
    expect(couponToIssue(activation(), START)).toBeNull();
    expect(
      couponToIssue(activation(), new Date(START.getTime() - 1)),
    ).toBeNull();
  });
});
