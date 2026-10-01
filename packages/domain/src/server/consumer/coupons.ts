import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { requireDate, toDate } from "../marketing/driver-values";
import type { CouponKind, DiscountUnit } from "../marketing/reward-input";
import {
  type CouponReason,
  type CouponStatus,
  couponStatus,
} from "./coupon-status";

/**
 * THE CONSUMER'S OWN CAMPAIGN COUPONS (spec 0106 E3/E3b / ADR 0098 §5), across every
 * business, with the RULE the owner wrote («solo medianos») — the one place the consumer
 * reads it (it never goes in the pass or the push). The consumer comes ONLY from the session
 * (`resolveSession`), never from the request: `consumerId` is the isolation.
 *
 * What enters, in this order (contract §E3, spec 0107):
 *  1. `valid`, 2. `scheduled`, 3. `unavailable` — the coupons not expired and unredeemed,
 *     each group by `validUntil` asc (the LIVE read). Since spec 0107 it includes the ones
 *     whose `valid_from` is still AHEAD (`scheduled`, with `validFrom`): the welcome gift
 *     «desde mañana» is shown the day of the enrolment — the counter still hides it
 *     (`counter/coupon-scan.ts`);
 *  4. `redeemed` and `expired` of the last 90 days (by `redeemedAt` / `validUntil`), most
 *     recent first, at most 50 (the HISTORY read).
 * The state is CALCULATED (`coupon-status.ts`) from the redemption, the dates and
 * `core.business.status`.
 *
 * Allow-list, by contract: no campaign name, no cost, no membership/consumer id.
 * `currencyCode` as in the scan: the snapshot for an `amount` discount, else the business's.
 * Raw SQL with explicit aliases (the redemption is joined by the coupon's id).
 *
 * Spec 0112 (contract C3): every coupon says its `origin` — `cross` when the consumer
 * CLAIMED it from an «Oferta cruzada» (`cross_claimed_at`), `campaign` otherwise. The cross
 * coupon is here because it has the consumer's id; like every own coupon, UNFILTERED.
 */

export type ConsumerCoupon = {
  id: string;
  businessId: string;
  businessName: string;
  label: string;
  kind: CouponKind;
  rule: string | null;
  discountUnit: DiscountUnit | null;
  discountValue: string | null;
  currencyCode: string;
  extraUnits: number | null;
  /** Spec 0107: from when it is worth something (`scheduled` until then). */
  validFrom: Date;
  validUntil: Date;
  status: CouponStatus;
  reason: CouponReason | null;
  redeemedAt: Date | null;
  origin: "cross" | "campaign";
};

const HISTORY_DAYS = 90;
const HISTORY_MAX = 50;
const DAY_MS = 86_400_000;

type Row = {
  id: string;
  business_id: string;
  business_name: string;
  business_status: string;
  label_snapshot: string;
  kind_snapshot: CouponKind;
  rule_snapshot: string | null;
  discount_unit_snapshot: DiscountUnit | null;
  discount_value_snapshot: string | null;
  currency_code: string;
  extra_units_snapshot: number | null;
  valid_from: unknown;
  valid_until: unknown;
  redeemed_at: unknown;
  cross_claimed_at: unknown;
};

const COLUMNS = sql`
  c.id, c.business_id, b.name as business_name, b.status as business_status,
  c.label_snapshot, c.kind_snapshot, c.rule_snapshot, c.discount_unit_snapshot,
  c.discount_value_snapshot, c.extra_units_snapshot, c.valid_from, c.valid_until,
  coalesce(c.currency_code_snapshot, b.currency_code) as currency_code,
  cr.created_at as redeemed_at, c.cross_claimed_at
  from core.campaign_coupon c
  join core.business b on b.id = c.business_id
  left join core.coupon_redemption cr on cr.coupon_id = c.id`;

function toCoupon(row: Row, now: Date): ConsumerCoupon {
  const validFrom = requireDate(row.valid_from);
  const validUntil = requireDate(row.valid_until);
  const redeemedAt = toDate(row.redeemed_at);
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    label: row.label_snapshot,
    kind: row.kind_snapshot,
    rule: row.rule_snapshot,
    discountUnit: row.discount_unit_snapshot,
    discountValue: row.discount_value_snapshot,
    currencyCode: row.currency_code,
    extraUnits:
      row.extra_units_snapshot === null
        ? null
        : Number(row.extra_units_snapshot),
    validFrom,
    validUntil,
    ...couponStatus({
      redeemedAt,
      validFrom,
      validUntil,
      businessStatus: row.business_status,
      now,
    }),
    redeemedAt,
    origin: toDate(row.cross_claimed_at) ? "cross" : "campaign",
  };
}

export async function listConsumerCoupons(
  consumerId: string,
  now: Date = new Date(),
): Promise<ConsumerCoupon[]> {
  const at = now.toISOString();
  const since = new Date(now.getTime() - HISTORY_DAYS * DAY_MS).toISOString();
  const live = await getDb().execute<Row>(sql`
    select ${COLUMNS}
    where c.consumer_id = ${consumerId}
      and c.valid_until >= ${at}::timestamptz
      and cr.id is null
    order by c.valid_until asc, c.id asc
  `);
  const history = await getDb().execute<Row>(sql`
    select ${COLUMNS}
    where c.consumer_id = ${consumerId}
      and c.valid_from <= ${at}::timestamptz
      and (
        (cr.id is not null and cr.created_at >= ${since}::timestamptz)
        or (cr.id is null and c.valid_until < ${at}::timestamptz
            and c.valid_until >= ${since}::timestamptz)
      )
    order by coalesce(cr.created_at, c.valid_until) desc, c.id asc
    limit ${HISTORY_MAX}
  `);
  const current = live.rows.map((row) => toCoupon(row, now));
  return [
    ...current.filter((coupon) => coupon.status === "valid"),
    ...current.filter((coupon) => coupon.status === "scheduled"),
    ...current.filter((coupon) => coupon.status === "unavailable"),
    ...history.rows.map((row) => toCoupon(row, now)),
  ];
}

/** ONE coupon of the session consumer by id (the claim's answer), or `null`. */
export async function readConsumerCoupon(
  consumerId: string,
  couponId: string,
  now: Date = new Date(),
): Promise<ConsumerCoupon | null> {
  const result = await getDb().execute<Row>(sql`
    select ${COLUMNS}
    where c.consumer_id = ${consumerId} and c.id = ${couponId}
  `);
  const [row] = result.rows;
  return row ? toCoupon(row, now) : null;
}
