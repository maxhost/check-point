import { type AnyPgColumn, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * THE SHAPE OF A CAMPAIGN REWARD (spec 0106 / ADR 0098), shared by the two tables that hold
 * one: `core.campaign` (what the owner configured) and `core.campaign_coupon` (the copy the
 * consumer holds). One helper so the two can never disagree about what a valid reward is —
 * the coupon is a PHOTO of the campaign, and a photo the campaign could not have taken
 * would reach the counter.
 *
 *  - `discount` ⇔ unit and value; `percent` is a whole 1..100, `amount` is > 0 (in the
 *    business currency — the coupon snapshots it, see `campaign-coupon.ts`).
 *  - `extra_stamps`/`extra_points` ⇔ `extra_units` 1..1000.
 *  - a product only with `free_product`/`two_for_one`.
 *  - a rule only when there IS a reward, 1..2000 (technical ceiling, not a UX limit).
 *
 * ⚠️ The `coalesce(kind, '')` is load-bearing: a `check` whose expression is NULL PASSES,
 * and on `core.campaign` the kind is null when there is no coupon.
 */
export const COUPON_KIND_VALUES = [
  "free_product",
  "two_for_one",
  "discount",
  "extra_stamps",
  "extra_points",
  // Spec 0113 / ADR 0105: free text («2x1 en cerveza»), ONLY in «Horas valle» (the input
  // layers refuse it elsewhere). Its shape is the label alone: no product, no discount,
  // no units — none of the checks below admits them for it.
  "custom",
] as const;

export type CouponKindValue = (typeof COUPON_KIND_VALUES)[number];

export const couponKindList = sql.raw(
  COUPON_KIND_VALUES.map((kind) => `'${kind}'`).join(", "),
);

type RewardColumns = {
  kind: AnyPgColumn;
  productId: AnyPgColumn;
  unit: AnyPgColumn;
  value: AnyPgColumn;
  extraUnits: AnyPgColumn;
  rule: AnyPgColumn;
};

export function rewardChecks(prefix: string, c: RewardColumns) {
  return [
    check(
      `${prefix}_kind_check`,
      sql`${c.kind} is null or ${c.kind} in (${couponKindList})`,
    ),
    check(
      `${prefix}_discount_unit_check`,
      sql`${c.unit} is null or ${c.unit} in ('percent', 'amount')`,
    ),
    check(
      `${prefix}_discount_shape_check`,
      sql`(coalesce(${c.kind}, '') = 'discount') = (${c.unit} is not null) and (${c.unit} is null) = (${c.value} is null)`,
    ),
    check(
      `${prefix}_discount_value_check`,
      sql`${c.value} is null or (${c.unit} = 'percent' and ${c.value} between 1 and 100 and ${c.value} = trunc(${c.value})) or (${c.unit} = 'amount' and ${c.value} > 0)`,
    ),
    check(
      `${prefix}_extra_shape_check`,
      sql`(coalesce(${c.kind}, '') in ('extra_stamps', 'extra_points')) = (${c.extraUnits} is not null)`,
    ),
    check(
      `${prefix}_extra_units_check`,
      sql`${c.extraUnits} is null or ${c.extraUnits} between 1 and 1000`,
    ),
    check(
      `${prefix}_product_kind_check`,
      sql`${c.productId} is null or coalesce(${c.kind}, '') in ('free_product', 'two_for_one')`,
    ),
    check(
      `${prefix}_rule_check`,
      sql`${c.rule} is null or (${c.kind} is not null and char_length(${c.rule}) between 1 and 2000)`,
    ),
  ];
}
