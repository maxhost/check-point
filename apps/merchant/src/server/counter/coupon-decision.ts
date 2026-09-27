/**
 * Whether THIS campaign coupon may be handed over right now (spec 0065, «Cupon —
 * mostrador», paso 3; over the coupon since spec 0102). Pure, and that is what makes the
 * normative order verifiable: the ORDER of the answers is a decision with a table of cases
 * as its oracle, not a comment.
 *
 * It runs UNDER the campaign's and the coupon's `FOR UPDATE`, over rows re-read inside the
 * transaction. Everything here is therefore decided on fresh state; a version of this
 * that read before the lock would let two operators pass the cap at the same instant.
 *
 * WHAT IS NOT HERE, on purpose:
 *  - **Idempotency.** It is step 2 and it happens BEFORE any of this, because a legit
 *    retry of the counter (network timeout, same `clientRequestId`) must answer 200 with
 *    the row it already created — not walk into `already_redeemed`.
 *  - **Ownership.** A coupon of another business is resolved as a 404 by the scoped read,
 *    never as a 403: a 403 would confirm the id exists.
 *  - **The turn and the campaign's STATUS** (ADR 0094 §2). An issued coupon belongs to the
 *    consumer: pausing or ending the campaign, or cancelling the turn that issued it, does
 *    not cut it. That is why the campaign facts carry the cap and nothing else. A holdout
 *    has no coupon at all — it is never issued one (`marketing/coupon-issue.ts`).
 */

export type CouponFacts = {
  validFrom: Date;
  validUntil: Date;
  /** A redemption row already points at this coupon. */
  redeemed: boolean;
};

export type CouponCampaignFacts = {
  couponMaxRedemptions: number | null;
};

export type CouponDecision =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string };

const OK: CouponDecision = { ok: true };

function no(status: number, code: string, message: string): CouponDecision {
  return { ok: false, status, code, message };
}

/**
 * THE DECLARED ORDER, and it is normative:
 *
 *  1. **`coupon_not_active`** — `now` is outside `valid_from..valid_until` (edges
 *     inside). A coupon that does not run yet or ran out.
 *  2. **`already_redeemed`** — this coupon was handed over already. It is about THIS
 *     coupon, so it precedes anything about the campaign.
 *  3. **`coupon_cap_reached`** — the campaign's `coupon_max_redemptions` is used up.
 *     Last, because it is a property of the campaign and not of the person at the
 *     counter: if the coupon itself were invalid, saying «se acabaron los cupones» would
 *     send the operator to look at the wrong thing.
 *
 * A null cap is treated as «no cap» rather than as 0: inventing a cap of zero would refuse
 * a coupon the owner declared unlimited.
 */
export function decideCouponRedemption(facts: {
  coupon: CouponFacts;
  campaign: CouponCampaignFacts;
  redeemedCount: number;
  now: Date;
}): CouponDecision {
  const { coupon, campaign, now } = facts;
  if (now < coupon.validFrom || now > coupon.validUntil)
    return no(
      409,
      "coupon_not_active",
      "Este cupón ya no está vigente. Pedile al cliente que abra su pase.",
    );

  if (coupon.redeemed)
    return no(409, "already_redeemed", "Este cupón ya fue canjeado.");

  if (
    campaign.couponMaxRedemptions !== null &&
    facts.redeemedCount >= campaign.couponMaxRedemptions
  )
    return no(
      409,
      "coupon_cap_reached",
      "Se agotaron los cupones de esta campaña.",
    );

  return OK;
}
