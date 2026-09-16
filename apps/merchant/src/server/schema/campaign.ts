import {
  check,
  index,
  integer,
  numeric,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { users } from "./auth";
import { businesses, locations } from "./business";
import { products } from "./catalog";

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
 * database refuses it. `coupon_product_id` is informative only in this phase (ADR
 * 0002: declared cost, no margin math) and `set null` so deleting a product never
 * deletes a campaign.
 *
 * `pause_reason` distinguishes who pulled the brake: `owner` (the pause button),
 * `plan_downgraded` (the defensive pause of `billing/webhook-apply.ts` when the plan
 * lands on `free`/`none` without passing through our own route) and
 * `no_active_locations`. The tick reads it to pick the turn's `cancel_reason`.
 */
export const campaigns = core.table(
  "campaign",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
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
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
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
      sql`${table.dormantDays} between 7 and 365`,
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
    // The coupon is all or nothing (see table comment).
    check(
      "core_campaign_coupon_all_or_nothing_check",
      sql`(${table.couponLabel} is null) = (${table.couponCost} is null) and (${table.couponLabel} is null) = (${table.couponMaxRedemptions} is null)`,
    ),
    check(
      "core_campaign_dates_check",
      sql`${table.endsAt} is null or ${table.endsAt} > ${table.startsAt}`,
    ),
    index("core_campaign_business_status_idx").on(
      table.businessId,
      table.status,
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
