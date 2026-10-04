import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { programMemberships } from "@mi-pasaporte/db/schema";
import {
  CounterError,
  type OperatorBusiness,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import { requireDate } from "@mi-pasaporte/domain/server/marketing/driver-values";
import type {
  CouponKind,
  DiscountUnit,
} from "@mi-pasaporte/domain/server/marketing/reward-input";
import { createdToday } from "./coupon-locks";
import {
  type CouponVerdict,
  type VerdictFacts,
  decideCouponVerdict,
} from "./coupon-decision";
import {
  type VerdictFactsRow,
  toVerdictFacts,
  verdictFactsQuery,
} from "./coupon-verdict";

/**
 * WHAT THE COUNTER SEES OF THE CONSUMER'S COUPON (spec 0148 / ADR 0119 §2-§3; spec 0153 /
 * ADR 0120: the chosen coupon travels WITH ITS VERDICT, valid or not — contract M0/M1):
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
  | { status: "selected"; coupon: CounterCoupon; verdict: CouponVerdict }
  | { status: "used_today"; label: string }
  | { status: "hint"; count: number }
  | { status: "none" };

export type CounterCouponFacts = {
  /** The operator's business. */
  businessId: string;
  /** The labels of this consumer's redemption rows at this business created TODAY (local
   * day), newest first. */
  today: { label: string }[];
  /** The consumer's choice, of ANY business. `verdictFacts`: read only for a coupon of THIS
   * business (`null` for another's — the counter never judges a foreign coupon). */
  selection: {
    businessId: string;
    coupon: CounterCoupon;
    verdictFacts: VerdictFacts | null;
  } | null;
  /** This consumer's `valid` (E3) coupons of this business. */
  validCount: number;
};

/**
 * PURE. The first that applies (contract 0153 M0/M1):
 *  1. `selected` — the consumer's choice is a coupon of THIS business, valid OR NOT: it
 *     carries `decideCouponVerdict` — the same rule the sale applies under its locks;
 *  2. `used_today` — a redemption row of today here: the daily limit is spent;
 *  3. `hint` — the consumer has ≥ 1 `valid` coupon of this business (the counter only sees
 *     the advice to choose one in the app);
 *  4. `none`.
 * A choice of ANOTHER business is not this counter's: it falls through to 2-4.
 */
export function decideCounterCouponState(
  facts: CounterCouponFacts,
): CounterCouponState {
  const { selection } = facts;
  if (
    selection !== null &&
    selection.businessId === facts.businessId &&
    selection.verdictFacts !== null
  )
    return {
      status: "selected",
      coupon: selection.coupon,
      verdict: decideCouponVerdict(selection.verdictFacts),
    };
  const [used] = facts.today;
  if (used) return { status: "used_today", label: used.label };
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
  const today = await db.execute<{ label_snapshot: string }>(sql`
    select cr.label_snapshot
    from core.coupon_redemption cr
    join core.business b on b.id = cr.business_id
    where cr.business_id = ${businessId} and cr.consumer_id = ${consumerId}
      and ${createdToday(now)}
    order by cr.created_at desc, cr.id
  `);
  const selected = await db.execute<
    CouponRow & { campaign_id: string; membership_id: string | null }
  >(sql`
    select ${COUPON_COLUMNS}, c.campaign_id, c.membership_id
    from consumer.consumer_account a
    join core.campaign_coupon c on c.id = a.selected_coupon_id
    join core.business b on b.id = c.business_id
    left join core.product p on p.id = c.product_id
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
  let verdictFacts: VerdictFacts | null = null;
  if (choice && choice.business_id === businessId) {
    const coupon = {
      id: choice.id,
      campaignId: choice.campaign_id,
      kindSnapshot: choice.kind_snapshot,
      extraUnitsSnapshot:
        choice.extra_units_snapshot === null
          ? null
          : Number(choice.extra_units_snapshot),
      validFrom: requireDate(choice.valid_from),
      validUntil: requireDate(choice.valid_until),
    };
    const facts = await db.execute<VerdictFactsRow>(
      verdictFactsQuery({
        businessId,
        consumerId,
        membershipId: choice.membership_id,
        coupon,
        now,
      }),
    );
    verdictFacts = toVerdictFacts(facts.rows[0], coupon, now);
  }
  return {
    businessId,
    today: today.rows.map((row) => ({ label: row.label_snapshot })),
    selection: choice
      ? {
          businessId: choice.business_id,
          coupon: toCounterCoupon(choice),
          verdictFacts,
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
