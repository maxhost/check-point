import {
  check,
  index,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { consumer } from "./_schemas";
import { consumerAccounts } from "./consumer";

/**
 * Web Push subscription — the second notification transport (spec 0037, ADR 0038/0039).
 * N per consumer (a phone in the Chrome tab + the installed iOS PWA are distinct
 * subscriptions). `endpoint` is the browser push service URL (unique — the natural
 * upsert key); `p256dhKey` and `authKey` are the client's RFC 8291 encryption material.
 * All three are DEVICE SECRETS and are NEVER serialized in a DTO (see
 * `webPushSubscriptionResponse`). `platform` (`ios`/`android`/`other`) is derived from
 * the UA for analytics and the rotation purge. Rows cascade with the consumer and are
 * wiped on `rotatePassCredentials` (0032) — the old home-screen icon then goes dead.
 */
export const webPushSubscriptions = consumer.table(
  "web_push_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dhKey: text("p256dh_key").notNull(),
    authKey: text("auth_key").notNull(),
    userAgent: text("user_agent"),
    platform: text("platform").notNull().default("other"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("web_push_subscription_endpoint_unique").on(table.endpoint),
    index("web_push_subscription_consumer_idx").on(table.consumerId),
    check(
      "web_push_subscription_platform_check",
      sql`${table.platform} in ('ios', 'android', 'other')`,
    ),
  ],
);
