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

/** Passwordless recovery challenge (spec 0032). OTPs are never stored in clear. */
export const otpChallenges = consumer.table(
  "otp_challenge",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phoneE164: text("phone_e164").notNull(),
    countryIso: text("country_iso").notNull(),
    purpose: text("purpose").notNull().default("recover_account"),
    codeHash: text("code_hash"),
    codeCiphertext: text("code_ciphertext"),
    encryptionKeyVersion: text("encryption_key_version")
      .notNull()
      .default("v1"),
    status: text("status").notNull().default("pending"),
    verificationAttempts: integer("verification_attempts").notNull().default(0),
    deliveryCount: integer("delivery_count").notNull().default(0),
    resendAvailableAt: timestamp("resend_available_at", {
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    onboardingTokenHash: text("onboarding_token_hash"),
    onboardingExpiresAt: timestamp("onboarding_expires_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("otp_challenge_phone_created_idx").on(
      table.phoneE164,
      table.createdAt,
    ),
    uniqueIndex("otp_challenge_one_pending_phone_unique")
      .on(table.phoneE164)
      .where(sql`${table.status} = 'pending'`),
    check(
      "otp_challenge_purpose_check",
      sql`${table.purpose} = 'recover_account'`,
    ),
    check(
      "otp_challenge_status_check",
      sql`${table.status} in ('pending', 'verified', 'consumed', 'locked', 'expired', 'invalidated')`,
    ),
    check(
      "otp_challenge_verification_attempts_check",
      sql`${table.verificationAttempts} between 0 and 2`,
    ),
    check(
      "otp_challenge_delivery_count_check",
      sql`${table.deliveryCount} between 0 and 2`,
    ),
  ],
);

/** Append-only accepted-SMS log and persistent recovery rate-limit source. */
export const otpDeliveries = consumer.table(
  "otp_delivery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => otpChallenges.id, { onDelete: "cascade" }),
    phoneE164: text("phone_e164").notNull(),
    clientRequestId: text("client_request_id").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("sending"),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id"),
    locale: text("locale").notNull(),
    reservedAt: timestamp("reserved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("otp_delivery_phone_reserved_idx").on(
      table.phoneE164,
      table.reservedAt,
    ),
    // Idempotency reserves a request key ONLY while its delivery is live or
    // succeeded. A `failed` delivery releases the key so an explicit retry after a
    // provider failure creates a fresh challenge instead of replaying a dead one.
    uniqueIndex("otp_delivery_phone_client_request_unique")
      .on(table.phoneE164, table.clientRequestId)
      .where(sql`${table.status} in ('sending', 'accepted', 'unknown')`),
    // Same rule for the "one resend per challenge" guard: a failed resend does not
    // burn the single resend allowance (that is governed by delivery_count, which
    // only advances on success), so it can be retried.
    uniqueIndex("otp_delivery_challenge_kind_unique")
      .on(table.challengeId, table.kind)
      .where(sql`${table.status} in ('sending', 'accepted', 'unknown')`),
    check(
      "otp_delivery_kind_check",
      sql`${table.kind} in ('initial', 'resend')`,
    ),
    check(
      "otp_delivery_status_check",
      sql`${table.status} in ('sending', 'accepted', 'failed', 'unknown')`,
    ),
    check(
      "otp_delivery_provider_check",
      sql`${table.provider} in ('clicksend', 'twilio')`,
    ),
    check(
      "otp_delivery_locale_check",
      sql`${table.locale} in ('es', 'pt', 'en')`,
    ),
  ],
);
