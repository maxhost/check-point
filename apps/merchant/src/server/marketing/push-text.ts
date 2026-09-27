/**
 * The body of a campaign push (spec 0103 §5 / ADR 0095 §7). PURE. The title is the
 * business name (set by the enqueuer); the body is the campaign's own message —the SAME
 * text the proximity pass shows, owner's decision— plus the coupon when there is one.
 * Frozen when the row is enqueued: editing the campaign later never rewrites it.
 * At most 60 + 3 + 40 characters (the two `check`s of `core.campaign`).
 */
export function pushBody(message: string, couponLabel: string | null): string {
  return couponLabel === null ? message : `${message} · ${couponLabel}`;
}
