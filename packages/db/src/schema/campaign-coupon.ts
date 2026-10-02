import {
  check,
  index,
  integer,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { businesses, locations } from "./business";
import { consumerAccounts, programMemberships } from "./consumer";
import { walletPushQueue } from "./wallet-push";
import { campaigns } from "./campaign";
import { campaignTurns } from "./campaign-turn";
import { campaignPushes } from "./campaign-push";
import { products } from "./catalog";
import { type CouponKindValue, rewardChecks } from "./reward-checks";

/**
 * THE COUPON OF ONE CONSUMER IN ONE CAMPAIGN (spec 0102 / ADR 0093). A channel only
 * ISSUES it — today proximity, when it activates a non-holdout turn — and the counter
 * redeems it by `id` without knowing which channel it came through.
 *
 * `label_snapshot`/`cost_snapshot` are copied at issue time: editing the campaign later
 * never rewrites a coupon already given (ADR 0093 §1). `valid_until` is the campaign's
 * `ends_at` COPIED at issue time (ADR 0094 §1): pausing, ending or archiving the campaign
 * does NOT cut it, and neither does cancelling its turn — only that date, the redemption
 * and the campaign's cap do (ADR 0094 §2).
 *
 * Spec 0106 / ADR 0098 §8: the whole REWARD is copied too — type, product, discount, extra
 * units and rule — with the same shape checks as the campaign (`reward-checks.ts`). A
 * discount by `amount` also copies the business currency (`currency_code_snapshot`): the
 * value means nothing without it, and the business may change it later. `product_id` is
 * `set null` so deleting a product never deletes a coupon (the label keeps naming it).
 *
 * `turn_id` is the PROVENANCE: nullable because the push channel (spec B1) issues coupons
 * without a turn, and unique because a turn issues at most one coupon — the unique is
 * NOT partial, so the issuer's `on conflict (turn_id) do nothing` needs no predicate.
 * `push_id` (spec 0103) is the same for the push channel: one coupon per delivered push,
 * `on conflict (push_id) do nothing`. A coupon has at most ONE origin.
 *
 * Spec 0107 / ADR 0099: `welcome_membership_id` is the third origin — the gift of
 * «Bienvenida» for ONE enrolment, forever (NON-partial unique, `on conflict
 * (welcome_membership_id) do nothing`). `reminder_queue_id` is its expiry notice once
 * queued (one coupon, one notice); only a welcome coupon has one.
 *
 * Spec 0136 / ADR 0104: `cross_claimed_at` is the fourth origin — the consumer CLAIMED an
 * «Oferta cruzada» from «Mis beneficios». It is the ONLY coupon that may have no
 * `membership_id` (the consumer need not be enrolled; the counter enrols on the scan), and
 * there is ONE per consumer and campaign, forever: a PARTIAL unique, so its `on conflict`
 * repeats the predicate (`… where cross_claimed_at is not null and valley_location_id is
 * null do nothing`).
 *
 * Spec 0113 / ADR 0105: a «Horas valle» coupon is ALSO a claim (`cross_claimed_at`, the
 * check below) and names its location (`valley_location_id`): ONE per consumer and
 * location, forever, of ANY campaign (ADR 0105 §4) — its own partial unique. So the cross
 * unique above leaves the valley coupons out (`valley_location_id is null`): a valley
 * campaign with two locations gives one coupon per location, not one per campaign.
 * `set null` so a deleted location never deletes a coupon (the app only archives them).
 */
export const campaignCoupons = core.table(
  "campaign_coupon",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id),
    membershipId: uuid("membership_id").references(() => programMemberships.id),
    turnId: uuid("turn_id").references(() => campaignTurns.id),
    pushId: uuid("push_id").references(() => campaignPushes.id),
    welcomeMembershipId: uuid("welcome_membership_id").references(
      () => programMemberships.id,
    ),
    reminderQueueId: uuid("reminder_queue_id").references(
      () => walletPushQueue.id,
    ),
    crossClaimedAt: timestamp("cross_claimed_at", { withTimezone: true }),
    valleyLocationId: uuid("valley_location_id").references(
      () => locations.id,
      {
        onDelete: "set null",
      },
    ),
    labelSnapshot: text("label_snapshot").notNull(),
    costSnapshot: numeric("cost_snapshot", {
      precision: 12,
      scale: 2,
    }).notNull(),
    kindSnapshot: text("kind_snapshot").$type<CouponKindValue>().notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    discountUnitSnapshot: text("discount_unit_snapshot"),
    discountValueSnapshot: numeric("discount_value_snapshot", {
      precision: 12,
      scale: 2,
    }),
    currencyCodeSnapshot: text("currency_code_snapshot"),
    extraUnitsSnapshot: integer("extra_units_snapshot"),
    ruleSnapshot: text("rule_snapshot"),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "core_campaign_coupon_label_snapshot_check",
      sql`char_length(${table.labelSnapshot}) between 1 and 40`,
    ),
    check(
      "core_campaign_coupon_cost_snapshot_check",
      sql`${table.costSnapshot} >= 0`,
    ),
    ...rewardChecks("core_campaign_coupon_reward", {
      kind: table.kindSnapshot,
      productId: table.productId,
      unit: table.discountUnitSnapshot,
      value: table.discountValueSnapshot,
      extraUnits: table.extraUnitsSnapshot,
      rule: table.ruleSnapshot,
    }),
    check(
      "core_campaign_coupon_reward_currency_check",
      sql`(${table.currencyCodeSnapshot} is not null) = (coalesce(${table.discountUnitSnapshot}, '') = 'amount') and (${table.currencyCodeSnapshot} is null or ${table.currencyCodeSnapshot} ~ '^[A-Z]{3}$')`,
    ),
    check(
      "core_campaign_coupon_validity_check",
      sql`${table.validUntil} > ${table.validFrom}`,
    ),
    uniqueIndex("core_campaign_coupon_turn_unique").on(table.turnId),
    uniqueIndex("core_campaign_coupon_push_unique").on(table.pushId),
    uniqueIndex("core_campaign_coupon_welcome_unique").on(
      table.welcomeMembershipId,
    ),
    uniqueIndex("core_campaign_coupon_reminder_queue_unique").on(
      table.reminderQueueId,
    ),
    check(
      "core_campaign_coupon_single_origin_check",
      sql`num_nonnulls(${table.turnId}, ${table.pushId}, ${table.welcomeMembershipId}, ${table.crossClaimedAt}) <= 1`,
    ),
    check(
      "core_campaign_coupon_membership_check",
      sql`${table.membershipId} is not null or ${table.crossClaimedAt} is not null`,
    ),
    uniqueIndex("core_campaign_coupon_cross_unique")
      .on(table.campaignId, table.consumerId)
      .where(
        sql`${table.crossClaimedAt} is not null and ${table.valleyLocationId} is null`,
      ),
    uniqueIndex("core_campaign_coupon_valley_unique")
      .on(table.valleyLocationId, table.consumerId)
      .where(sql`${table.valleyLocationId} is not null`),
    check(
      "core_campaign_coupon_valley_check",
      sql`${table.valleyLocationId} is null or ${table.crossClaimedAt} is not null`,
    ),
    check(
      "core_campaign_coupon_reminder_check",
      sql`${table.reminderQueueId} is null or ${table.welcomeMembershipId} is not null`,
    ),
    // The counter's scan: this consumer's coupons at this business, soonest to expire.
    index("core_campaign_coupon_scan_idx").on(
      table.businessId,
      table.consumerId,
      table.validUntil,
    ),
  ],
);
