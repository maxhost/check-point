import {
  check,
  index,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { users } from "./auth";
import { businesses } from "./business";

export const loyaltyPrograms = core.table(
  "loyalty_program",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    schemaVersion: text("schema_version").notNull().default("1"),
    configuration: jsonb("configuration").notNull(),
    status: text("status").notNull().default("active"),
    activatedAt: timestamp("activated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    earningEndsAt: timestamp("earning_ends_at", { withTimezone: true }),
    redemptionEndsAt: timestamp("redemption_ends_at", { withTimezone: true }),
    termsMarkdown: text("terms_markdown").notNull(),
    termsHash: text("terms_hash").notNull(),
    termsUpdatedAt: timestamp("terms_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by")
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
    check(
      "loyalty_program_status_check",
      sql`${table.status} in ('active', 'closing', 'inactive')`,
    ),
    check(
      "loyalty_program_kind_check",
      sql`${table.kind} in ('points', 'stamps', 'tiers', 'cashback')`,
    ),
    check(
      "loyalty_program_closing_window_check",
      sql`(${table.status} <> 'closing') OR (${table.earningEndsAt} IS NOT NULL AND ${table.redemptionEndsAt} IS NOT NULL AND ${table.earningEndsAt} < ${table.redemptionEndsAt})`,
    ),
    uniqueIndex("core_loyalty_program_one_operational")
      .on(table.businessId)
      .where(sql`${table.status} in ('active', 'closing')`),
    uniqueIndex("core_loyalty_program_business_created_unique").on(
      table.businessId,
      table.createdAt,
    ),
  ],
);

/**
 * Append-only audit trail of operational changes to a loyalty program.
 * `actorId` is null when the actor is the system (cron expiry).
 */
export const loyaltyProgramEvents = core.table(
  "loyalty_program_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => loyaltyPrograms.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    details: jsonb("details").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "loyalty_program_event_action_check",
      sql`${table.action} in ('created', 'edited', 'closing_scheduled', 'closing_canceled', 'expired')`,
    ),
    index("core_loyalty_program_event_program_idx").on(
      table.programId,
      table.createdAt,
    ),
    index("core_loyalty_program_event_business_idx").on(
      table.businessId,
      table.createdAt,
    ),
  ],
);

export const termsTemplates = core.table(
  "terms_template",
  {
    id: uuid("id").primaryKey(),
    key: text("key").notNull(),
    jurisdictionScope: text("jurisdiction_scope").notNull(),
    locale: text("locale").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    templateMarkdown: text("template_markdown").notNull(),
    variablesAllowlist: jsonb("variables_allowlist").notNull(),
    version: text("version").notNull(),
    status: text("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("core_terms_template_key_version_unique").on(
      table.key,
      table.locale,
      table.jurisdictionScope,
      table.version,
    ),
  ],
);
