import {
  check,
  index,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { businesses } from "./business";
import { consumerAccounts, programMemberships } from "./consumer";
import { campaigns } from "./campaign";
import { campaignTurns } from "./campaign-turn";
import { campaignPushes } from "./campaign-push";

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
 * `turn_id` is the PROVENANCE: nullable because the push channel (spec B1) issues coupons
 * without a turn, and unique because a turn issues at most one coupon — the unique is
 * NOT partial, so the issuer's `on conflict (turn_id) do nothing` needs no predicate.
 * `push_id` (spec 0103) is the same for the push channel: one coupon per delivered push,
 * `on conflict (push_id) do nothing`. A coupon has at most ONE origin.
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
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => programMemberships.id),
    turnId: uuid("turn_id").references(() => campaignTurns.id),
    pushId: uuid("push_id").references(() => campaignPushes.id),
    labelSnapshot: text("label_snapshot").notNull(),
    costSnapshot: numeric("cost_snapshot", {
      precision: 12,
      scale: 2,
    }).notNull(),
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
    check(
      "core_campaign_coupon_validity_check",
      sql`${table.validUntil} > ${table.validFrom}`,
    ),
    uniqueIndex("core_campaign_coupon_turn_unique").on(table.turnId),
    uniqueIndex("core_campaign_coupon_push_unique").on(table.pushId),
    check(
      "core_campaign_coupon_single_origin_check",
      sql`${table.turnId} is null or ${table.pushId} is null`,
    ),
    // The counter's scan: this consumer's coupons at this business, soonest to expire.
    index("core_campaign_coupon_scan_idx").on(
      table.businessId,
      table.consumerId,
      table.validUntil,
    ),
  ],
);
