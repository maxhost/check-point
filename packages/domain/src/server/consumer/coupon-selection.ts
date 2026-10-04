import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { requireDate, toDate } from "../marketing/driver-values";
import { couponStatus } from "./coupon-status";

/**
 * THE CONSUMER CHOOSES THE COUPON (spec 0148 / ADR 0119 §1, §4) — `PUT`/`DELETE
 * /api/public/consumer/coupon-selection`. ONE choice per consumer, global
 * (`consumer_account.selected_coupon_id`): choosing another one replaces it (the previous
 * coupon goes back to «disponible», by its own validity) and it never expires.
 *
 * The consumer comes ONLY from the session: `consumerId` is the isolation, and a coupon of
 * another consumer is the same `coupon_not_found` as one that does not exist (never a 403,
 * which would confirm the id).
 *
 * A coupon the counter already VALIDATED is not touched by anything here (ADR 0119 §9): its
 * state lives in its `coupon_redemption` row, so it reads `redeemed` and cannot be chosen
 * again — and choosing another coupon does not unlock it.
 */

export type SelectCouponResult =
  | { status: 200; selectedCouponId: string }
  | { status: 404; code: "coupon_not_found" }
  | { status: 409; code: "coupon_not_selectable" };

type OwnCouponRow = {
  id: string;
  valid_from: unknown;
  valid_until: unknown;
  business_status: string;
  redeemed_at: unknown;
};

/** The coupon, scoped to its owner, with what its E3 state needs. Raw SQL with explicit
 * aliases: the redemption is joined by the coupon's id. */
async function readOwnCoupon(
  consumerId: string,
  couponId: string,
): Promise<OwnCouponRow | null> {
  const result = await getDb().execute<OwnCouponRow>(sql`
    select c.id, c.valid_from, c.valid_until, b.status as business_status,
      cr.created_at as redeemed_at
    from core.campaign_coupon c
    join core.business b on b.id = c.business_id
    left join core.coupon_redemption cr on cr.coupon_id = c.id
    where c.id = ${couponId} and c.consumer_id = ${consumerId}
  `);
  return result.rows[0] ?? null;
}

/**
 * Chooses `couponId` for the consumer: it has to be THEIRS (else 404) and `valid` in E3 —
 * not redeemed, not expired, its business active and already running: the welcome gift
 * «desde mañana» (`scheduled`) is a 409 until its `valid_from`. Idempotent.
 */
export async function selectCoupon(
  consumerId: string,
  couponId: string,
  now: Date = new Date(),
): Promise<SelectCouponResult> {
  const row = await readOwnCoupon(consumerId, couponId);
  if (!row) return { status: 404, code: "coupon_not_found" };
  const { status } = couponStatus({
    redeemedAt: toDate(row.redeemed_at),
    validFrom: requireDate(row.valid_from),
    validUntil: requireDate(row.valid_until),
    businessStatus: row.business_status,
    now,
  });
  if (status !== "valid") return { status: 409, code: "coupon_not_selectable" };
  await getDb().execute(sql`
    update consumer.consumer_account
    set selected_coupon_id = ${couponId},
        coupon_selected_at = ${now.toISOString()}::timestamptz
    where id = ${consumerId}
  `);
  return { status: 200, selectedCouponId: couponId };
}

/** Drops the consumer's choice. Idempotent. */
export async function clearCouponSelection(consumerId: string): Promise<void> {
  await getDb().execute(sql`
    update consumer.consumer_account
    set selected_coupon_id = null, coupon_selected_at = null
    where id = ${consumerId}
  `);
}
