import type { TurnActivation } from "./placement-plan";

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
export type CouponToIssue = {
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
  >,
  campaignEndsAt: Date | null,
): CouponToIssue | null {
  if (activation.holdout) return null;
  if (activation.couponLabelSnapshot === null) return null;
  if (campaignEndsAt === null || campaignEndsAt <= activation.windowStart)
    return null;
  return {
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
  endsAt: Date | null;
  sentAt: Date;
  hasUnredeemedCoupon: boolean;
}): PushCouponToIssue | null {
  if (push.holdout) return null;
  if (push.couponLabel === null) return null;
  if (push.endsAt === null || push.endsAt <= push.sentAt) return null;
  if (push.hasUnredeemedCoupon) return null;
  return {
    pushId: push.pushId,
    labelSnapshot: push.couponLabel,
    costSnapshot: push.couponCost ?? "0.00",
    validFrom: push.sentAt,
    validUntil: push.endsAt,
  };
}
