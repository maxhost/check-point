import {
  boolean,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

export const businesses = core.table("business", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  countryCode: text("country_code").notNull(),
  logoObjectKey: text("logo_object_key"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
    status: text("status").notNull().default("inactive"),
    activeVersionId: uuid("active_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("core_loyalty_program_business_unique").on(table.businessId),
  ],
);

export const loyaltyProgramVersions = core.table("loyalty_program_version", {
  id: uuid("id").primaryKey(),
  programId: uuid("program_id")
    .notNull()
    .references(() => loyaltyPrograms.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  schemaVersion: text("schema_version").notNull().default("1"),
  configuration: jsonb("configuration").notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  earningEndsAt: timestamp("earning_ends_at", { withTimezone: true }),
  redemptionEndsAt: timestamp("redemption_ends_at", { withTimezone: true }),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const loyaltyProgramTransitions = core.table(
  "loyalty_program_transition",
  {
    id: uuid("id").primaryKey(),
    programId: uuid("program_id")
      .notNull()
      .references(() => loyaltyPrograms.id, { onDelete: "cascade" }),
    fromVersionId: uuid("from_version_id")
      .notNull()
      .references(() => loyaltyProgramVersions.id),
    toVersionId: uuid("to_version_id").references(
      () => loyaltyProgramVersions.id,
    ),
    earningEndsAt: timestamp("earning_ends_at", {
      withTimezone: true,
    }).notNull(),
    redemptionEndsAt: timestamp("redemption_ends_at", {
      withTimezone: true,
    }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const termsTemplates = core.table("terms_template", {
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
});

export const loyaltyTermsVersions = core.table(
  "loyalty_terms_version",
  {
    id: uuid("id").primaryKey(),
    programVersionId: uuid("program_version_id")
      .notNull()
      .references(() => loyaltyProgramVersions.id, { onDelete: "cascade" }),
    renderedMarkdown: text("rendered_markdown").notNull(),
    contentHash: text("content_hash").notNull(),
    acceptanceRequired: boolean("acceptance_required").notNull().default(true),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("core_loyalty_terms_program_version_unique").on(
      table.programVersionId,
    ),
  ],
);

export const loyaltyTermsClauses = core.table("loyalty_terms_clause", {
  id: uuid("id").primaryKey(),
  termsVersionId: uuid("terms_version_id")
    .notNull()
    .references(() => loyaltyTermsVersions.id, { onDelete: "cascade" }),
  position: text("position").notNull(),
  sourceTemplateId: uuid("source_template_id").references(
    () => termsTemplates.id,
  ),
  sourceTemplateVersion: text("source_template_version"),
  renderedClause: text("rendered_clause").notNull(),
  editedByOwner: boolean("edited_by_owner").notNull().default(false),
});
