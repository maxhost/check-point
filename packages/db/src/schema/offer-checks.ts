import { type AnyPgColumn, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * THE SHAPE OF THE «MIS BENEFICIOS» TEMPLATES ON `core.campaign`: «Oferta cruzada» (spec
 * 0136 / ADR 0104) and «Horas valle» (spec 0113 / ADR 0105). Apart from `campaign.ts` only
 * for the size budget (the cross checks moved here unchanged — same names, same SQL).
 *
 * ⚠️ The `coalesce(template_key, '')` is load-bearing: a `check` whose expression is NULL
 * PASSES, and the composer writes `template_key = null`.
 */

/**
 * The templates with NO channel, a coupon without redemption cap and no mandatory
 * `ends_at` (their coupon expires by its own rule): «Bienvenida», «Oferta cruzada» and
 * «Horas valle». Shared by the three checks of `campaign.ts` that exempt them.
 */
export const NO_CHANNEL_TEMPLATES = sql.raw(`'welcome', 'cross', 'valley'`);

type OfferColumns = {
  templateKey: AnyPgColumn;
  crossAudience: AnyPgColumn;
  crossValidDays: AnyPgColumn;
  crossMonthlyCap: AnyPgColumn;
  valleyMonthlyCap: AnyPgColumn;
};

export function offerChecks(t: OfferColumns) {
  return [
    // Spec 0136: the three parameters of «Oferta cruzada», EACH present exactly in `cross`.
    check(
      "core_campaign_cross_shape_check",
      sql`(coalesce(${t.templateKey}, '') = 'cross') = (${t.crossAudience} is not null) and (coalesce(${t.templateKey}, '') = 'cross') = (${t.crossValidDays} is not null) and (coalesce(${t.templateKey}, '') = 'cross') = (${t.crossMonthlyCap} is not null)`,
    ),
    check(
      "core_campaign_cross_audience_check",
      sql`${t.crossAudience} is null or ${t.crossAudience} in ('non_members', 'dormant', 'any')`,
    ),
    check(
      "core_campaign_cross_valid_days_check",
      sql`${t.crossValidDays} is null or ${t.crossValidDays} in (7, 15, 30)`,
    ),
    check(
      "core_campaign_cross_monthly_cap_check",
      sql`${t.crossMonthlyCap} is null or ${t.crossMonthlyCap} between 1 and 10000`,
    ),
    // Spec 0113: «Horas valle»'s monthly cap, present exactly in `valley` (V5: 1..10000).
    check(
      "core_campaign_valley_shape_check",
      sql`(coalesce(${t.templateKey}, '') = 'valley') = (${t.valleyMonthlyCap} is not null)`,
    ),
    check(
      "core_campaign_valley_monthly_cap_check",
      sql`${t.valleyMonthlyCap} is null or ${t.valleyMonthlyCap} between 1 and 10000`,
    ),
  ];
}
