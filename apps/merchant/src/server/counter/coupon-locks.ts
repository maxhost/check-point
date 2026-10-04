import { and, eq, sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import {
  businessCustomers,
  campaignCoupons,
  campaigns,
} from "@mi-pasaporte/db/schema";
import { CounterError } from "@mi-pasaporte/domain/server/counter/core";

/**
 * THE LOCKS AND THE DAY of every counter write over a coupon (spec 0148): validate, remove and
 * the sale with a coupon. ALWAYS in this order — a different order between two writers is a
 * deadlock:
 *
 *  1. `core.campaign` `FOR UPDATE` — serializes every redemption of the campaign (its cap);
 *  2. `core.campaign_coupon` `FOR UPDATE` — this coupon;
 *  3. `core.business_customer (business_id, consumer_id)` `FOR UPDATE` — the one that
 *     serializes two DIFFERENT coupons of the same consumer at the same business (the daily
 *     limit): the pair above does not see them.
 */

export const UNKNOWN_COUPON = "Ese cupón no existe.";

export type LockedCoupon = {
  campaign: { id: string; name: string; couponMaxRedemptions: number | null };
  coupon: {
    id: string;
    consumerId: string;
    membershipId: string | null;
    turnId: string | null;
    labelSnapshot: string;
    costSnapshot: string;
    kindSnapshot: (typeof campaignCoupons.$inferSelect)["kindSnapshot"];
    productId: string | null;
    discountUnitSnapshot: string | null;
    discountValueSnapshot: string | null;
    currencyCodeSnapshot: string | null;
    extraUnitsSnapshot: number | null;
    ruleSnapshot: string | null;
    validFrom: Date;
    validUntil: Date;
  };
};

/**
 * Locks (1) and (2). The coupon has to be of THIS business and of THIS consumer — anything
 * else is the same 404 `unknown_coupon` (never a 403: it would confirm the id exists). The
 * head read is not under a lock and does not need to be: a coupon's campaign never changes.
 */
export async function lockCounterCoupon(
  tx: DbTransaction,
  businessId: string,
  consumerId: string,
  couponId: string,
): Promise<LockedCoupon> {
  const [head] = await tx
    .select({ campaignId: campaignCoupons.campaignId })
    .from(campaignCoupons)
    .where(
      and(
        eq(campaignCoupons.id, couponId),
        eq(campaignCoupons.businessId, businessId),
        eq(campaignCoupons.consumerId, consumerId),
      ),
    )
    .limit(1);
  if (!head) throw new CounterError(404, "unknown_coupon", UNKNOWN_COUPON);
  const [campaign] = await tx
    .select({
      id: campaigns.id,
      name: campaigns.name,
      couponMaxRedemptions: campaigns.couponMaxRedemptions,
    })
    .from(campaigns)
    .where(eq(campaigns.id, head.campaignId))
    .limit(1)
    .for("update");
  const [coupon] = await tx
    .select({
      id: campaignCoupons.id,
      consumerId: campaignCoupons.consumerId,
      membershipId: campaignCoupons.membershipId,
      turnId: campaignCoupons.turnId,
      labelSnapshot: campaignCoupons.labelSnapshot,
      costSnapshot: campaignCoupons.costSnapshot,
      kindSnapshot: campaignCoupons.kindSnapshot,
      productId: campaignCoupons.productId,
      discountUnitSnapshot: campaignCoupons.discountUnitSnapshot,
      discountValueSnapshot: campaignCoupons.discountValueSnapshot,
      currencyCodeSnapshot: campaignCoupons.currencyCodeSnapshot,
      extraUnitsSnapshot: campaignCoupons.extraUnitsSnapshot,
      ruleSnapshot: campaignCoupons.ruleSnapshot,
      validFrom: campaignCoupons.validFrom,
      validUntil: campaignCoupons.validUntil,
    })
    .from(campaignCoupons)
    .where(eq(campaignCoupons.id, couponId))
    .limit(1)
    .for("update");
  return { campaign, coupon };
}

/** Lock (3). No row → 409 `not_enrolled`: the scan creates it when it auto-enrols. */
export async function lockBusinessCustomer(
  tx: DbTransaction,
  businessId: string,
  consumerId: string,
): Promise<void> {
  const [row] = await tx
    .select({ consumerId: businessCustomers.consumerId })
    .from(businessCustomers)
    .where(
      and(
        eq(businessCustomers.businessId, businessId),
        eq(businessCustomers.consumerId, consumerId),
      ),
    )
    .limit(1)
    .for("update");
  if (!row)
    throw new CounterError(
      409,
      "not_enrolled",
      "Escanea el QR del cliente primero.",
    );
}

/**
 * «Hoy» is the BUSINESS-LOCAL day (`business.timezone`), the same notion as the counter's
 * history (`history.ts`). `cr` is the redemption, `b` its business. A validated coupon of a
 * previous day is CONSUMED by this condition alone — no cron (spec 0148, «Cierre del dia»).
 */
export function createdToday(now: Date) {
  return sql`(cr.created_at at time zone b.timezone)::date = (${now.toISOString()}::timestamptz at time zone b.timezone)::date`;
}

/**
 * THE DAILY LIMIT (ADR 0119 §14): one coupon per consumer + business + local day — ANY
 * redemption row of today counts (validated, sold or `extra_*`); a reward of the loyalty
 * program (`reward_redemption`) does not (§15). `exceptId`: the coupon's own validated row,
 * when the sale ties it. Runs under the three locks.
 */
export async function assertDailyLimit(
  tx: DbTransaction,
  businessId: string,
  consumerId: string,
  now: Date,
  exceptId: string | null = null,
): Promise<void> {
  const result = await tx.execute<{ id: string }>(sql`
    select cr.id from core.coupon_redemption cr
    join core.business b on b.id = cr.business_id
    where cr.business_id = ${businessId} and cr.consumer_id = ${consumerId}
      and ${createdToday(now)}
      ${exceptId ? sql`and cr.id <> ${exceptId}` : sql``}
    limit 1
  `);
  if (result.rows.length > 0)
    throw new CounterError(
      409,
      "coupon_daily_limit",
      "Este cliente ya usó un cupón hoy en tu comercio.",
    );
}

/** The consumer's current choice (`consumer_account.selected_coupon_id`). */
export async function selectedCouponOf(
  tx: DbTransaction,
  consumerId: string,
): Promise<string | null> {
  const result = await tx.execute<{ selected_coupon_id: string | null }>(
    sql`select selected_coupon_id from consumer.consumer_account where id = ${consumerId}`,
  );
  return result.rows[0]?.selected_coupon_id ?? null;
}

/** Clears the consumer's choice IF it points at this coupon (another choice is theirs). */
export async function clearSelectionIf(
  tx: DbTransaction,
  consumerId: string,
  couponId: string,
): Promise<void> {
  await tx.execute(sql`
    update consumer.consumer_account
    set selected_coupon_id = null, coupon_selected_at = null
    where id = ${consumerId} and selected_coupon_id = ${couponId}
  `);
}
