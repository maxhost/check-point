import {
  boolean,
  check,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { users } from "./auth";
import { businesses, locations } from "./business";
import { loyaltyPrograms } from "./loyalty";
import { loyaltyRewards } from "./loyalty-reward";
import { consumerAccounts, programMemberships } from "./consumer";

/**
 * A reward redemption (spec 0055 / ADR 0053): the append-only accounting record of one
 * reward handed over at the counter. One redemption = one reward; rows are never
 * mutated. It answers, for audit by brand and by location (ADR 0042): WHAT was handed
 * over (the reward snapshot), WHO claims it (`membership_id` + `consumer_id`), WHO
 * confirmed it (`created_by_user_id`) and WHERE (`business_id` + `location_id`).
 *
 * It is a table of its own and NOT a `mode='redeem'` on `core."order"`: an order models
 * a sale that credits (`total >= 0`, `currency_code`, `units_granted >= 0`), a
 * redemption models a debit with no sale. Two tables keep both sets of checks strict and
 * keep every existing sales query meaning the same thing (ADR 0053 §2).
 *
 * ⚠️ `reward_id` is NULLABLE with `on delete set null` ON PURPOSE. `saveProgram`
 * (spec 0036) deletes every `core.loyalty_reward` of the program and re-inserts them on
 * EVERY save, so the id is not stable. The snapshot columns
 * (`reward_type`/`reward_label`/`reward_discount_percent`/`reward_points_cost`) are the
 * source of truth of the log; the FK is a best-effort reference — same criterion as
 * `order_item.product_id` (ADR 0053 §3).
 *
 * Idempotency is enforced by the unique `(business_id, client_request_id)`, but that
 * index is the BACKSTOP, not the mechanism: the mechanism is the `SELECT … FOR UPDATE`
 * on the membership held by `counter/redemptions.ts` (ADR 0054 §2/§3).
 */
export const rewardRedemptions = core.table(
  "reward_redemption",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    programId: uuid("program_id")
      .notNull()
      .references(() => loyaltyPrograms.id),
    // Cross-schema FKs to consumer.* (same direction as core."order").
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => programMemberships.id),
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id),
    rewardId: uuid("reward_id").references(() => loyaltyRewards.id, {
      onDelete: "set null",
    }),
    rewardType: text("reward_type").notNull(),
    rewardLabel: text("reward_label").notNull(),
    rewardDiscountPercent: integer("reward_discount_percent"),
    /** Snapshot of what the reward COST at redemption time (not what was paid). */
    rewardPointsCost: integer("reward_points_cost"),
    accrualKind: text("accrual_kind").notNull(),
    /** What was ACTUALLY debited — below `reward_points_cost` when the program
     * dispensed the redemption without enough balance (`insufficient_override`). */
    unitsDebited: integer("units_debited").notNull(),
    balanceBefore: integer("balance_before").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    insufficientOverride: boolean("insufficient_override")
      .notNull()
      .default(false),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    clientRequestId: uuid("client_request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "core_reward_redemption_accrual_kind_check",
      sql`${table.accrualKind} in ('points', 'stamps')`,
    ),
    check(
      "core_reward_redemption_units_debited_check",
      sql`${table.unitsDebited} >= 0`,
    ),
    check(
      "core_reward_redemption_balance_before_check",
      sql`${table.balanceBefore} >= 0`,
    ),
    check(
      "core_reward_redemption_balance_after_check",
      sql`${table.balanceAfter} >= 0`,
    ),
    // A Puntos redemption without the cost recorded is not accounting, it is a broken
    // row: `loyalty_reward.points_cost` is nullable, so the shape is representable.
    check(
      "core_reward_redemption_points_cost_check",
      sql`${table.rewardPointsCost} IS NOT NULL OR ${table.accrualKind} = 'stamps'`,
    ),
    uniqueIndex("core_reward_redemption_business_client_request_unique").on(
      table.businessId,
      table.clientRequestId,
    ),
    index("core_reward_redemption_membership_idx").on(table.membershipId),
    index("core_reward_redemption_business_idx").on(
      table.businessId,
      table.createdAt,
    ),
    index("core_reward_redemption_program_idx").on(table.programId),
    // Without this index the `on delete set null` above seq-scans the whole log for
    // EVERY reward deleted — and `saveProgram` deletes them all on every save.
    index("core_reward_redemption_reward_idx").on(table.rewardId),
  ],
);
