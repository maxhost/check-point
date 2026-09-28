import {
  check,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { consumer } from "./_schemas";
import { consumerAccounts, walletPasses } from "./consumer";

// Split out of ./consumer when spec 0107 grew `wallet_pass` (size budget). The tables are
// unchanged; the barrel (`../schema.ts`) re-exports them as before.

/**
 * PassKit device registration (spec 0033). Each iOS device that adds an Apple pass
 * registers a `device_library_id` + APNs `push_token` via the web service; the
 * worker sends the empty APNs push to each. Unique (device_library_id, wallet_pass_id)
 * makes the register endpoint an idempotent upsert. `pushToken` is a device secret —
 * NEVER serialized in a DTO. Rows cascade with the pass and are wiped on rotation.
 */
export const walletPushDevices = consumer.table(
  "wallet_push_device",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletPassId: uuid("wallet_pass_id")
      .notNull()
      .references(() => walletPasses.id, { onDelete: "cascade" }),
    deviceLibraryId: text("device_library_id").notNull(),
    pushToken: text("push_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("wallet_push_device_library_pass_unique").on(
      table.deviceLibraryId,
      table.walletPassId,
    ),
    index("wallet_push_device_pass_idx").on(table.walletPassId),
  ],
);

/**
 * Push outbox (ADR 0037). One row per notice. `class` sets priority (`transactional`
 * preempts and skips cooldown; `campaign` is deferred, respects the cooldown;
 * `pass_refresh` — spec 0065 — is the SILENT lane of the wallet pass: always sent,
 * never advances the cooldown clock, never postpones a pending `campaign`). The
 * `transactional` row is enqueued INSIDE `persistGrant`'s transaction (0030), so an
 * accredited order ⇔ its push row. The worker claims a row (`pending` → `sending`),
 * delivers it, and closes it (`sent`) or backs it off (`pending`, then `failed` after
 * N attempts), or —a `campaign` only, spec 0103— `cancelled` by marketing's delivery gate.
 * `not_before` gates when it may go out (default now); the worker never
 * sends earlier. No token/secret columns — the whole row is safe to serialize.
 */
export const walletPushQueue = consumer.table(
  "wallet_push_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id, { onDelete: "cascade" }),
    class: text("class").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("pending"),
    notBefore: timestamp("not_before", { withTimezone: true })
      .notNull()
      .defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    index("wallet_push_queue_status_not_before_idx").on(
      table.status,
      table.notBefore,
    ),
    index("wallet_push_queue_consumer_idx").on(table.consumerId),
    // NO unique index for `pass_refresh`, on purpose: the worker returns a failed row to
    // 'pending' in the SAME update that bumps `attempts`, so a partial unique over
    // status='pending' would wedge it in 'sending' forever (spec 0065) — see that spec.
    check(
      "wallet_push_queue_class_check",
      sql`${table.class} in ('transactional', 'campaign', 'pass_refresh')`,
    ),
    check(
      "wallet_push_queue_status_check",
      sql`${table.status} in ('pending', 'sending', 'sent', 'failed', 'cancelled')`,
    ),
  ],
);
