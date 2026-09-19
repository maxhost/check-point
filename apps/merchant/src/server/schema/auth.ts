import { boolean, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { merchantAuth } from "./_schemas";

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
    /**
     * EL PERMISO DE ALTA (spec 0077 §1, ADR 0076 §2). Un INSTANTE, no un booleano: un
     * `timestamptz` codifica los dos topes de tiempo en un solo campo y hace que
     * «caducado» no necesite que nadie escriba nada (un booleano pediría un job).
     *
     * **El permiso NO VIAJA**: lo escribe el servidor al crear la cuenta
     * (`POST /api/merchant/auth/start`) y lo lee de esta misma fila. `input: false` en
     * `session.additionalFields` (`server/auth.ts`) lo hace no-seteable desde ninguna
     * entrada de la API.
     *
     * **Invariante del dato: MONOTONA HACIA ABAJO.** Se escribe una vez al crear la
     * sesión y después sólo puede adelantarse — el acortado usa `least(...)`, nunca una
     * asignación (`shortenOnboardingGrant` en `server/onboarding-grant.ts`).
     */
    onboardingGrantUntil: timestamp("onboarding_grant_until", {
      withTimezone: true,
    }),
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
