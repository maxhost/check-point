import {
  check,
  index,
  integer,
  jsonb,
  numeric,
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
    // Stamp design (Sellos only): the internal R2 key prefix and a version for cache-busting.
    stampImageObjectKey: text("stamp_image_object_key"),
    stampImageVersion: integer("stamp_image_version").notNull().default(0),
    // Card design (Sellos only, spec 0027): background 1, optional background 2 for a
    // linear gradient at `card_background_gradient_angle`, and the stamp-slot border color.
    // All nullable — Puntos and pre-0027 Sellos leave them null (CardPreview falls back to brand).
    cardBackgroundColor: text("card_background_color"),
    cardBackgroundColor2: text("card_background_color_2"),
    cardBackgroundGradientAngle: integer("card_background_gradient_angle"),
    cardBorderColor: text("card_border_color"),
    // Accrual mechanics (spec 0036), nullable so the migration is additive: `per_amount`
    // grants `accrual_grant` units per `accrual_block_amount` of spend (floor, no carry);
    // `per_purchase` (Sellos only) grants `accrual_grant` per transaction (block amount null).
    // A pre-0036 program leaves all three null — the server refuses to save without them.
    accrualMode: text("accrual_mode"),
    accrualGrant: integer("accrual_grant"),
    accrualBlockAmount: numeric("accrual_block_amount", {
      precision: 12,
      scale: 2,
    }),
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
    check(
      "loyalty_program_stamp_version_check",
      sql`${table.stampImageVersion} >= 0`,
    ),
    check(
      "loyalty_program_card_bg_color_check",
      sql`${table.cardBackgroundColor} IS NULL OR ${table.cardBackgroundColor} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    check(
      "loyalty_program_card_bg_color2_check",
      sql`${table.cardBackgroundColor2} IS NULL OR ${table.cardBackgroundColor2} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    check(
      "loyalty_program_card_border_color_check",
      sql`${table.cardBorderColor} IS NULL OR ${table.cardBorderColor} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    check(
      "loyalty_program_card_gradient_angle_check",
      sql`${table.cardBackgroundGradientAngle} IS NULL OR (${table.cardBackgroundGradientAngle} >= 0 AND ${table.cardBackgroundGradientAngle} <= 360)`,
    ),
    // A second background (gradient) never persists without background 1 and an angle.
    check(
      "loyalty_program_card_gradient_pair_check",
      sql`${table.cardBackgroundColor2} IS NULL OR (${table.cardBackgroundColor} IS NOT NULL AND ${table.cardBackgroundGradientAngle} IS NOT NULL)`,
    ),
    // Accrual mechanics (spec 0036); every check tolerates NULL so pre-0036 rows survive.
    check(
      "loyalty_program_accrual_mode_check",
      sql`${table.accrualMode} IS NULL OR ${table.accrualMode} IN ('per_amount', 'per_purchase')`,
    ),
    check(
      "loyalty_program_accrual_grant_check",
      sql`${table.accrualGrant} IS NULL OR ${table.accrualGrant} > 0`,
    ),
    check(
      "loyalty_program_accrual_block_amount_check",
      sql`${table.accrualBlockAmount} IS NULL OR ${table.accrualBlockAmount} > 0`,
    ),
    // per_amount needs a block amount; per_purchase forbids one.
    check(
      "loyalty_program_accrual_pair_check",
      sql`(${table.accrualMode} = 'per_amount' AND ${table.accrualBlockAmount} IS NOT NULL) OR (${table.accrualMode} = 'per_purchase' AND ${table.accrualBlockAmount} IS NULL) OR ${table.accrualMode} IS NULL`,
    ),
    // Puntos never accrues per_purchase.
    check(
      "loyalty_program_accrual_points_mode_check",
      sql`${table.kind} <> 'points' OR ${table.accrualMode} IS NULL OR ${table.accrualMode} = 'per_amount'`,
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

/** Short-lived authorized uploads for a stamp design, scoped by business (mirrors brand). */
export const loyaltyAssetUploads = core.table(
  "loyalty_asset_upload",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("core_loyalty_asset_upload_object_key_unique").on(
      table.objectKey,
    ),
  ],
);

/** Durable retry queue: failures cleaning obsolete stamp R2 prefixes never break a saved program. */
export const loyaltyAssetCleanups = core.table(
  "loyalty_asset_cleanup",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    objectPrefix: text("object_prefix").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    notBefore: timestamp("not_before", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("core_loyalty_asset_cleanup_prefix_unique").on(
      table.objectPrefix,
    ),
  ],
);
