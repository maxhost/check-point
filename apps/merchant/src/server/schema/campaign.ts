import {
  boolean,
  check,
  index,
  integer,
  numeric,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { users } from "./auth";
import { businesses, locations } from "./business";
import { products } from "./catalog";
import { rewardChecks } from "./reward-checks";
import { welcomeChecks } from "./welcome-checks";

/**
 * A marketing campaign (spec 0065 / ADR 0064). `kind` is the extension point: this
 * spec ships only `'proximity'` and every future campaign type adds its value with
 * its own spec (ADR 0064 §2). The campaign is a DEFINITION, never a send: nobody
 * "launches" proximity — the tick queues and places turns (`campaign_turn`).
 *
 * The coupon is ALL OR NOTHING (`core_campaign_coupon_all_or_nothing_check`): a
 * campaign either carries the three coupon columns (`label`, `cost`,
 * `max_redemptions`) or none of them. A half-declared coupon is representable in the
 * type system and would reach the counter with no cap or no cost to report, so the
 * database refuses it. Since spec 0106 (ADR 0098) the coupon also has a TYPE
 * (`coupon_kind`, present exactly when the label is) and the fields that type needs;
 * `coupon_product_id` names the product of a `free_product`/`two_for_one` — a product OF
 * THIS BUSINESS, which the stores check (`marketing/reward-store.ts`): the fk alone would
 * accept any business's product. `set null` so deleting a product never deletes a campaign.
 *
 * `pause_reason` distinguishes who pulled the brake: `owner` (the pause button),
 * `plan_downgraded` (the defensive pause of `billing/webhook-apply.ts` when the plan
 * lands on `free`/`none` without passing through our own route) and
 * `no_active_locations`. The tick reads it to pick the turn's `cancel_reason`.
 *
 * The CHANNELS (spec 0103 / ADR 0095) are two booleans, never a `kind`: `kind` describes
 * the AUDIENCE, and a template runs by proximity, push or both. At least one is on
 * (`core_campaign_channel_check`) — except «Bienvenida» (spec 0107), which has NONE; the
 * composer always creates `proximity` alone.
 *
 * `template_key` (spec 0101 / ADR 0092) marks a PREBUILT campaign: `null` is a custom one
 * from the composer. The catalog itself (texts, options, defaults) lives in code
 * (`marketing/templates.ts`); the `check` only pins the known keys. ONE live run per
 * business and template is guaranteed HERE, by the partial unique index over
 * `draft`/`active`/`paused` — the `select` the store does first only answers faster; two
 * simultaneous `enable` requests are stopped by the index (`23505` → 409
 * `template_already_live`).
 */
export const campaigns = core.table(
  "campaign",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    templateKey: text("template_key"),
    channelProximity: boolean("channel_proximity").notNull().default(true),
    channelPush: boolean("channel_push").notNull().default(false),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    pauseReason: text("pause_reason"),
    dormantDays: integer("dormant_days").notNull().default(30),
    message: text("message").notNull(),
    couponLabel: text("coupon_label"),
    couponCost: numeric("coupon_cost", { precision: 12, scale: 2 }),
    couponMaxRedemptions: integer("coupon_max_redemptions"),
    couponProductId: uuid("coupon_product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    // Spec 0106 / ADR 0098: the reward's TYPE and its fields (shape in `reward-checks.ts`).
    couponKind: text("coupon_kind"),
    couponDiscountUnit: text("coupon_discount_unit"),
    couponDiscountValue: numeric("coupon_discount_value", {
      precision: 12,
      scale: 2,
    }),
    couponExtraUnits: integer("coupon_extra_units"),
    couponRule: text("coupon_rule"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    // Spec 0104 / ADR 0096: the parameters of the BALANCE templates. #7 keeps BOTH
    // thresholds (the tick applies the one of the program's kind); #8 its repetition.
    nearRewardStamps: integer("near_reward_stamps"),
    nearRewardPercent: integer("near_reward_percent"),
    rewardRepeat: text("reward_repeat"),
    // Spec 0107 / ADR 0099: the parameters of «Bienvenida» — present exactly in `welcome`
    // (`core_campaign_welcome_shape_check`, in `welcome-checks.ts`).
    welcomeValidDays: integer("welcome_valid_days"),
    welcomeReminderDays: integer("welcome_reminder_days"),
    welcomeMonthlyCap: integer("welcome_monthly_cap"),
    welcomeRedeemFrom: text("welcome_redeem_from"),
    // Spec 0112 / ADR 0104: «Oferta cruzada» — present exactly in `cross`.
    crossAudience: text("cross_audience"),
    crossValidDays: integer("cross_valid_days"),
    crossMonthlyCap: integer("cross_monthly_cap"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("core_campaign_kind_check", sql`${table.kind} in ('proximity')`),
    // Spec 0107: «Bienvenida» goes with NO channel (it is issued when the pass is
    // installed), and so does «Oferta cruzada» (spec 0112: its only channel is «Mis
    // beneficios»); every other campaign with at least one.
    check(
      "core_campaign_channel_check",
      sql`(coalesce(${table.templateKey}, '') in ('welcome', 'cross')) = (not ${table.channelProximity} and not ${table.channelPush})`,
    ),
    check(
      "core_campaign_status_check",
      sql`${table.status} in ('draft', 'active', 'paused', 'ended', 'archived')`,
    ),
    check(
      "core_campaign_pause_reason_check",
      sql`${table.pauseReason} is null or ${table.pauseReason} in ('owner', 'plan_downgraded', 'no_active_locations')`,
    ),
    check(
      "core_campaign_dormant_days_check",
      sql`${table.dormantDays} between 3 and 365`,
    ),
    check(
      "core_campaign_name_check",
      sql`char_length(${table.name}) between 1 and 80`,
    ),
    check(
      "core_campaign_message_check",
      sql`char_length(${table.message}) between 1 and 60`,
    ),
    check(
      "core_campaign_coupon_label_check",
      sql`${table.couponLabel} is null or char_length(${table.couponLabel}) between 1 and 40`,
    ),
    check(
      "core_campaign_coupon_cost_check",
      sql`${table.couponCost} is null or ${table.couponCost} >= 0`,
    ),
    check(
      "core_campaign_coupon_max_redemptions_check",
      sql`${table.couponMaxRedemptions} is null or ${table.couponMaxRedemptions} >= 1`,
    ),
    // The coupon is all or nothing (see table comment). «Bienvenida» (spec 0107) and «Oferta
    // cruzada» (spec 0112) have label and cost and NEVER a redemption cap: their brake is
    // the monthly cap.
    check(
      "core_campaign_coupon_all_or_nothing_check",
      sql`(coalesce(${table.templateKey}, '') in ('welcome', 'cross') and ${table.couponLabel} is not null and ${table.couponCost} is not null and ${table.couponMaxRedemptions} is null) or (coalesce(${table.templateKey}, '') not in ('welcome', 'cross') and (${table.couponLabel} is null) = (${table.couponCost} is null) and (${table.couponLabel} is null) = (${table.couponMaxRedemptions} is null))`,
    ),
    // Spec 0106: the reward has a type exactly when there is a coupon.
    check(
      "core_campaign_coupon_kind_presence_check",
      sql`(${table.couponKind} is null) = (${table.couponLabel} is null)`,
    ),
    ...rewardChecks("core_campaign_reward", {
      kind: table.couponKind,
      productId: table.couponProductId,
      unit: table.couponDiscountUnit,
      value: table.couponDiscountValue,
      extraUnits: table.couponExtraUnits,
      rule: table.couponRule,
    }),
    // ADR 0094 §3: an issued coupon lives until `ends_at`, so a campaign with a coupon
    // needs one. The composer and `enable` refuse it first with a 400 (spec 0102).
    // «Bienvenida» and «Oferta cruzada» are exempt: their coupon expires by its own days.
    check(
      "core_campaign_coupon_needs_end_check",
      sql`coalesce(${table.templateKey}, '') in ('welcome', 'cross') or ${table.couponLabel} is null or ${table.endsAt} is not null`,
    ),
    check(
      "core_campaign_dates_check",
      sql`${table.endsAt} is null or ${table.endsAt} > ${table.startsAt}`,
    ),
    index("core_campaign_business_status_idx").on(
      table.businessId,
      table.status,
    ),
    check(
      "core_campaign_template_key_check",
      sql`${table.templateKey} is null or ${table.templateKey} in ('missed_you', 'win_back', 'near_reward', 'unclaimed_reward', 'at_risk', 'welcome', 'cross')`,
    ),
    check(
      "core_campaign_near_reward_stamps_check",
      sql`${table.nearRewardStamps} is null or ${table.nearRewardStamps} between 1 and 3`,
    ),
    check(
      "core_campaign_near_reward_percent_check",
      sql`${table.nearRewardPercent} is null or ${table.nearRewardPercent} in (10, 20)`,
    ),
    check(
      "core_campaign_reward_repeat_check",
      sql`${table.rewardRepeat} is null or ${table.rewardRepeat} in ('once', 'every_30_days')`,
    ),
    // The SHAPE of the balance parameters (spec 0104 §1). ⚠️ The `coalesce` is load-bearing:
    // a `check` whose expression is NULL PASSES, and the composer writes `template_key = null`.
    check(
      "core_campaign_balance_shape_check",
      sql`(coalesce(${table.templateKey}, '') = 'near_reward') = (${table.nearRewardStamps} is not null and ${table.nearRewardPercent} is not null) and (coalesce(${table.templateKey}, '') = 'unclaimed_reward') = (${table.rewardRepeat} is not null) and (${table.nearRewardStamps} is null) = (${table.nearRewardPercent} is null)`,
    ),
    ...welcomeChecks(table),
    // Spec 0112: the three parameters of «Oferta cruzada», EACH present exactly in `cross`.
    check(
      "core_campaign_cross_shape_check",
      sql`(coalesce(${table.templateKey}, '') = 'cross') = (${table.crossAudience} is not null) and (coalesce(${table.templateKey}, '') = 'cross') = (${table.crossValidDays} is not null) and (coalesce(${table.templateKey}, '') = 'cross') = (${table.crossMonthlyCap} is not null)`,
    ),
    check(
      "core_campaign_cross_audience_check",
      sql`${table.crossAudience} is null or ${table.crossAudience} in ('non_members', 'dormant', 'any')`,
    ),
    check(
      "core_campaign_cross_valid_days_check",
      sql`${table.crossValidDays} is null or ${table.crossValidDays} in (7, 15, 30)`,
    ),
    check(
      "core_campaign_cross_monthly_cap_check",
      sql`${table.crossMonthlyCap} is null or ${table.crossMonthlyCap} between 1 and 10000`,
    ),
    // One live run per business and template (see the table comment).
    uniqueIndex("core_campaign_template_live_unique")
      .on(table.businessId, table.templateKey)
      .where(
        sql`${table.templateKey} is not null and ${table.status} in ('draft', 'active', 'paused')`,
      ),
  ],
);

/**
 * The locations a campaign targets (ADR 0006: everything of value is scoped by
 * location). Composite pk = the assignment is a set, and re-assigning the same
 * location is idempotent. Both sides cascade: archiving is the product-level
 * operation, deleting is not a path the app offers.
 */
export const campaignLocations = core.table(
  "campaign_location",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.locationId] })],
);

/**
 * The PHOTO of one campaign's audience at one tick. Written by step 1 of the tick,
 * one row per campaign per run, with the five exclusion counts of that evaluation.
 *
 * It exists because a consumer EXCLUDED from the audience leaves no row anywhere
 * else: without this table the five numbers of the results screen cannot be
 * reconstructed by SQL after the tick, and recomputing them later would LIE — today's
 * cooldown and opt-out are not the ones the tick saw. It is what makes the DoD item
 * "the exclusion reason is counted in results" verifiable instead of readable.
 */
export const campaignTickAudiences = core.table(
  "campaign_tick_audience",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull(),
    total: integer("total").notNull(),
    reachable: integer("reachable").notNull(),
    noLocation: integer("no_location").notNull(),
    optOut: integer("opt_out").notNull(),
    cooldown: integer("cooldown").notNull(),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.ranAt] })],
);
