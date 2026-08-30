import { beforeAll, describe, expect, it } from "vitest";
import { getMerchantAuth } from "./auth";

/**
 * Regression guard for the reviewer's blocking finding on spec 0046.
 *
 * The `/api/auth/[...all]` catch-all mounts every better-auth endpoint, including the
 * emailOTP plugin's own recovery routes. Those skip the gate, the persistent rate
 * limit, the disabled-staff check and the audit trail that `/api/merchant/recovery/*`
 * enforces. They must stay closed over HTTP.
 *
 * The 404 comes from the router's `onRequest`, before any endpoint or database work,
 * so this needs no live database.
 */
const BASE = "http://localhost:3001";

const BLOCKED = [
  "/api/auth/email-otp/send-verification-otp",
  "/api/auth/email-otp/check-verification-otp",
  "/api/auth/email-otp/verify-email",
  "/api/auth/email-otp/request-password-reset",
  "/api/auth/email-otp/reset-password",
  "/api/auth/email-otp/request-email-change",
  "/api/auth/email-otp/change-email",
  "/api/auth/forget-password/email-otp",
  "/api/auth/sign-in/email-otp",
];

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET ??= "disabled-paths-secret-at-least-32-bytes";
  process.env.BETTER_AUTH_URL ??= `${BASE}/api/auth`;
  process.env.DATABASE_URL ??= "postgresql://user:pass@localhost/db";
});

describe("better-auth HTTP surface (spec 0046)", () => {
  it.each(BLOCKED)("answers 404 for %s", async (path) => {
    const response = await getMerchantAuth().handler(
      new Request(`${BASE}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "owner@example.com" }),
      }),
    );
    // Anything but 404 means the bypass is open again.
    expect(response.status).toBe(404);
  });

  it("keeps the password login endpoint reachable", async () => {
    // The guard must close the OTP bypass without breaking normal sign-in.
    const response = await getMerchantAuth().handler(
      new Request(`${BASE}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "owner@example.com", password: "x" }),
      }),
    );
    expect(response.status).not.toBe(404);
  });
});
