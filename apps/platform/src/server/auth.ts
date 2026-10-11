import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { getDb } from "@mi-pasaporte/db";
import {
  platformAccounts,
  platformSessions,
  platformUsers,
  platformVerifications,
} from "@mi-pasaporte/db/schema";
import { emailChannelFromEnv } from "@mi-pasaporte/domain/server/email/provider";
import { adminMagicLinkEmail } from "./magic-link-email";

/**
 * Spec 0190 §D2 (ADR 0135 §1): la identidad del panel, con su secreto, sus tablas
 * (`platform_auth`) y su cookie. Nada se comparte con `merchant_auth`.
 *
 * No se monta el catch-all `/api/auth/[...all]`: sin el, ningun endpoint del plugin es
 * alcanzable por HTTP y las unicas puertas son nuestras rutas (`api/auth/*`), que llaman a
 * `auth.api.*`. `disableSignUp: false` porque el primer login de un correo de la lista crea su
 * `user`; la lista se mira ANTES de pedir el link (`api/auth/start`) y en cada request
 * (`admin-guard.ts`).
 */
export function getPlatformAuth() {
  const secret = process.env.PLATFORM_AUTH_SECRET;
  const baseURL = process.env.PLATFORM_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL) {
    throw new Error(
      "El panel requiere PLATFORM_AUTH_SECRET (32+) y PLATFORM_AUTH_URL.",
    );
  }
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: platformUsers,
        session: platformSessions,
        account: platformAccounts,
        verification: platformVerifications,
      },
    }),
    plugins: [
      magicLink({
        expiresIn: 900,
        disableSignUp: false,
        sendMagicLink: async ({ email, token }) => {
          const url = new URL("/api/auth/magic-link", baseURL);
          url.searchParams.set("token", token);
          const { subject, html, text } = adminMagicLinkEmail(url.toString());
          await emailChannelFromEnv().sendEmail({
            to: email,
            subject,
            html,
            text,
          });
        },
      }),
    ],
    secret,
    baseURL,
    trustedOrigins: [baseURL],
  });
}
