/**
 * THE STATE OF A CONSUMER'S COUPON (spec 0106 E3b, owner's decision 2026-09-27), PURE and
 * CALCULATED on every read — nothing is stored: if the business comes back to `active`, the
 * coupon is `valid` again on its own.
 *
 * Precedence, the first that applies (contract §E3):
 *  1. `redeemed` — it has a redemption (the counter already handed it over);
 *  2. `expired` — `now > validUntil`;
 *  3. `unavailable` — the business is not `active` (suspended/closed): not the consumer's
 *     fault, and the counter would refuse it anyway (`counter/core.ts`);
 *  4. `scheduled` — it does not run YET (`now < validFrom`): the welcome gift «desde mañana»
 *     (spec 0107 / ADR 0099) shown the day of the enrolment so the consumer sees it; the
 *     counter still hides it until `validFrom` (`counter/coupon-scan.ts`);
 *  5. `valid` — the rest.
 */

export type CouponStatus =
  "valid" | "scheduled" | "unavailable" | "redeemed" | "expired";
export type CouponReason = "business_suspended" | "business_closed";

export function couponStatus(facts: {
  redeemedAt: Date | null;
  validFrom: Date;
  validUntil: Date;
  businessStatus: string;
  now: Date;
}): { status: CouponStatus; reason: CouponReason | null } {
  if (facts.redeemedAt !== null) return { status: "redeemed", reason: null };
  if (facts.now > facts.validUntil) return { status: "expired", reason: null };
  if (facts.businessStatus !== "active")
    return {
      status: "unavailable",
      reason:
        facts.businessStatus === "closed"
          ? "business_closed"
          : "business_suspended",
    };
  if (facts.now < facts.validFrom) return { status: "scheduled", reason: null };
  return { status: "valid", reason: null };
}
