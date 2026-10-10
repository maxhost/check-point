import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { platformAuth } from "./_schemas";
import { businesses } from "./business";

/**
 * Spec 0190 §D1 (ADR 0135): la identidad del panel de plataforma (`admin.checkpass.club`).
 * Mismas columnas que `merchant_auth` (`./auth.ts`) porque las escribe el mismo better-auth,
 * pero en su propio esquema: una sesion de comercio no abre el panel ni al reves. Quien entra
 * lo decide la lista blanca `PLATFORM_ADMIN_EMAILS`, no estas tablas.
 */
export const platformUsers = platformAuth.table(
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
  (table) => [
    uniqueIndex("platform_auth_user_email_unique").on(table.email),
    check(
      "platform_auth_user_email_lowercase",
      sql`${table.email} = lower(${table.email})`,
    ),
  ],
);

export const platformSessions = platformAuth.table(
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
      .references(() => platformUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("platform_auth_session_token_unique").on(table.token),
  ],
);

export const platformAccounts = platformAuth.table("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => platformUsers.id, { onDelete: "cascade" }),
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

export const platformVerifications = platformAuth.table("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

/** Spec 0190 §D1: toda escritura del panel deja una fila (quien, que comercio, antes, despues). */
export const platformAuditLog = platformAuth.table(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminEmail: text("admin_email").notNull(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    beforeTrialEndsAt: timestamp("before_trial_ends_at", {
      withTimezone: true,
    }),
    afterTrialEndsAt: timestamp("after_trial_ends_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("platform_audit_log_business_created_idx").on(
      table.businessId,
      table.createdAt.desc(),
    ),
    check(
      "platform_audit_log_action_check",
      sql`${table.action} in ('trial_add_days', 'trial_set_date')`,
    ),
  ],
);
