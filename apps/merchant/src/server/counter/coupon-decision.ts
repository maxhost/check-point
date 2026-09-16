/**
 * Whether THIS turn's coupon may be handed over right now (spec 0065, «Cupon —
 * mostrador», paso 3). Pure, and that is what makes the spec's normative sentence —
 * «con el orden de guardas declarado en el docblock como normativo» — verifiable: the
 * ORDER of the answers is a decision with a table of cases as its oracle, not a comment.
 *
 * It runs UNDER the campaign's and the turn's `FOR UPDATE`, over rows re-read inside the
 * transaction. Everything here is therefore decided on fresh state; a version of this
 * that read before the lock would let two operators pass the cap at the same instant.
 *
 * WHAT IS NOT HERE, on purpose:
 *  - **Idempotency.** It is step 2 and it happens BEFORE any of this, because a legit
 *    retry of the counter (network timeout, same `clientRequestId`) must answer 200 with
 *    the row it already created — not walk into `already_redeemed`. Putting it here would
 *    reintroduce exactly the contradiction the adversarial review of this spec caught.
 *  - **Ownership.** A turn of another business is resolved as a 404 by the scoped read,
 *    never as a 403: a 403 would confirm the id exists.
 */

export type CouponTurnFacts = {
  status: string;
  holdout: boolean;
  couponLabelSnapshot: string | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  /** Already `'coupon_redeemed'` when some OTHER request redeemed this turn. */
  outcome: string | null;
};

export type CouponCampaignFacts = {
  status: string;
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
 *  1. **`turn_not_active`** — everything that makes this turn unusable: the turn is not
 *     `active`, it is a `holdout` (decided but never placed: the consumer never saw the
 *     offer, so there is nothing to honour), it carries no coupon, the window has not
 *     opened or has closed, or the CAMPAIGN is no longer `active`. They collapse into one
 *     answer on purpose — from the counter's side they are the same event («este cupón no
 *     corre»), and splitting them would tell an operator holding somebody else's phone
 *     which of the five it was.
 *  2. **`already_redeemed`** — this turn's coupon was handed over already. It is about
 *     THIS turn, so it precedes anything about the campaign.
 *  3. **`coupon_cap_reached`** — the campaign's `coupon_max_redemptions` is used up.
 *     Last, because it is a property of the campaign and not of the person at the
 *     counter: if the turn itself were invalid, saying «se acabaron los cupones» would
 *     send the operator to look at the wrong thing.
 *
 * A campaign with `coupon_max_redemptions` NULL cannot reach here — a turn only carries
 * `coupon_label_snapshot` when the campaign had the whole coupon trio — but a null cap is
 * treated as «no cap» rather than as 0, because inventing a cap of zero would refuse a
 * coupon the owner declared unlimited.
 */
export function decideCouponRedemption(facts: {
  turn: CouponTurnFacts;
  campaign: CouponCampaignFacts;
  redeemedCount: number;
  now: Date;
}): CouponDecision {
  const { turn, campaign, now } = facts;
  const unusable =
    turn.status !== "active" ||
    turn.holdout ||
    turn.couponLabelSnapshot === null ||
    campaign.status !== "active" ||
    turn.windowStart === null ||
    turn.windowEnd === null ||
    now < turn.windowStart ||
    now > turn.windowEnd;
  if (unusable)
    return no(
      409,
      "turn_not_active",
      "Este cupón ya no está vigente. Pedile al cliente que abra su pase.",
    );

  if (turn.outcome === "coupon_redeemed")
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
