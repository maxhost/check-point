import { describe, expect, it } from "vitest";
import {
  type CouponReward,
  couponToIssue,
  pushCouponToIssue,
  rewardSnapshot,
} from "@mi-pasaporte/domain/server/marketing/coupon-issue";

/**
 * Spec 0102 — which activation issues a campaign coupon. PURE; the WIRING in `applyPlan`
 * has its own oracle in `marketing-coupon-issue.neon.integration.test.ts`.
 */

const START = new Date("2026-09-16T12:00:00.000Z");
const ENDS = new Date("2026-09-30T05:00:00.000Z");
const PRODUCT = "33333333-3333-4333-8333-333333333333";

/** Spec 0106: the reward travels whole to the coupon. A 2x1 with product and rule, so a
 * copy that drops the type, the product or the rule shows in the `toEqual`s below. */
const REWARD: CouponReward = {
  kind: "two_for_one",
  productId: PRODUCT,
  discountUnit: null,
  discountValue: null,
  extraUnits: null,
  rule: "Solo tamaño mediano",
  currencyCode: "USD",
};
const SNAPSHOT = {
  kindSnapshot: "two_for_one",
  productId: PRODUCT,
  discountUnitSnapshot: null,
  discountValueSnapshot: null,
  currencyCodeSnapshot: null,
  extraUnitsSnapshot: null,
  ruleSnapshot: "Solo tamaño mediano",
};

const activation = (
  over: Partial<Parameters<typeof couponToIssue>[0]> = {},
) => ({
  turnId: "11111111-1111-4111-8111-111111111111",
  holdout: false,
  windowStart: START,
  couponLabelSnapshot: "2x1 en picadas",
  couponCostSnapshot: "2.50",
  couponReward: REWARD,
  ...over,
});

describe("couponToIssue", () => {
  it("a placed turn with a coupon issues one valid from the window's start until the campaign's ends_at", () => {
    expect(couponToIssue(activation(), ENDS)).toEqual({
      ...SNAPSHOT,
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

/** Spec 0103 §7 — the push channel's coupon. PURE; the wiring (the worker issuing it at
 * delivery) is pinned by `marketing-push-delivery.neon.integration.test.ts`. */
describe("pushCouponToIssue", () => {
  const push = (
    over: Partial<Parameters<typeof pushCouponToIssue>[0]> = {},
  ) => ({
    pushId: "22222222-2222-4222-8222-222222222222",
    holdout: false,
    couponLabel: "2x1 en picadas",
    couponCost: "2.50",
    reward: REWARD,
    endsAt: ENDS,
    sentAt: START,
    hasUnredeemedCoupon: false,
    ...over,
  });

  it("a delivered push with a coupon issues one valid from sent_at until ends_at", () => {
    expect(pushCouponToIssue(push())).toEqual({
      ...SNAPSHOT,
      pushId: "22222222-2222-4222-8222-222222222222",
      labelSnapshot: "2x1 en picadas",
      costSnapshot: "2.50",
      validFrom: START,
      validUntil: ENDS,
    });
    expect(pushCouponToIssue(push({ couponCost: null }))?.costSnapshot).toBe(
      "0.00",
    );
  });

  it("holdout, no label, no/elapsed ends_at, or an unredeemed coupon already held → null", () => {
    expect(pushCouponToIssue(push({ holdout: true }))).toBeNull();
    expect(pushCouponToIssue(push({ couponLabel: null }))).toBeNull();
    expect(pushCouponToIssue(push({ endsAt: null }))).toBeNull();
    expect(pushCouponToIssue(push({ endsAt: START }))).toBeNull();
    expect(pushCouponToIssue(push({ hasUnredeemedCoupon: true }))).toBeNull();
  });
});

/** Spec 0106 / ADR 0098 §8 — what of the reward lands on the coupon. */
describe("rewardSnapshot", () => {
  it("a discount by AMOUNT copies the business currency; by percent it does not", () => {
    const amount = {
      ...REWARD,
      kind: "discount",
      productId: null,
      rule: null,
    } as const;
    expect(
      rewardSnapshot({
        ...amount,
        discountUnit: "amount",
        discountValue: "5.00",
      }),
    ).toMatchObject({
      kindSnapshot: "discount",
      discountUnitSnapshot: "amount",
      discountValueSnapshot: "5.00",
      currencyCodeSnapshot: "USD",
    });
    expect(
      rewardSnapshot({
        ...amount,
        discountUnit: "percent",
        discountValue: "10.00",
      }).currencyCodeSnapshot,
    ).toBeNull();
  });

  it("extra units travel; a label with no kind is the label-only `free_product`", () => {
    expect(
      rewardSnapshot({
        ...REWARD,
        kind: "extra_stamps",
        productId: null,
        extraUnits: 3,
      }),
    ).toMatchObject({ kindSnapshot: "extra_stamps", extraUnitsSnapshot: 3 });
    expect(rewardSnapshot({ ...REWARD, kind: null }).kindSnapshot).toBe(
      "free_product",
    );
  });
});
