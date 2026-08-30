import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { getDb } from "./db";
import { passwordResetEmail } from "./email/channel";
import { emailChannelFromEnv } from "./email/provider";
import * as schema from "./schema";

export function getMerchantAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL) {
    throw new Error(
      "Better Auth requiere BETTER_AUTH_SECRET y BETTER_AUTH_URL válidos.",
    );
  }
  // Trusted origins = the base URL plus any extra origins from env (comma-separated).
  // Lets a custom domain (checkpass.club), its www, and Vercel preview URLs be trusted
  // without a redeploy. Backward compatible: with no env set it is just [baseURL].
  // better-auth accepts wildcards, e.g. `https://*.vercel.app`.
  const extraOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // The emailOTP reset path revokes sessions ONLY when this flag is on — verified
      // in better-auth 1.6.26 (`plugins/email-otp/routes.mjs`, resetPasswordEmailOTP).
      // A recovered account must kill every session opened with the old password.
      revokeSessionsOnPasswordReset: true,
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 3,
        // Recovery is the only OTP surface for merchant users: an unknown email must
        // never bootstrap an account through `/sign-in/email-otp` (spec 0046 excludes
        // auto-registro).
        disableSignUp: true,
        sendVerificationOTP: async ({ email, otp, type }) => {
          // Other OTP types are unreachable by design; never deliver a code for them.
          if (type !== "forget-password") return;
          const { subject, html, text } = passwordResetEmail(otp);
          await emailChannelFromEnv().sendEmail({
            to: email,
            subject,
            html,
            text,
          });
        },
      }),
    ],
    // The `/api/auth/[...all]` catch-all would otherwise publish every emailOTP
    // endpoint, and those bypass our gate, persistent rate limit, disabled-staff
    // check and audit trail — a locked door next to an open wall. Recovery must go
    // through `/api/merchant/recovery/*` only.
    //
    // Enforced by the HTTP router's `onRequest` (better-auth 1.6.26,
    // `dist/api/index.mjs`: disabled paths answer 404), which does NOT affect the
    // server-side `auth.api.*` calls our own routes make.
    disabledPaths: [
      "/email-otp/send-verification-otp",
      "/email-otp/check-verification-otp",
      "/email-otp/verify-email",
      "/email-otp/request-password-reset",
      "/email-otp/reset-password",
      "/email-otp/request-email-change",
      "/email-otp/change-email",
      "/forget-password/email-otp",
      "/sign-in/email-otp",
    ],
    secret,
    baseURL,
    trustedOrigins: Array.from(new Set([baseURL, ...extraOrigins])),
  });
}
