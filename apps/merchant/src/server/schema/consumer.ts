import { index, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { consumer } from "./_schemas";
import { loyaltyPrograms } from "./loyalty";

/**
 * Platform-level consumer identity (spec 0028). The phone is the identity key
 * but stays UNVERIFIED in this spec (`phoneVerifiedAt` always null); OTP
 * verification is deferred to spec 0032. `qrToken` is an opaque, unguessable,
 * PII-free bearer identifier emitted at creation — it is stored in the clear as
 * the stable handle for spec 0029 but NEVER serialized in a DTO.
 */
export const consumerAccounts = consumer.table(
  "consumer_account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phoneE164: text("phone_e164").notNull(),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    // Country selected in the enroll form (ISO-2). Analytics metadata, not the
    // identity key (the phone is) — nullable and never cross-checked vs. phone.
    countryIso: text("country_iso"),
    qrToken: text("qr_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("consumer_account_phone_unique").on(table.phoneE164),
    uniqueIndex("consumer_account_qr_token_unique").on(table.qrToken),
  ],
);

/**
 * Membership of one consumer in one program. Aisled per business via the
 * denormalized `businessId` (analytics scoping). Unique (consumer, program)
 * makes reenrollment idempotent and backs the `already_member` 409 (23505).
 */
export const programMemberships = consumer.table(
  "program_membership",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id, { onDelete: "cascade" }),
    programId: uuid("program_id")
      .notNull()
      .references(() => loyaltyPrograms.id),
    businessId: uuid("business_id").notNull(),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("consumer_program_membership_unique").on(
      table.consumerId,
      table.programId,
    ),
    index("consumer_program_membership_business_idx").on(table.businessId),
  ],
);

/** Opaque bearer session (30 days). The raw token lives in an HttpOnly cookie; the DB keeps only its sha256 hash. */
export const consumerSessions = consumer.table(
  "consumer_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("consumer_session_token_hash_unique").on(table.tokenHash),
  ],
);

/**
 * Append-only log for the per-phone rate limit. Each `POST /enroll` counts the
 * rows for the same phone in the trailing hour; ≥3 → 429. No FK to the account
 * (the phone may not exist yet as an account). Pruning is deferred.
 */
export const enrollAttempts = consumer.table(
  "enroll_attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phoneE164: text("phone_e164").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("consumer_enroll_attempt_phone_idx").on(
      table.phoneE164,
      table.createdAt,
    ),
  ],
);
