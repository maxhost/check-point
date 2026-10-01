import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { requireDate } from "@mi-pasaporte/domain/server/marketing/driver-values";
import type {
  CouponKind,
  DiscountUnit,
} from "@mi-pasaporte/domain/server/marketing/reward-input";

/**
 * What the SCAN shows of the campaign coupon (spec 0065 phase C, over `campaign_coupon` since
 * spec 0102; split from `coupon-store.ts` by the size budget). Spec 0106: the cashier also
 * sees the reward — type, rule and values — so the counter knows WHAT to hand over. Still
 * no consumer/membership id and no cost.
 *
 * `currencyCode`: the coupon's snapshot when the discount is by `amount` (the value means
 * nothing in another currency); otherwise the business's current one — only a snapshot
 * of an amount is load-bearing (`core_campaign_coupon_reward_currency_check`).
 */
export type ActiveCoupon = {
  couponId: string;
  label: string;
  campaignName: string;
  validUntil: Date;
  kind: CouponKind;
  rule: string | null;
  discountUnit: DiscountUnit | null;
  discountValue: string | null;
  currencyCode: string;
  extraUnits: number | null;
};

/**
 * The coupon this consumer can be handed AT THIS COUNTER, or `null` (spec 0102). Same
 * conditions the redemption re-checks under the lock — this one only decides what to
 * PAINT, and the cap may move between the scan and the confirmation, which is why the
 * real guard is the transaction and never this read.
 *
 * It looks at the COUPON only: `valid_from <= now <= valid_until` and no redemption
 * pointing at it. **Not at the turn, not at the campaign's status** (ADR 0094 §2): a
 * paused or ended campaign keeps showing its coupons until their `valid_until`, and a
 * cancelled turn does not take back a coupon the consumer already got. The cap is not
 * read here either: it is decided at the counter, under the lock, with its own message.
 *
 * Raw SQL on purpose: the `not exists` is a CORRELATED subquery, and drizzle renders a
 * bare column unqualified — every alias is explicit (`c.id`). Total order
 * `valid_until asc, id asc`: the one about to expire first is the one to hand over.
 */
export async function loadActiveCoupon(
  businessId: string,
  consumerId: string,
  now: Date = new Date(),
): Promise<ActiveCoupon | null> {
  const at = now.toISOString();
  const result = await getDb().execute<{
    id: string;
    label_snapshot: string;
    campaign_name: string;
    valid_until: unknown;
    kind_snapshot: CouponKind;
    rule_snapshot: string | null;
    discount_unit_snapshot: DiscountUnit | null;
    discount_value_snapshot: string | null;
    currency_code: string;
    extra_units_snapshot: number | null;
  }>(sql`
    select c.id, c.label_snapshot, k.name as campaign_name, c.valid_until,
      c.kind_snapshot, c.rule_snapshot, c.discount_unit_snapshot,
      c.discount_value_snapshot, c.extra_units_snapshot,
      coalesce(c.currency_code_snapshot, b.currency_code) as currency_code
    from core.campaign_coupon c
    join core.campaign k on k.id = c.campaign_id
    join core.business b on b.id = c.business_id
    where c.business_id = ${businessId}
      and c.consumer_id = ${consumerId}
      and c.valid_from <= ${at}::timestamptz
      and c.valid_until >= ${at}::timestamptz
      and not exists (
        select 1 from core.coupon_redemption cr where cr.coupon_id = c.id
      )
    order by c.valid_until asc, c.id asc
    limit 1
  `);
  const [row] = result.rows;
  if (!row) return null;
  return {
    couponId: row.id,
    label: row.label_snapshot,
    campaignName: row.campaign_name,
    validUntil: requireDate(row.valid_until),
    kind: row.kind_snapshot,
    rule: row.rule_snapshot,
    discountUnit: row.discount_unit_snapshot,
    discountValue: row.discount_value_snapshot,
    currencyCode: row.currency_code,
    extraUnits:
      row.extra_units_snapshot === null
        ? null
        : Number(row.extra_units_snapshot),
  };
}
