import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { core } from "./_schemas";
import { businesses } from "./business";
export const moduleResourceVersions = core.table(
  "module_resource_version",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    providerId: text("provider_id").notNull(),
    slot: text("slot").notNull(),
    versionId: uuid("version_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [
        t.businessId,
        t.resourceType,
        t.resourceId,
        t.providerId,
        t.slot,
      ],
    }),
  ],
);
export const moduleEvents = core.table(
  "module_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").notNull(),
    sourceId: uuid("source_id").notNull(),
    locationId: uuid("location_id").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("module_event_source_unique").on(
      t.businessId,
      t.eventType,
      t.sourceId,
    ),
    index("module_event_local_cut_idx").on(t.businessId, t.locationId, t.id),
  ],
);
export const moduleEventDeliveries = core.table(
  "module_event_delivery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => moduleEvents.id, { onDelete: "cascade" }),
    subscriberId: text("subscriber_id").notNull(),
    state: text("state").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    claimToken: uuid("claim_token"),
    claimUntil: timestamp("claim_until", { withTimezone: true }),
    diagnostic: text("diagnostic"),
    terminalReason: text("terminal_reason"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("module_event_delivery_subscriber_unique").on(
      t.eventId,
      t.subscriberId,
    ),
    check(
      "module_event_delivery_state_check",
      sql`${t.state} in ('pending','processing','applied','skipped')`,
    ),
    index("module_event_delivery_due_idx")
      .on(t.nextAttemptAt, t.id)
      .where(sql`${t.state} = 'pending'`),
    index("module_event_delivery_claim_idx")
      .on(t.claimUntil, t.id)
      .where(sql`${t.state} = 'processing'`),
  ],
);

/** Generic compatibility dispatch metadata. No executable module dependency. */
export const historicalEventHandlers = core.table(
  "historical_event_handler",
  {
    subscriberId: text("subscriber_id").notNull(),
    eventType: text("event_type").notNull(),
    handlerKey: text("handler_key").notNull(),
    sourceProviderId: text("source_provider_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.subscriberId, t.eventType] })],
);
