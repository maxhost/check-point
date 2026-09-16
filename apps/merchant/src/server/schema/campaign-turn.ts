import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  numeric,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { consumer, core } from "./_schemas";
import { users } from "./auth";
import { businesses, locations } from "./business";
import { consumerAccounts, programMemberships } from "./consumer";
import { orders } from "./order";
import { campaigns } from "./campaign";

/**
 * A TURN: the loan of one slot of one consumer's wallet pass to one business for a
 * 5-day window (ADR 0065 §2). `(campaign, consumer, location)` + the window. The
 * business that already has the customer does not get one; the one that lost them
 * borrows the slot and gives it back when the window expires, with its result
 * written (`outcome`).
 *
 * ⚠️ The partial unique `core_campaign_turn_business_consumer_live_unique` is
 * `(business_id, consumer_id) where status in ('queued','active')` — by BUSINESS, not
 * by campaign. It is what makes step 1 of the tick idempotent AND what holds the
 * invariant "at most one live turn per business and consumer" (ADR 0065 §2). By
 * campaign it would be wrong: nothing forbids two `active` campaigns of the same
 * business (the quota is in turns, not campaigns), so two turns of the same business
 * would queue for the same consumer and the second would activate the day the first
 * expired — handing the business two consecutive windows.
 *
 * Because the index is PARTIAL, the `on conflict` of the tick MUST repeat the index
 * predicate: `on conflict (business_id, consumer_id) where status in
 * ('queued','active') do nothing`. A bare `on conflict (business_id, consumer_id) do
 * nothing` fails at RUNTIME with «there is no unique or exclusion constraint matching
 * the ON CONFLICT specification» (verified against Postgres 18, both cases).
 *
 * `location_id` is `set null` (ADR 0042): archiving/deleting a door never loses the
 * turn — the tick cancels it with `location_archived`. A `cancelled` turn keeps its
 * `window_end`, which is why the cooldown query filters `status in ('active','done')`:
 * only the turn that CONSUMED the opportunity burns it.
 */
export const campaignTurns = core.table(
  "campaign_turn",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    /** Denormalized for the per-business quota, cooldown and the partial unique. */
    businessId: uuid("business_id").notNull(),
    // Cross-schema FKs to consumer.* (same direction as core."order").
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => programMemberships.id),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("queued"),
    /** A holdout turn is decided and recorded but NEVER placed in the pass: it is the
     * only oracle of effect we have (no platform reports impressions). It counts
     * neither toward the ≤5 live turns nor toward the business quota. */
    holdout: boolean("holdout").notNull().default(false),
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    windowStart: timestamp("window_start", { withTimezone: true }),
    windowEnd: timestamp("window_end", { withTimezone: true }),
    // Copied at activation: editing a paused campaign never rewrites a live turn.
    messageSnapshot: text("message_snapshot"),
    couponLabelSnapshot: text("coupon_label_snapshot"),
    couponCostSnapshot: numeric("coupon_cost_snapshot", {
      precision: 12,
      scale: 2,
    }),
    outcome: text("outcome"),
    outcomeOrderId: uuid("outcome_order_id").references(() => orders.id),
    // Annotated: `campaign_turn` ⇄ `coupon_redemption` is a CIRCULAR fk pair, and
    // without the explicit column type tsc cannot infer either table (TS7022/7024).
    outcomeRedemptionId: uuid("outcome_redemption_id").references(
      (): AnyPgColumn => couponRedemptions.id,
    ),
    outcomeAt: timestamp("outcome_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
  },
  (table) => [
    check(
      "core_campaign_turn_status_check",
      sql`${table.status} in ('queued', 'active', 'done', 'cancelled')`,
    ),
    check(
      "core_campaign_turn_outcome_check",
      sql`${table.outcome} is null or ${table.outcome} in ('purchase', 'coupon_redeemed', 'none')`,
    ),
    check(
      "core_campaign_turn_cancel_reason_check",
      sql`${table.cancelReason} is null or ${table.cancelReason} in ('opt_out', 'campaign_paused', 'campaign_ended', 'plan_downgraded', 'location_archived', 'location_without_coordinates', 'membership_gone')`,
    ),
    // One live turn per BUSINESS and consumer — see the table comment.
    uniqueIndex("core_campaign_turn_business_consumer_live_unique")
      .on(table.businessId, table.consumerId)
      .where(sql`${table.status} in ('queued', 'active')`),
    index("core_campaign_turn_consumer_status_idx").on(
      table.consumerId,
      table.status,
    ),
    index("core_campaign_turn_campaign_status_idx").on(
      table.campaignId,
      table.status,
    ),
    index("core_campaign_turn_business_status_idx").on(
      table.businessId,
      table.status,
    ),
    // Cooldown lookup: last window of this business for this consumer.
    index("core_campaign_turn_cooldown_idx").on(
      table.businessId,
      table.consumerId,
      table.windowEnd,
    ),
  ],
);

/**
 * One coupon handed over at the counter (spec 0065, phase C). Append-only accounting
 * record, same shape as `core.reward_redemption` (ADR 0053): WHAT (`label_snapshot` /
 * `cost_snapshot`, never recomputed from the campaign), WHO claims it
 * (`membership_id` + `consumer_id`), WHO confirmed it (`created_by_user_id`) and
 * WHERE (`business_id` + `location_id`, ADR 0042).
 *
 * Two uniques, with two different jobs:
 *  - `turn_id` unique — one redemption per turn. It is a BACKSTOP, not the mechanism:
 *    it only fires for a DIFFERENT `client_request_id` (→ 409 `already_redeemed`).
 *  - `(business_id, client_request_id)` unique — idempotency, same pattern as
 *    `core."order"` and `core.reward_redemption`. The counter's legitimate retry (a
 *    network timeout, same `clientRequestId`) is resolved by READING this row under
 *    the campaign lock BEFORE any business guard, and answering 200 with it.
 *
 * It does NOT touch `points_balance`/`stamps_count`: a coupon is not a reward of the
 * program (spec 0065, «No entra»).
 */
export const couponRedemptions = core.table(
  "coupon_redemption",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    turnId: uuid("turn_id")
      .notNull()
      .references(() => campaignTurns.id),
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
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    labelSnapshot: text("label_snapshot").notNull(),
    costSnapshot: numeric("cost_snapshot", {
      precision: 12,
      scale: 2,
    }).notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    clientRequestId: uuid("client_request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("core_coupon_redemption_turn_unique").on(table.turnId),
    uniqueIndex("core_coupon_redemption_business_client_request_unique").on(
      table.businessId,
      table.clientRequestId,
    ),
    index("core_coupon_redemption_campaign_idx").on(table.campaignId),
    index("core_coupon_redemption_business_idx").on(
      table.businessId,
      table.createdAt,
    ),
  ],
);

/**
 * What IS in each consumer's pass right now: written by step 4 of the tick, read by
 * the pass builders (Apple `locations`, Google `merchantLocations`). The pass builder
 * NEVER decides what to place — it only renders these rows.
 *
 * Pk `(consumer_id, location_id)`: one door, one row, one `relevantText` — that is the
 * shape Apple imposes. The two bags (utility and turn) are NOT disjoint (a customer
 * who bought 60 days ago and kept one stamp is in both, through the SAME door), so a
 * door that falls in both produces ONE row with `slot_kind = 'both'` and a COMPOSED
 * text (`composeRelevantText`, decision of the owner 2026-09-15). Without that rule
 * step 4 would die with `23505`, or a deduped turn would sit `active` burning quota
 * while absent from the pass.
 *
 * `relevant_text` is capped at **120**, not 60: 60 is the cap of `utilityText` ALONE,
 * and this column also holds the COMPOSED text, whose `cap` is 120 (spec 0065; the
 * owner's own example, «Bar La Esquina: te faltan 2 sellos · 2x1 en picadas hasta el
 * domingo», is 68 characters). With the check at 60 every `slot_kind = 'both'` insert
 * — the central profile of the audience, not an edge — would die with `23514`.
 *
 * The ≤10 rows per consumer cap has NO SQL check: it is enforced by the applier under
 * the per-consumer lock (`select … for update` on `consumer_account`), because it is a
 * property of the SET, not of a row. See the test plan.
 */
export const passPlacements = consumer.table(
  "pass_placement",
  {
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    slotKind: text("slot_kind").notNull(),
    turnId: uuid("turn_id").references(() => campaignTurns.id),
    businessId: uuid("business_id").notNull(),
    relevantText: text("relevant_text").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.consumerId, table.locationId] }),
    check(
      "consumer_pass_placement_slot_kind_check",
      sql`${table.slotKind} in ('utility', 'turn', 'both')`,
    ),
    check(
      "consumer_pass_placement_relevant_text_check",
      sql`char_length(${table.relevantText}) <= 120`,
    ),
    index("consumer_pass_placement_business_idx").on(table.businessId),
    index("consumer_pass_placement_turn_idx").on(table.turnId),
  ],
);
