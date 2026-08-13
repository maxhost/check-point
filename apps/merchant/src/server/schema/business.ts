import {
  check,
  integer,
  jsonb,
  numeric,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { users } from "./auth";

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
