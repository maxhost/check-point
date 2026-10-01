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
import { loyaltyPrograms } from "./loyalty";
import { locations } from "./business";

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
    // Opaque bearer token for the "Ver mis programas" magic-link (spec 0029).
    // Emitted at creation, distinct from `qrToken` so "que me escaneen" and
    // "ver mis programas" revoke independently (ADR 0033). base64url, PII-free,
    // ≥128 bits. Stored in the clear as the stable handle for `/c/[token]` but
    // NEVER serialized in a DTO.
    webViewToken: text("web_view_token").notNull(),
    // First launch in installed, standalone mode. A browser tab never sets this.
    homeLaunchedAt: timestamp("home_launched_at", { withTimezone: true }),
    // Wallet push channel (spec 0033). The single visible "Última novedad" slot of
    // the shared pass: `latestMessage` is the last notice text shown (e.g. "La
    // Gringa: +1 sello"); `messageUpdatedAt` is the "pass changed" tag backing the
    // Apple `Last-Modified`/`passesUpdatedSince`; `lastPushAt` is the base for the
    // per-consumer push cooldown (ADR 0037). None are ever serialized in a DTO.
    latestMessage: text("latest_message"),
    messageUpdatedAt: timestamp("message_updated_at", { withTimezone: true }),
    lastPushAt: timestamp("last_push_at", { withTimezone: true }),
    // Spec 0111 / ADR 0103 §7: the last time the consumer opened their account
    // (`/c/[token]` or `/wallet` with a session). Feeds the reminder's «cupon nuevo»
    // and «2 dias sin actividad». Written with a 15-minute guard, never in a DTO.
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
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
    uniqueIndex("consumer_account_web_view_token_unique").on(
      table.webViewToken,
    ),
  ],
);

/**
 * One wallet pass per (consumer, provider) — the identity pass of spec 0029.
 * `serialNumber` is stable (Apple `serialNumber` / Google object id); it and the
 * unique on (consumer, provider) make pass emission create-or-reuse. `authToken`
 * holds the STABLE Apple web-service `authenticationToken` (spec 0033 correction):
 * minted once per pass in `ensureWalletPass` and reused on every emission + serve,
 * so the value stored always matches the token embedded in the installed pass. It
 * is a bearer credential — NEVER serialized in a DTO (see `walletPassResponse`).
 * `authTokenHash` is DEPRECATED: the old per-emission sha256 (kept nullable only
 * for backward-compat with legacy rows that predate `authToken`); not written on
 * new passes and only read as an authorize fallback until a legacy pass migrates.
 */
export const walletPasses = consumer.table(
  "wallet_pass",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    serialNumber: text("serial_number").notNull(),
    // Stable Apple web-service authenticationToken (see table comment). Nullable:
    // legacy rows carry only `authTokenHash`; backfilled lazily by ensureWalletPass.
    authToken: text("auth_token"),
    // DEPRECATED — legacy per-emission sha256; read-only authorize fallback.
    authTokenHash: text("auth_token_hash"),
    // Spec 0107 / ADR 0099: Google's signed `save` callback landed (the pass is INSTALLED,
    // not just generated). Google only; written once by `wallet/google-callback.ts`.
    googleSavedAt: timestamp("google_saved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("wallet_pass_serial_number_unique").on(table.serialNumber),
    uniqueIndex("wallet_pass_consumer_provider_unique").on(
      table.consumerId,
      table.provider,
    ),
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
    // Local where the self-service enrollment originated (ADR 0042, spec 0041). Captured
    // from the `?loc=` of the brand-kit poster QR and validated against the program's
    // business at enroll time; a foreign/invalid loc lands as null (the alta never breaks).
    // `set null` mirrors `order.location_id` so deleting a local never loses the alta.
    // Set only on FIRST enroll — a re-alta (idempotent 409) never overwrites it.
    originLocationId: uuid("origin_location_id").references(
      () => locations.id,
      {
        onDelete: "set null",
      },
    ),
    // Live balance per membership (spec 0030). A program of an enabled modality uses
    // exactly one of the two (Puntos → points_balance, Sellos → stamps_count). The
    // counter increments it atomically on each grant; the decrement/reset is the
    // future redemption feature, not this spec.
    pointsBalance: integer("points_balance").notNull().default(0),
    stampsCount: integer("stamps_count").notNull().default(0),
    // Marketing opt-out per business (spec 0065). Null = promotions ON (scanning is
    // enrollment + consent, ADR 0033 §2). ONLY the consumer portal writes it (ADR 0060:
    // a discriminant of intent no other actor may set). It removes the consumer from
    // campaign audiences; the transactional lane and the utility bag stay untouched.
    marketingOptOutAt: timestamp("marketing_opt_out_at", {
      withTimezone: true,
    }),
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
    // Additive index for the future per-local attribution report (ADR 0042).
    index("consumer_program_membership_origin_location_idx").on(
      table.originLocationId,
    ),
    check(
      "consumer_program_membership_points_balance_check",
      sql`${table.pointsBalance} >= 0`,
    ),
    check(
      "consumer_program_membership_stamps_count_check",
      sql`${table.stampsCount} >= 0`,
    ),
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

// Recovery OTP tables (spec 0032) live in ./otp to keep this file within the
// file-size budget (same split pattern as ./web-push). Re-exported by the barrel.

// The PassKit devices and the push outbox live in ./wallet-push (size budget, spec 0107).
