import { type AnyPgColumn, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * THE SHAPE OF «BIENVENIDA» ON `core.campaign` (spec 0107 / ADR 0099). Apart from
 * `campaign.ts` only for the size budget.
 *
 *  - The four parameters exist EXACTLY in a `welcome` campaign, and a `welcome` always
 *    carries a coupon (label) and NEVER a redemption cap: a gift already promised on the
 *    enroll page must not be refused at the counter; the brake is the monthly cap.
 *  - Validity 7/15/30 days; the reminder 1/3/7 days before, strictly inside the validity
 *    (with 7 days of validity, 7 is not a choice — ADR 0099 §4).
 *  - The monthly cap 1..10000 is the PLATFORM's range; the owner said «numero libre».
 *
 * ⚠️ The `coalesce(template_key, '')` is load-bearing: a `check` whose expression is NULL
 * PASSES, and the composer writes `template_key = null` (same as the balance shape check).
 */
type WelcomeColumns = {
  templateKey: AnyPgColumn;
  couponLabel: AnyPgColumn;
  couponMaxRedemptions: AnyPgColumn;
  welcomeValidDays: AnyPgColumn;
  welcomeReminderDays: AnyPgColumn;
  welcomeMonthlyCap: AnyPgColumn;
  welcomeRedeemFrom: AnyPgColumn;
};

export function welcomeChecks(t: WelcomeColumns) {
  return [
    check(
      "core_campaign_welcome_valid_days_check",
      sql`${t.welcomeValidDays} is null or ${t.welcomeValidDays} in (7, 15, 30)`,
    ),
    check(
      "core_campaign_welcome_reminder_days_check",
      sql`${t.welcomeReminderDays} is null or (${t.welcomeReminderDays} in (1, 3, 7) and (${t.welcomeValidDays} is null or ${t.welcomeReminderDays} < ${t.welcomeValidDays}))`,
    ),
    check(
      "core_campaign_welcome_monthly_cap_check",
      sql`${t.welcomeMonthlyCap} is null or ${t.welcomeMonthlyCap} between 1 and 10000`,
    ),
    check(
      "core_campaign_welcome_redeem_from_check",
      sql`${t.welcomeRedeemFrom} is null or ${t.welcomeRedeemFrom} in ('next_day', 'same_visit')`,
    ),
    check(
      "core_campaign_welcome_shape_check",
      sql`(coalesce(${t.templateKey}, '') = 'welcome') = (${t.welcomeValidDays} is not null and ${t.welcomeReminderDays} is not null and ${t.welcomeMonthlyCap} is not null and ${t.welcomeRedeemFrom} is not null) and (coalesce(${t.templateKey}, '') <> 'welcome' or (${t.couponLabel} is not null and ${t.couponMaxRedemptions} is null))`,
    ),
  ];
}
