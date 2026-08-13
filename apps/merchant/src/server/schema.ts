import {
  boolean,
  check,
  jsonb,
  integer,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const merchantAuth = pgSchema("merchant_auth");
export const core = pgSchema("core");

export const users = merchantAuth.table(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("merchant_auth_user_email_unique").on(table.email)],
);

export const sessions = merchantAuth.table(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("merchant_auth_session_token_unique").on(table.token),
  ],
);

export const accounts = merchantAuth.table("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const verifications = merchantAuth.table("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const ownerProfiles = core.table("owner_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const businesses = core.table(
  "business",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    countryCode: text("country_code").notNull(),
    timezone: text("timezone").notNull(),
    brandPrimaryColor: text("brand_primary_color").notNull().default("#176548"),
    brandComplementaryColor: text("brand_complementary_color")
      .notNull()
      .default("#2D8B68"),
    brandAccentColor: text("brand_accent_color").notNull().default("#E78132"),
    logoObjectKey: text("logo_object_key"),
    /** Optimistic-lock revision for owner edits. */
    brandRevision: integer("brand_revision").notNull().default(1),
    /** Cache version for the currently published logo variants. */
    logoVersion: integer("logo_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "business_primary_color_check",
      sql`${table.brandPrimaryColor} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    check(
      "business_complementary_color_check",
      sql`${table.brandComplementaryColor} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    check(
      "business_accent_color_check",
      sql`${table.brandAccentColor} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    check("business_brand_revision_check", sql`${table.brandRevision} >= 1`),
    check("business_logo_version_check", sql`${table.logoVersion} >= 0`),
  ],
);

/** A short-lived, private object uploaded before the owner confirms Save. */
export const brandAssetUploads = core.table(
  "brand_asset_upload",
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
    uniqueIndex("core_brand_asset_upload_object_key_unique").on(
      table.objectKey,
    ),
  ],
);

/** Durable retry queue: failures cleaning obsolete private R2 prefixes never break a saved brand. */
export const brandAssetCleanups = core.table(
  "brand_asset_cleanup",
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
    uniqueIndex("core_brand_asset_cleanup_prefix_unique").on(
      table.objectPrefix,
    ),
  ],
);

export const memberships = core.table(
  "business_membership",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.businessId, table.userId] })],
);

export const locations = core.table("location", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  addressLabel: text("address_label").notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  countryCode: text("country_code").notNull(),
  activeVerificationId: uuid("active_verification_id"),
  addressSnapshot: jsonb("address_snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const locationVerifications = core.table("location_verification", {
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  provider: text("provider"),
  providerPlaceId: text("provider_place_id"),
  normalizedAddress: text("normalized_address").notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  countryCode: text("country_code").notNull(),
  providerSnapshot: jsonb("provider_snapshot").notNull(),
  attribution: text("attribution"),
  verifiedAt: timestamp("verified_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
});

export const subscriptions = core.table(
  "subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    plan: text("plan").notNull().default("free"),
    interval: text("interval"),
    status: text("status").notNull().default("active"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("core_subscription_customer_unique").on(table.stripeCustomerId),
    uniqueIndex("core_subscription_stripe_unique").on(
      table.stripeSubscriptionId,
    ),
  ],
);

export const stripeWebhookEvents = core.table("stripe_webhook_event", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  payloadVersion: text("payload_version").notNull(),
});

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
