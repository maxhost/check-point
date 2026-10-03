import {
  check,
  doublePrecision,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { consumerAccounts } from "./consumer";
import { walletPushQueue } from "./wallet-push";
import { campaigns } from "./campaign";
import { campaignCoupons } from "./campaign-coupon";
import { orders } from "./order";

/**
 * THE RECORD OF THE CROSS SALE (spec 0143 / ADR 0117 §10): one row per order accredited
 * while «Venta cruzada» is on — the decision, whatever its outcome. `order_id` is UNIQUE:
 * it is the idempotency of `decideCrossSale` (`on conflict (order_id) do nothing`), so a
 * second run over the same order writes nothing.
 *
 * `issued` carries the chosen campaign, its coupon, its queue row and the number drawn;
 * `no_candidates` / `no_origin` record the purchases with nothing to offer (the algorithm
 * doc §4 asks for them); `coupon_conflict` is the same consumer winning the coupon in a
 * parallel purchase (the partial unique of `campaign_coupon` refused the insert).
 *
 * `queue_id` is what the worker's gate looks up (`marketing/cross-sale-push.ts`): a queue
 * row with a decision behind it is the «regalo misterio», sent with `clickId = id`, and the
 * click (`POST /api/public/push/click`) writes `clicked_at` — the consumer role may only
 * read `id`/`clicked_at` and update `clicked_at` (migration 0063).
 */
export const crossDecisions = core.table(
  "cross_decision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .unique("core_cross_decision_order_unique")
      .references(() => orders.id, { onDelete: "cascade" }),
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id, { onDelete: "cascade" }),
    /** The business where they bought (A). */
    businessId: uuid("business_id").notNull(),
    locationId: uuid("location_id"),
    originKind: text("origin_kind").notNull(),
    policy: text("policy").notNull(),
    epsilon: doublePrecision("epsilon").notNull(),
    candidateCount: integer("candidate_count").notNull(),
    draw: doublePrecision("draw"),
    chosenCampaignId: uuid("chosen_campaign_id").references(() => campaigns.id),
    couponId: uuid("coupon_id").references(() => campaignCoupons.id, {
      onDelete: "set null",
    }),
    queueId: uuid("queue_id").references(() => walletPushQueue.id, {
      onDelete: "set null",
    }),
    outcome: text("outcome").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "core_cross_decision_outcome_check",
      sql`${table.outcome} in ('issued', 'no_candidates', 'no_origin', 'coupon_conflict')`,
    ),
    index("core_cross_decision_chosen_idx").on(
      table.chosenCampaignId,
      table.decidedAt,
    ),
    index("core_cross_decision_queue_idx").on(table.queueId),
  ],
);

/**
 * ONE ELIGIBLE CAMPAIGN OF ONE DECISION (spec 0143 §3-§4): where it was, what was left of its
 * cap, the consumer's segment for that business, the three factors of the H4 lottery and the
 * final probability. Only the ELIGIBLE ones are recorded (the algorithm doc §4).
 */
export const crossCandidates = core.table(
  "cross_candidate",
  {
    decisionId: uuid("decision_id")
      .notNull()
      .references(() => crossDecisions.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").notNull(),
    businessId: uuid("business_id").notNull(),
    /** The nearest location of B to the origin. */
    locationId: uuid("location_id").notNull(),
    categoryGcid: text("category_gcid").notNull(),
    distanceMeters: integer("distance_meters").notNull(),
    capRemaining: integer("cap_remaining").notNull(),
    segment: text("segment").notNull(),
    daysSinceLastOrder: integer("days_since_last_order"),
    ordersCount: integer("orders_count").notNull(),
    factorCloseness: doublePrecision("factor_closeness").notNull(),
    factorBehind: doublePrecision("factor_behind").notNull(),
    factorBonus: doublePrecision("factor_bonus").notNull(),
    probability: doublePrecision("probability").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.decisionId, table.campaignId] }),
    check(
      "core_cross_candidate_segment_check",
      sql`${table.segment} in ('new', 'dormant', 'regular')`,
    ),
    index("core_cross_candidate_campaign_idx").on(table.campaignId),
  ],
);
