import { sql } from "drizzle-orm";
import type { DbTransaction, getDb } from "@mi-pasaporte/db";
import type { CouponReward } from "./coupon-issue";
import { requireDate } from "./driver-values";
import { campaignsAllowedFor } from "./plan-gate";
import type { CouponKind, DiscountUnit } from "./reward-input";
import type { WelcomeRedeemFrom } from "./templates";

/**
 * The READS of «Bienvenida» (spec 0107 §3, §6): the business's ELIGIBLE welcome campaign
 * and how many gifts it already gave this month. Shared by the issuer (`welcome-issue.ts`)
 * and the enroll page (`consumer/enroll-landing.ts`), so the page never offers a gift the
 * issuer would refuse.
 *
 * ELIGIBLE = `active`, started, not ended, its business `active`, and the plan allows
 * campaigns (`campaignsAllowedFor`, `plan-gate.ts` — the same entry every campaign obeys;
 * «free vs premium» is still open, ADR 0099 §7).
 */

type Db = DbTransaction | ReturnType<typeof getDb>;

export type WelcomeCampaign = {
  id: string;
  businessId: string;
  activatedAt: Date;
  message: string;
  couponLabel: string;
  couponCost: string;
  reward: CouponReward;
  validDays: number;
  reminderDays: number;
  monthlyCap: number;
  redeemFrom: WelcomeRedeemFrom;
  timeZone: string;
};

type Rows<T> = { rows?: T[] } | T[];
function rowsOf<T>(result: unknown): T[] {
  const value = result as Rows<T>;
  return Array.isArray(value) ? value : (value?.rows ?? []);
}

const text = (value: unknown) =>
  value === null || value === undefined ? null : String(value);

export async function loadWelcomeCampaign(
  db: Db,
  businessId: string,
  now: Date,
): Promise<WelcomeCampaign | null> {
  const at = now.toISOString();
  const result = await db.execute(sql`
    select c.id, c.business_id, c.activated_at, c.message, c.coupon_label, c.coupon_cost,
      c.coupon_kind, c.coupon_product_id, c.coupon_discount_unit, c.coupon_discount_value,
      c.coupon_extra_units, c.coupon_rule, c.welcome_valid_days, c.welcome_reminder_days,
      c.welcome_monthly_cap, c.welcome_redeem_from, b.timezone, b.currency_code,
      s.plan, s.pending_plan, s.status as subscription_status, s.stripe_subscription_id
    from core.campaign c
    join core.business b on b.id = c.business_id
    left join core.subscription s on s.business_id = c.business_id
    where c.business_id = ${businessId}
      and c.template_key = 'welcome'
      and c.status = 'active'
      and c.activated_at is not null
      and c.starts_at <= ${at}::timestamptz
      and (c.ends_at is null or c.ends_at > ${at}::timestamptz)
      and b.status = 'active'
    limit 1`);
  const [row] = rowsOf<Record<string, unknown>>(result);
  if (!row) return null;
  const plan =
    row.plan === null || row.plan === undefined
      ? null
      : {
          plan: String(row.plan),
          pendingPlan: text(row.pending_plan),
          status: String(row.subscription_status),
          stripeSubscriptionId: text(row.stripe_subscription_id),
        };
  if (!campaignsAllowedFor(plan)) return null;
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    activatedAt: requireDate(row.activated_at),
    message: String(row.message),
    couponLabel: String(row.coupon_label),
    couponCost: String(row.coupon_cost),
    reward: {
      kind: text(row.coupon_kind) as CouponKind | null,
      productId: text(row.coupon_product_id),
      discountUnit: text(row.coupon_discount_unit) as DiscountUnit | null,
      discountValue: text(row.coupon_discount_value),
      extraUnits:
        row.coupon_extra_units === null ? null : Number(row.coupon_extra_units),
      rule: text(row.coupon_rule),
      currencyCode: String(row.currency_code),
    },
    validDays: Number(row.welcome_valid_days),
    reminderDays: Number(row.welcome_reminder_days),
    monthlyCap: Number(row.welcome_monthly_cap),
    redeemFrom: String(row.welcome_redeem_from) as WelcomeRedeemFrom,
    timeZone: String(row.timezone),
  };
}

/**
 * The welcome gifts of the BUSINESS (any of its welcome campaigns: the cap is the
 * business's, not a run's) created since `monthStart` — the local month's first instant
 * (`localMonthStart`). `::int`: a bare `count(*)` is a `bigint` string (gotchas).
 */
export async function countMonthGifts(
  db: Db,
  businessId: string,
  monthStart: Date,
): Promise<number> {
  const result = await db.execute(sql`
    select count(*)::int as given
    from core.campaign_coupon cc
    where cc.business_id = ${businessId}
      and cc.welcome_membership_id is not null
      and cc.created_at >= ${monthStart.toISOString()}::timestamptz`);
  const [row] = rowsOf<{ given: number }>(result);
  return Number(row?.given ?? 0);
}
