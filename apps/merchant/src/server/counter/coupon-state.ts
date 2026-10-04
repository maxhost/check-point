import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { programMemberships } from "@mi-pasaporte/db/schema";
import {
  CounterError,
  type OperatorBusiness,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import {
  requireDate,
  toDate,
} from "@mi-pasaporte/domain/server/marketing/driver-values";
import type {
  CouponKind,
  DiscountUnit,
} from "@mi-pasaporte/domain/server/marketing/reward-input";
import {
  type CouponStatus,
  couponStatus,
} from "@mi-pasaporte/domain/server/consumer/coupon-status";
import { createdToday } from "./coupon-locks";

/**
 * WHAT THE COUNTER SEES OF THE CONSUMER'S COUPON (spec 0148 / ADR 0119 §2-§3, contract M0/M1):
 * in `resolve` and in `GET /api/counter/coupon-state` (the poll — the consumer may choose
 * AFTER the scan). The decision is PURE (`decideCounterCouponState`); the facts are read
 * apart. The counter never gets a LIST of coupons: it cannot activate one (§3).
 *
 * `coupon` is an allow-list: no consumer/membership id, no cost, no campaign name.
 * `currencyCode`: the snapshot of an `amount` discount, else the business's.
 */

export type CounterCoupon = {
  couponId: string;
  label: string;
  kind: CouponKind;
  rule: string | null;
  productId: string | null;
  productName: string | null;
  discountUnit: DiscountUnit | null;
  discountValue: string | null;
  currencyCode: string;
  extraUnits: number | null;
  validUntil: Date;
};

export type CounterCouponState =
  | { status: "validated"; coupon: CounterCoupon }
  | { status: "used_today"; label: string }
  | { status: "selected"; coupon: CounterCoupon }
  | { status: "hint"; count: number }
  | { status: "none" };

export type CounterCouponFacts = {
  /** The operator's business. */
  businessId: string;
  /** This consumer's redemption rows at this business created TODAY (local day). */
  today: { kind: CouponKind; orderId: string | null; coupon: CounterCoupon }[];
  /** The consumer's choice, of ANY business, with its E3 state. */
  selection: {
    businessId: string;
    status: CouponStatus;
    coupon: CounterCoupon;
  } | null;
  /** This consumer's `valid` (E3) coupons of this business. */
  validCount: number;
};

const isExtra = (kind: CouponKind) =>
  kind === "extra_stamps" || kind === "extra_points";

/**
 * PURE. The first that applies:
 *  1. `validated` — a row of today WITHOUT a sale and not `extra_*` (an `extra_*` is consumed
 *     when validated);
 *  2. `used_today` — any other row of today (sold, or `extra_*`): the daily limit is spent;
 *  3. `selected` — the consumer's choice is a coupon of THIS business, `valid` in E3;
 *  4. `hint` — the consumer has ≥ 1 `valid` coupon of this business (the counter only sees
 *     the advice to choose one in the app);
 *  5. `none`.
 */
export function decideCounterCouponState(
  facts: CounterCouponFacts,
): CounterCouponState {
  const validated = facts.today.find(
    (row) => row.orderId === null && !isExtra(row.kind),
  );
  if (validated) return { status: "validated", coupon: validated.coupon };
  const [used] = facts.today;
  if (used) return { status: "used_today", label: used.coupon.label };
  const { selection } = facts;
  if (
    selection !== null &&
    selection.businessId === facts.businessId &&
    selection.status === "valid"
  )
    return { status: "selected", coupon: selection.coupon };
  if (facts.validCount > 0) return { status: "hint", count: facts.validCount };
  return { status: "none" };
}

type CouponRow = {
  id: string;
  business_id: string;
  label_snapshot: string;
  kind_snapshot: CouponKind;
  rule_snapshot: string | null;
  product_id: string | null;
  product_name: string | null;
  discount_unit_snapshot: DiscountUnit | null;
  discount_value_snapshot: string | null;
  currency_code: string;
  extra_units_snapshot: number | null;
  valid_from: unknown;
  valid_until: unknown;
};

/** Raw SQL with explicit aliases: `c` the coupon, `b` its business, `p` its product. */
const COUPON_COLUMNS = sql`c.id, c.business_id, c.label_snapshot, c.kind_snapshot,
  c.rule_snapshot, c.product_id, p.name as product_name, c.discount_unit_snapshot,
  c.discount_value_snapshot, c.extra_units_snapshot, c.valid_from, c.valid_until,
  coalesce(c.currency_code_snapshot, b.currency_code) as currency_code`;

function toCounterCoupon(row: CouponRow): CounterCoupon {
  return {
    couponId: row.id,
    label: row.label_snapshot,
    kind: row.kind_snapshot,
    rule: row.rule_snapshot,
    productId: row.product_id,
    productName: row.product_name,
    discountUnit: row.discount_unit_snapshot,
    discountValue: row.discount_value_snapshot,
    currencyCode: row.currency_code,
    extraUnits:
      row.extra_units_snapshot === null
        ? null
        : Number(row.extra_units_snapshot),
    validUntil: requireDate(row.valid_until),
  };
}

export async function readCounterCouponFacts(
  businessId: string,
  consumerId: string,
  now: Date,
): Promise<CounterCouponFacts> {
  const db = getDb();
  const at = now.toISOString();
  const today = await db.execute<CouponRow & { order_id: string | null }>(sql`
    select ${COUPON_COLUMNS}, cr.order_id
    from core.coupon_redemption cr
    join core.business b on b.id = cr.business_id
    join core.campaign_coupon c on c.id = cr.coupon_id
    left join core.product p on p.id = c.product_id
    where cr.business_id = ${businessId} and cr.consumer_id = ${consumerId}
      and ${createdToday(now)}
    order by cr.created_at desc, cr.id
  `);
  const selected = await db.execute<
    CouponRow & { business_status: string; redeemed_at: unknown }
  >(sql`
    select ${COUPON_COLUMNS}, b.status as business_status, cr.created_at as redeemed_at
    from consumer.consumer_account a
    join core.campaign_coupon c on c.id = a.selected_coupon_id
    join core.business b on b.id = c.business_id
    left join core.product p on p.id = c.product_id
    left join core.coupon_redemption cr on cr.coupon_id = c.id
    where a.id = ${consumerId}
  `);
  const valid = await db.execute<{ n: number }>(sql`
    select count(*)::int as n
    from core.campaign_coupon c
    join core.business b on b.id = c.business_id
    where c.business_id = ${businessId} and c.consumer_id = ${consumerId}
      and b.status = 'active'
      and c.valid_from <= ${at}::timestamptz and c.valid_until >= ${at}::timestamptz
      and not exists (select 1 from core.coupon_redemption cr where cr.coupon_id = c.id)
  `);
  const [choice] = selected.rows;
  return {
    businessId,
    today: today.rows.map((row) => ({
      kind: row.kind_snapshot,
      orderId: row.order_id,
      coupon: toCounterCoupon(row),
    })),
    selection: choice
      ? {
          businessId: choice.business_id,
          status: couponStatus({
            redeemedAt: toDate(choice.redeemed_at),
            validFrom: requireDate(choice.valid_from),
            validUntil: requireDate(choice.valid_until),
            businessStatus: choice.business_status,
            now,
          }).status,
          coupon: toCounterCoupon(choice),
        }
      : null,
    validCount: Number(valid.rows[0]?.n ?? 0),
  };
}

export async function counterCouponState(
  businessId: string,
  consumerId: string,
  now: Date = new Date(),
): Promise<CounterCouponState> {
  return decideCounterCouponState(
    await readCounterCouponFacts(businessId, consumerId, now),
  );
}

/** The membership, scoped to the operator's business: a foreign or unknown one is a 404
 * `not_found` (contract M1) — never a 403 that would confirm the id. */
export async function loadCounterMembership(
  businessId: string,
  membershipId: string,
): Promise<{ id: string; consumerId: string }> {
  const [row] = await getDb()
    .select({
      id: programMemberships.id,
      consumerId: programMemberships.consumerId,
    })
    .from(programMemberships)
    .where(
      and(
        eq(programMemberships.id, membershipId),
        eq(programMemberships.businessId, businessId),
      ),
    )
    .limit(1);
  if (!row)
    throw new CounterError(404, "not_found", "Esa membresía no existe.");
  return row;
}

/** `GET /api/counter/coupon-state?membershipId=` (contract M1). */
export async function getCouponState(
  business: OperatorBusiness,
  rawMembershipId: unknown,
): Promise<{ couponState: CounterCouponState }> {
  const membership = await loadCounterMembership(
    business.id,
    parseUuid(rawMembershipId, "membershipId"),
  );
  return {
    couponState: await counterCouponState(business.id, membership.consumerId),
  };
}
