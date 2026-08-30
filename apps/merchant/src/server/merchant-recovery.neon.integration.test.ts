import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs only against an ephemeral Neon branch, never prod (same guard as the consumer
// recovery integration files).
const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled && url) process.env.DATABASE_URL = url;

process.env.PASSWORD_RECOVERY_ENABLED = "true";
process.env.EMAIL_PROVIDER = "console";
process.env.BETTER_AUTH_SECRET ??= "integration-better-auth-secret-32-bytes!";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001";

const { getMerchantAuth } = await import("./auth");
const { getDb } = await import("./db");
const { consoleEmailOutbox } = await import("./email/console");
const { requestReset, resetPassword } =
  await import("./recovery/merchant-recovery");
const { passwordResetAttempts, sessions, users } = await import("./schema");

const suffix = Math.floor(Math.random() * 1_000_000);
const email = `spec0046.owner.${suffix}@example.com`;
const oldPassword = "old-password-123";
const newPassword = "brand-new-password-456";
const headers = new Headers({
  "x-forwarded-for": `198.51.100.${suffix % 250}`,
});

/** The OTP only exists in the email body; read it the way the owner would. */
function lastOtp(): string {
  const mail = consoleEmailOutbox.at(-1);
  const match = mail?.text.match(/\b(\d{6})\b/);
  if (!match) throw new Error("no OTP in the last email");
  return match[1];
}

async function userId(): Promise<string> {
  const db = getDb();
  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!row[0]) throw new Error("user not found");
  return row[0].id;
}

describe.skipIf(!enabled)(
  "merchant password recovery against Neon (spec 0046)",
  () => {
    beforeAll(async () => {
      await getMerchantAuth().api.signUpEmail({
        body: { email, password: oldPassword, name: `Owner ${suffix}` },
      });
      consoleEmailOutbox.length = 0;
    });

    afterAll(async () => {
      const db = getDb();
      const id = await userId().catch(() => null);
      if (id) await db.delete(users).where(eq(users.id, id));
      await db
        .delete(passwordResetAttempts)
        .where(eq(passwordResetAttempts.email, email));
    });

    it("delivers a 6-digit code and audits the request", async () => {
      await expect(requestReset({ email }, { headers })).resolves.toEqual({
        ok: true,
      });
      expect(consoleEmailOutbox.at(-1)?.to).toBe(email);
      expect(lastOtp()).toMatch(/^\d{6}$/);

      const rows = await getDb()
        .select()
        .from(passwordResetAttempts)
        .where(
          and(
            eq(passwordResetAttempts.email, email),
            eq(passwordResetAttempts.kind, "request"),
          ),
        );
      expect(rows).toHaveLength(1);
      // The audit row never carries the code, and the IP is hashed.
      expect(rows[0]?.ipHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("sends nothing for an unknown email but answers identically", async () => {
      const before = consoleEmailOutbox.length;
      await expect(
        requestReset(
          { email: `ghost.${suffix}@example.com` },
          { headers: new Headers() },
        ),
      ).resolves.toEqual({ ok: true });
      expect(consoleEmailOutbox.length).toBe(before);
    });

    it("rejects a wrong code without consuming the valid one", async () => {
      const otp = lastOtp();
      await expect(
        resetPassword(
          {
            email,
            otp: otp === "000000" ? "111111" : "000000",
            password: newPassword,
          },
          { headers },
        ),
      ).rejects.toMatchObject({ code: "invalid_or_expired" });
      // The real code still works afterwards (checked by the next test).
      expect(otp).toMatch(/^\d{6}$/);
    });

    it("changes the password and revokes every previous session", async () => {
      const id = await userId();
      // Open a session with the OLD password; it must not survive the reset.
      await getMerchantAuth().api.signInEmail({
        body: { email, password: oldPassword },
      });
      const before = await getDb()
        .select({ n: sql<string>`count(*)` })
        .from(sessions)
        .where(eq(sessions.userId, id));
      expect(Number(before[0]?.n ?? 0)).toBeGreaterThan(0);

      await expect(
        resetPassword(
          { email, otp: lastOtp(), password: newPassword },
          { headers },
        ),
      ).resolves.toEqual({ ok: true });

      const after = await getDb()
        .select({ n: sql<string>`count(*)` })
        .from(sessions)
        .where(eq(sessions.userId, id));
      expect(Number(after[0]?.n ?? 0)).toBe(0);

      // The new password works and the old one does not.
      await expect(
        getMerchantAuth().api.signInEmail({
          body: { email, password: newPassword },
        }),
      ).resolves.toBeTruthy();
      await expect(
        getMerchantAuth().api.signInEmail({
          body: { email, password: oldPassword },
        }),
      ).rejects.toBeTruthy();

      const ok = await getDb()
        .select()
        .from(passwordResetAttempts)
        .where(
          and(
            eq(passwordResetAttempts.email, email),
            eq(passwordResetAttempts.kind, "reset_ok"),
          ),
        );
      expect(ok).toHaveLength(1);
    });

    it("enforces the hourly cap from the database", async () => {
      // One `request` row already exists; the cap is 3 per hour.
      await requestReset({ email }, { headers });
      await requestReset({ email }, { headers });
      await expect(requestReset({ email }, { headers })).rejects.toMatchObject({
        status: 429,
        code: "too_many_requests",
      });
    });
  },
);
