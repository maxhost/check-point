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
    // Wallet push channel (spec 0033). The single visible "Última novedad" slot of
    // the shared pass: `latestMessage` is the last notice text shown (e.g. "La
    // Gringa: +1 sello"); `messageUpdatedAt` is the "pass changed" tag backing the
    // Apple `Last-Modified`/`passesUpdatedSince`; `lastPushAt` is the base for the
    // per-consumer push cooldown (ADR 0037). None are ever serialized in a DTO.
    latestMessage: text("latest_message"),
    messageUpdatedAt: timestamp("message_updated_at", { withTimezone: true }),
    lastPushAt: timestamp("last_push_at", { withTimezone: true }),
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
 * unique on (consumer, provider) make pass emission create-or-reuse. `authTokenHash`
 * holds the sha256 of the Apple web-service `authenticationToken` (compared in spec
 * 0033; null for Google) — NEVER serialized in the clear.
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
    authTokenHash: text("auth_token_hash"),
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
    // Live balance per membership (spec 0030). A program of an enabled modality uses
    // exactly one of the two (Puntos → points_balance, Sellos → stamps_count). The
    // counter increments it atomically on each grant; the decrement/reset is the
    // future redemption feature, not this spec.
    pointsBalance: integer("points_balance").notNull().default(0),
    stampsCount: integer("stamps_count").notNull().default(0),
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

/**
 * PassKit device registration (spec 0033). Each iOS device that adds an Apple pass
 * registers a `device_library_id` + APNs `push_token` via the web service; the
 * worker sends the empty APNs push to each. Unique (device_library_id, wallet_pass_id)
 * makes the register endpoint an idempotent upsert. `pushToken` is a device secret —
 * NEVER serialized in a DTO. Rows cascade with the pass and are wiped on rotation.
 */
export const walletPushDevices = consumer.table(
  "wallet_push_device",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletPassId: uuid("wallet_pass_id")
      .notNull()
      .references(() => walletPasses.id, { onDelete: "cascade" }),
    deviceLibraryId: text("device_library_id").notNull(),
    pushToken: text("push_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("wallet_push_device_library_pass_unique").on(
      table.deviceLibraryId,
      table.walletPassId,
    ),
    index("wallet_push_device_pass_idx").on(table.walletPassId),
  ],
);

/**
 * Push outbox (ADR 0037). One row per notice. `class` sets priority (`transactional`
 * preempts and skips cooldown; `campaign` is deferred, respects the cooldown). The
 * `transactional` row is enqueued INSIDE `persistGrant`'s transaction (0030), so an
 * accredited order ⇔ its push row. The worker claims a row (`pending` → `sending`),
 * delivers it, and closes it (`sent`) or backs it off (`pending`, then `failed` after
 * N attempts). `not_before` gates when it may go out (default now); the worker never
 * sends earlier. No token/secret columns — the whole row is safe to serialize.
 */
export const walletPushQueue = consumer.table(
  "wallet_push_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id, { onDelete: "cascade" }),
    class: text("class").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("pending"),
    notBefore: timestamp("not_before", { withTimezone: true })
      .notNull()
      .defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    index("wallet_push_queue_status_not_before_idx").on(
      table.status,
      table.notBefore,
    ),
    index("wallet_push_queue_consumer_idx").on(table.consumerId),
    check(
      "wallet_push_queue_class_check",
      sql`${table.class} in ('transactional', 'campaign')`,
    ),
    check(
      "wallet_push_queue_status_check",
      sql`${table.status} in ('pending', 'sending', 'sent', 'failed')`,
    ),
  ],
);
