import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db";
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
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    secret,
    baseURL,
    trustedOrigins: Array.from(new Set([baseURL, ...extraOrigins])),
  });
}
