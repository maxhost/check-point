import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { requireDate } from "../marketing/driver-values";
import type { CouponKind, DiscountUnit } from "../marketing/reward-input";

/**
 * THE CONSUMER'S OWN CAMPAIGN COUPONS (spec 0106 E3 / ADR 0098 §5): what they can still use,
 * across every business, with the RULE the owner wrote («solo medianos») — the one place the
 * consumer reads it (it never goes in the pass or the push).
 *
 * The predicate is the COUNTER SCAN's (`counter/coupon-scan.ts`): `valid_from <= now <=
 * valid_until` and no redemption pointing at it — so the list never shows a coupon the
 * counter would refuse as used or expired. The consumer comes ONLY from the session
 * (`resolveSession`), never from the request: `consumerId` is the isolation.
 *
 * Allow-list, by contract: no campaign name (internal to the business), no cost, no
 * membership/consumer id. `currencyCode` as in the scan: the coupon's snapshot for a
 * discount by `amount`, otherwise the business's current one.
 *
 * Raw SQL on purpose: the `not exists` is a CORRELATED subquery (aliases explicit).
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
  validUntil: Date;
};

export async function listConsumerCoupons(
  consumerId: string,
  now: Date = new Date(),
): Promise<ConsumerCoupon[]> {
  const at = now.toISOString();
  const result = await getDb().execute<{
    id: string;
    business_id: string;
    business_name: string;
    label_snapshot: string;
    kind_snapshot: CouponKind;
    rule_snapshot: string | null;
    discount_unit_snapshot: DiscountUnit | null;
    discount_value_snapshot: string | null;
    currency_code: string;
    extra_units_snapshot: number | null;
    valid_until: unknown;
  }>(sql`
    select c.id, c.business_id, b.name as business_name, c.label_snapshot,
      c.kind_snapshot, c.rule_snapshot, c.discount_unit_snapshot,
      c.discount_value_snapshot, c.extra_units_snapshot, c.valid_until,
      coalesce(c.currency_code_snapshot, b.currency_code) as currency_code
    from core.campaign_coupon c
    join core.business b on b.id = c.business_id
    where c.consumer_id = ${consumerId}
      and c.valid_from <= ${at}::timestamptz
      and c.valid_until >= ${at}::timestamptz
      and not exists (
        select 1 from core.coupon_redemption cr where cr.coupon_id = c.id
      )
    order by c.valid_until asc, c.id asc
  `);
  return result.rows.map((row) => ({
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
    validUntil: requireDate(row.valid_until),
  }));
}
