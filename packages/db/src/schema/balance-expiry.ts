import {
  check,
  date,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { consumer, core } from "./_schemas";
import { businesses } from "./business";
import { loyaltyPrograms } from "./loyalty";
import { programMemberships } from "./consumer";
import { walletPushQueue } from "./wallet-push";

/**
 * Spec 0195 / ADR 0136 §8: one row per balance that expired — what was lost and when. The
 * unique `(membership_id, expires_on)` makes a repeated sweep a no-op. Written only by the
 * nightly sweep (`loyalty-program/balance-expiry-store.ts`).
 */
export const balanceExpirations = core.table(
  "balance_expiration",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    programId: uuid("program_id")
      .notNull()
      .references(() => loyaltyPrograms.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => programMemberships.id, { onDelete: "cascade" }),
    consumerId: uuid("consumer_id").notNull(),
    accrualKind: text("accrual_kind").notNull(),
    unitsExpired: integer("units_expired").notNull(),
    expiresOn: date("expires_on").notNull(),
    lastActivityAt: timestamp("last_activity_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("core_balance_expiration_membership_day_unique").on(
      table.membershipId,
      table.expiresOn,
    ),
    index("core_balance_expiration_business_idx").on(
      table.businessId,
      table.createdAt.desc(),
    ),
    check(
      "balance_expiration_kind_check",
      sql`${table.accrualKind} in ('points', 'stamps')`,
    ),
    check("balance_expiration_units_check", sql`${table.unitsExpired} > 0`),
  ],
);

/**
 * Spec 0195 / ADR 0136 §4-§5: the expiry notices already issued, one per threshold and per
 * expiry date. The primary key is the idempotency of the sweep (a retry inserts nothing and
 * queues nothing), and the `0` row is what allows the balance to expire: nobody loses a
 * balance without the «hoy vencen» notice having been issued.
 */
export const balanceExpiryNotices = consumer.table(
  "balance_expiry_notice",
  {
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => programMemberships.id, { onDelete: "cascade" }),
    expiresOn: date("expires_on").notNull(),
    daysBefore: integer("days_before").notNull(),
    queueId: uuid("queue_id").references(() => walletPushQueue.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.membershipId, table.expiresOn, table.daysBefore],
    }),
    check(
      "balance_expiry_notice_days_check",
      sql`${table.daysBefore} in (20, 10, 5, 0)`,
    ),
  ],
);
