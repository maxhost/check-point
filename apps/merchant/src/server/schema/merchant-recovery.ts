import { check, index, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { merchantAuth } from "./_schemas";

/**
 * Append-only ledger of owner/staff password-recovery attempts (spec 0046).
 *
 * Doubles as the persistent rate-limit source and the audit trail: because the
 * limits are counted from this table rather than from process memory, they survive
 * restarts and hold across serverless instances. Lives in `merchant_auth`, next to
 * the better-auth tables it protects.
 *
 * Never holds the OTP nor the password — only who asked, from where (hashed), and
 * how it ended.
 */
export const passwordResetAttempts = merchantAuth.table(
  "password_reset_attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Lowercased. In clear here (it is the limit key) but never written to logs. */
    email: text("email").notNull(),
    /** SHA-256 of the client IP; null when no hop exposed one. */
    ipHash: text("ip_hash"),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("password_reset_attempt_email_created_idx").on(
      table.email,
      table.createdAt,
    ),
    index("password_reset_attempt_ip_created_idx").on(
      table.ipHash,
      table.createdAt,
    ),
    check(
      "password_reset_attempt_kind_check",
      sql`${table.kind} in ('request', 'reset_ok', 'reset_fail')`,
    ),
  ],
);
