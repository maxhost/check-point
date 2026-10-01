import type { TurnActivation } from "./placement-plan";
import type { CouponKind, DiscountUnit } from "./reward-input";

/**
 * The campaign's REWARD as the issuer reads it (spec 0106 / ADR 0098 §8), plus the
 * business currency at that moment. `kind` is `null` only when the campaign has no coupon.
 */
export type CouponReward = {
  kind: CouponKind | null;
  productId: string | null;
  discountUnit: DiscountUnit | null;
  discountValue: string | null;
  extraUnits: number | null;
  rule: string | null;
  currencyCode: string;
};

/** The reward columns of `core.campaign_coupon`. */
export type RewardSnapshot = {
  kindSnapshot: CouponKind;
  productId: string | null;
  discountUnitSnapshot: DiscountUnit | null;
  discountValueSnapshot: string | null;
  currencyCodeSnapshot: string | null;
  extraUnitsSnapshot: number | null;
  ruleSnapshot: string | null;
};

/**
 * The WHOLE reward is copied onto the coupon: editing the campaign or deleting the product
 * later never changes a coupon already given (ADR 0098 §8). The currency is copied only
 * for a discount by `amount` — the one value that means nothing without it
 * (`core_campaign_coupon_reward_currency_check`). A label with no kind cannot exist after
 * migration `0049`; if it ever did, it is the label-only reward it always was.
 */
export function rewardSnapshot(reward: CouponReward): RewardSnapshot {
  return {
    kindSnapshot: reward.kind ?? "free_product",
    productId: reward.productId,
    discountUnitSnapshot: reward.discountUnit,
    discountValueSnapshot: reward.discountValue,
    currencyCodeSnapshot:
      reward.discountUnit === "amount" ? reward.currencyCode : null,
    extraUnitsSnapshot: reward.extraUnits,
    ruleSnapshot: reward.rule,
  };
}

/**
 * Whether activating THIS turn issues a campaign coupon, and which one (spec 0102 /
 * ADR 0093 §2). PURE: the applier (`placement.ts`) only reads the campaign's `ends_at`
 * and inserts what this returns.
 *
 *  - **A holdout issues nothing.** `placement-plan.ts` copies the campaign's coupon label
 *    onto EVERY activation, holdouts included (the pass text needs it), so the label alone
 *    does not say «this consumer saw the offer». A holdout is never placed in the pass:
 *    handing it a coupon would give the base line the treatment it exists to lack.
 *  - **No label, no coupon.**
 *  - **Valid from the window's start until the campaign's `ends_at`, COPIED** (ADR 0094
 *    §1). A campaign with a coupon always has `ends_at` (`CHECK
 *    core_campaign_coupon_needs_end_check`); `null` here is answered with no coupon rather
 *    than with an invented validity.
 *  - **An `ends_at` already reached issues nothing.** A turn QUEUED while the campaign was
 *    in date may be ACTIVATED after its `ends_at`: nothing closes a campaign when its date
 *    passes (`campaign-actions.ts`) and `loadQueuedTurns` does not look at the date. That
 *    coupon would be born expired, and inserting it would violate
 *    `core_campaign_coupon_validity_check` and abort the whole tick.
 *
 * `cost_snapshot` falls back to `"0.00"`, the same fallback the counter used when the
 * coupon lived in the turn.
 */
export type CouponToIssue = RewardSnapshot & {
  turnId: string;
  labelSnapshot: string;
  costSnapshot: string;
  validFrom: Date;
  validUntil: Date;
};

export function couponToIssue(
  activation: Pick<
    TurnActivation,
    | "turnId"
    | "holdout"
    | "windowStart"
    | "couponLabelSnapshot"
    | "couponCostSnapshot"
    | "couponReward"
  >,
  campaignEndsAt: Date | null,
): CouponToIssue | null {
  if (activation.holdout) return null;
  if (activation.couponLabelSnapshot === null) return null;
  if (campaignEndsAt === null || campaignEndsAt <= activation.windowStart)
    return null;
  return {
    ...rewardSnapshot(activation.couponReward),
    turnId: activation.turnId,
    labelSnapshot: activation.couponLabelSnapshot,
    costSnapshot: activation.couponCostSnapshot ?? "0.00",
    validFrom: activation.windowStart,
    validUntil: campaignEndsAt,
  };
}

/**
 * The same decision for the PUSH channel (spec 0103 §7 / ADR 0095 §8), PURE: the coupon is
 * issued when the push is DELIVERED (`sent_at`), never when it is decided — a cancelled push
 * would otherwise leave a coupon the consumer never saw. `null` when:
 *  - the push is a holdout (never sent: the control group gets no treatment);
 *  - the campaign has no coupon, or no `ends_at`, or an `ends_at` already reached;
 *  - the consumer ALREADY holds an unredeemed coupon of this campaign (owner's OK, point
 *    1 of the spec): the notice still goes out, a second coupon does not.
 */
export type PushCouponToIssue = Omit<CouponToIssue, "turnId"> & {
  pushId: string;
};

export function pushCouponToIssue(push: {
  pushId: string;
  holdout: boolean;
  couponLabel: string | null;
  couponCost: string | null;
  reward: CouponReward;
  endsAt: Date | null;
  sentAt: Date;
  hasUnredeemedCoupon: boolean;
}): PushCouponToIssue | null {
  if (push.holdout) return null;
  if (push.couponLabel === null) return null;
  if (push.endsAt === null || push.endsAt <= push.sentAt) return null;
  if (push.hasUnredeemedCoupon) return null;
  return {
    ...rewardSnapshot(push.reward),
    pushId: push.pushId,
    labelSnapshot: push.couponLabel,
    costSnapshot: push.couponCost ?? "0.00",
    validFrom: push.sentAt,
    validUntil: push.endsAt,
  };
}
