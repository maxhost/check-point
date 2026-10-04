import {
  type ExtraKind,
  PROGRAM_CHANGED,
  decideExtraGrant,
} from "./coupon-extras";

/**
 * THE VERDICT OF A CHOSEN COUPON (spec 0153 / ADR 0120; spec 0065 «Cupon — mostrador» paso 3,
 * over the coupon since spec 0102): whether THIS coupon may be applied right now. PURE, and
 * it is the ONE rule for painting and for charging: the counter's `couponState.selected`
 * carries it (`coupon-state.ts`, read without locks) and the sale (`grant-coupon.ts`) decides
 * with it under the campaign's, the coupon's and the business-customer's `FOR UPDATE`, over
 * facts re-read inside the transaction. What the counter paints green is what the sale
 * accepts — except the cart and the currency, which only the sale sees (`coupon-discount.ts`).
 *
 * WHAT IS NOT HERE, on purpose:
 *  - **Idempotency.** It happens BEFORE any of this in the sale, because a legit retry of the
 *    counter (network timeout, same `clientRequestId`) must answer 200 with the order it
 *    already created — not walk into `already_redeemed`.
 *  - **Ownership.** A coupon of another business is resolved as a 404 by the scoped read,
 *    never as a 403: a 403 would confirm the id exists.
 *  - **The turn and the campaign's STATUS** (ADR 0094 §2). An issued coupon belongs to the
 *    consumer: pausing or ending the campaign, or cancelling the turn that issued it, does
 *    not cut it. That is why the campaign facts carry the cap and nothing else.
 */

export type VerdictCode =
  | "coupon_not_yet_valid"
  | "coupon_expired"
  | "already_redeemed"
  | "coupon_daily_limit"
  | "coupon_cap_reached"
  | "program_changed";

export type CouponVerdict =
  { valid: true } | { valid: false; code: VerdictCode; message: string };

/** What `decideExtraGrant` needs, for an `extra_*` coupon (`null` for every other kind).
 * `membership: null` — the coupon's card does not exist in this business: nothing to credit. */
export type ExtraFacts = {
  kind: ExtraKind;
  units: number;
  membership: {
    programId: string;
    stampsCount: number;
    pointsBalance: number;
  } | null;
  program: { id: string; status: string; kind: string } | null;
};

export type VerdictFacts = {
  validFrom: Date;
  validUntil: Date;
  /** A redemption row already points at this coupon. */
  redeemed: boolean;
  /** The campaign's `coupon_max_redemptions` (`null` = no cap) and its redemptions so far. */
  couponMaxRedemptions: number | null;
  redeemedCount: number;
  /** This consumer has a redemption row of today (business-local day) at this business. */
  usedToday: boolean;
  extra: ExtraFacts | null;
  /** `business.timezone`: the dates of the messages are the business's local ones. */
  timezone: string;
  now: Date;
};

/** `dd/mm/aaaa` in the business's time zone (contract 0153 M0/M1). */
export function verdictDate(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(at);
}

function no(code: VerdictCode, message: string): CouponVerdict {
  return { valid: false, code, message };
}

/**
 * THE DECLARED ORDER, and it is normative (contract 0153: «si aplican varios, va el primero»):
 *
 *  1. **`coupon_not_yet_valid`** — `now < valid_from` (the edge is inside);
 *  2. **`coupon_expired`** — `now > valid_until` (the edge is inside);
 *  3. **`already_redeemed`** — this coupon was handed over already. It is about THIS coupon,
 *     so it precedes anything about the day or the campaign;
 *  4. **`coupon_daily_limit`** — one coupon per consumer + business + local day (ADR 0119 §14);
 *  5. **`coupon_cap_reached`** — the campaign's `coupon_max_redemptions` is used up: a
 *     property of the campaign and not of the person at the counter, so it goes late;
 *  6. **`program_changed`** — only `extra_*`: the coupon's unit is no longer the program's
 *     (`decideExtraGrant`, ADR 0098 §6).
 *
 * A null cap is «no cap» rather than 0: inventing a cap of zero would refuse a coupon the
 * owner declared unlimited.
 */
export function decideCouponVerdict(facts: VerdictFacts): CouponVerdict {
  const { now, timezone } = facts;
  if (now < facts.validFrom)
    return no(
      "coupon_not_yet_valid",
      `Este cupón vale desde el ${verdictDate(facts.validFrom, timezone)}.`,
    );
  if (now > facts.validUntil)
    return no(
      "coupon_expired",
      `Este cupón venció el ${verdictDate(facts.validUntil, timezone)}.`,
    );
  if (facts.redeemed)
    return no("already_redeemed", "Este cupón ya fue canjeado.");
  if (facts.usedToday)
    return no(
      "coupon_daily_limit",
      "El cliente ya usó un cupón hoy en este comercio.",
    );
  if (
    facts.couponMaxRedemptions !== null &&
    facts.redeemedCount >= facts.couponMaxRedemptions
  )
    return no("coupon_cap_reached", "Se agotaron los cupones de esta campaña.");
  const { extra } = facts;
  if (
    extra !== null &&
    (extra.membership === null ||
      !decideExtraGrant({ ...extra, membership: extra.membership }).ok)
  )
    return no("program_changed", PROGRAM_CHANGED);
  return { valid: true };
}
