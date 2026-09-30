import { sql } from "drizzle-orm";
import type { DbTransaction, getDb } from "../db";
import { campaigns } from "../schema";
import type { CouponReward } from "./coupon-issue";
import type { CrossAudience, GeoPoint } from "./cross-rules";
import { campaignsAllowedFor } from "./plan-gate";
import type { CouponKind, DiscountUnit } from "./reward-input";

/**
 * The READS of «Oferta cruzada» (spec 0112 / ADR 0104) and its DTO block. The decision is
 * `cross-rules.ts`; the consumer's endpoints (`consumer/cross-offers.ts`) load these facts
 * and write the coupon. Apart from `template-store.ts` for its size budget.
 *
 * CANDIDATE = `template_key = 'cross'`, `active`, switched on, started, not ended, its
 * business `active`, and the plan allows campaigns (`campaignsAllowedFor`) — the same
 * conditions as `loadWelcomeCampaign` (`welcome-store.ts`). Raw SQL with explicit aliases;
 * dates cross `driver-values.ts`, counts are `::int` and numerics are `Number(...)`.
 *
 * Spec 0113: «Horas valle» is read by the SAME loader (`template = 'valley'`, same
 * conditions): its audience is the fixed `not_active`, its cap `valley_monthly_cap`, and
 * its `validDays` is 0 — its coupon lives until the window closes, not for days.
 */

export type Db = DbTransaction | ReturnType<typeof getDb>;

type Rows<T> = { rows?: T[] } | T[];
export function rowsOf<T>(result: unknown): T[] {
  const value = result as Rows<T>;
  return Array.isArray(value) ? value : (value?.rows ?? []);
}

const text = (value: unknown) =>
  value === null || value === undefined ? null : String(value);

/** Spec 0112: «Oferta cruzada»'s parameters in the DTO; `null` in every other campaign. */
export type CampaignCross = {
  audience: CrossAudience;
  validDays: number;
  monthlyCap: number;
};

/** The three columns as ONE nested select (`cross` of the campaign reads). */
export const crossSelect = {
  audience: campaigns.crossAudience,
  validDays: campaigns.crossValidDays,
  monthlyCap: campaigns.crossMonthlyCap,
};

/** `null` unless the three are there (`core_campaign_cross_shape_check`: all or none). */
export function crossOf(row: {
  audience: string | null;
  validDays: number | null;
  monthlyCap: number | null;
}): CampaignCross | null {
  const { audience, validDays, monthlyCap } = row;
  if (audience === null || validDays === null || monthlyCap === null)
    return null;
  return { audience: audience as CrossAudience, validDays, monthlyCap };
}

export type OfferTemplate = "cross" | "valley";

export type CrossCampaign = {
  id: string;
  template: OfferTemplate;
  businessId: string;
  businessName: string;
  categoryGcid: string;
  timeZone: string;
  logoPath: string | null;
  message: string;
  dormantDays: number;
  audience: CrossAudience;
  validDays: number;
  monthlyCap: number;
  couponLabel: string;
  couponCost: string;
  reward: CouponReward;
};

function toCrossCampaign(row: Record<string, unknown>): CrossCampaign {
  const businessId = String(row.business_id);
  const valley = row.template_key === "valley";
  return {
    id: String(row.id),
    template: valley ? "valley" : "cross",
    businessId,
    businessName: String(row.business_name),
    categoryGcid: String(row.category_gcid),
    timeZone: String(row.timezone),
    logoPath: row.logo_object_key
      ? `/api/public/brands/${businessId}/logo?v=${Number(row.logo_version)}`
      : null,
    message: String(row.message),
    dormantDays: Number(row.dormant_days),
    audience: valley
      ? "not_active"
      : (String(row.cross_audience) as CrossAudience),
    validDays: valley ? 0 : Number(row.cross_valid_days),
    monthlyCap: Number(valley ? row.valley_monthly_cap : row.cross_monthly_cap),
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
  };
}

/** Every CANDIDATE cross (or valley) campaign — or only `campaignId`'s —, by id. */
export async function loadCrossCampaigns(
  db: Db,
  now: Date,
  campaignId?: string,
  template: OfferTemplate = "cross",
): Promise<CrossCampaign[]> {
  const at = now.toISOString();
  const result = await db.execute(sql`
    select c.id, c.template_key, c.business_id, c.message, c.dormant_days, c.cross_audience,
      c.cross_valid_days, c.cross_monthly_cap, c.valley_monthly_cap, c.coupon_label, c.coupon_cost,
      c.coupon_kind, c.coupon_product_id, c.coupon_discount_unit, c.coupon_discount_value,
      c.coupon_extra_units, c.coupon_rule, b.name as business_name, b.category_gcid,
      b.timezone, b.currency_code, b.logo_object_key, b.logo_version,
      s.plan, s.pending_plan, s.status as subscription_status, s.stripe_subscription_id
    from core.campaign c
    join core.business b on b.id = c.business_id
    left join core.subscription s on s.business_id = c.business_id
    where c.template_key = ${template}
      and c.status = 'active'
      and c.activated_at is not null
      and c.starts_at <= ${at}::timestamptz
      and (c.ends_at is null or c.ends_at > ${at}::timestamptz)
      and b.status = 'active'
      ${campaignId ? sql`and c.id = ${campaignId}` : sql``}
    order by c.id`);
  return rowsOf<Record<string, unknown>>(result)
    .filter((row) =>
      campaignsAllowedFor(
        row.plan === null || row.plan === undefined
          ? null
          : {
              plan: String(row.plan),
              pendingPlan: text(row.pending_plan),
              status: String(row.subscription_status),
              stripeSubscriptionId: text(row.stripe_subscription_id),
            },
      ),
    )
    .map(toCrossCampaign);
}

export type CrossLocation = GeoPoint & {
  id: string;
  businessId: string;
  name: string;
  addressLabel: string;
};

/** The ACTIVE, geocoded locations of these businesses (where an offer is measured to). */
export async function loadCrossLocations(
  db: Db,
  businessIds: string[],
): Promise<CrossLocation[]> {
  if (businessIds.length === 0) return [];
  const list = sql.join(
    businessIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const result = await db.execute(sql`
    select l.id, l.business_id, l.name, l.address_label, l.latitude, l.longitude
    from core.location l
    where l.business_id in (${list}) and l.status = 'active'
      and l.latitude is not null and l.longitude is not null
    order by l.id`);
  return rowsOf<Record<string, unknown>>(result).map((row) => ({
    id: String(row.id),
    businessId: String(row.business_id),
    name: String(row.name),
    addressLabel: String(row.address_label),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }));
}

/** The coupons of this campaign created since `monthStart` (`localMonthStart`). */
export async function countMonthCrossCoupons(
  db: Db,
  campaignId: string,
  monthStart: Date,
): Promise<number> {
  const [row] = rowsOf<{ given: number }>(
    await db.execute(sql`
      select count(*)::int as given from core.campaign_coupon cc
      where cc.campaign_id = ${campaignId}
        and cc.created_at >= ${monthStart.toISOString()}::timestamptz`),
  );
  return Number(row?.given ?? 0);
}

/** ADR 0104 §5: whether the consumer holds a cross coupon of THIS business (any state). */
export async function hasCrossCouponFrom(
  db: Db,
  consumerId: string,
  businessId: string,
): Promise<boolean> {
  const [row] = rowsOf<{ found: boolean }>(
    await db.execute(sql`
      select exists (select 1 from core.campaign_coupon cc
                      where cc.consumer_id = ${consumerId}
                        and cc.business_id = ${businessId}
                        and cc.cross_claimed_at is not null) as found`),
  );
  return row?.found === true;
}
