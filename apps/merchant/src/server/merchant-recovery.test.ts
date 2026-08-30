import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Step 1 (request a code). The `resetPassword` half lives in
// `merchant-recovery-reset.test.ts` to stay within the file-size budget.

// Queue of `db.execute` results, consumed in call order by the fake transaction.
const results: Array<{ rows: unknown[] }> = [];
const execute = vi.fn(async () => results.shift() ?? { rows: [] });
const requestPasswordResetEmailOTP = vi.fn(async () => ({ success: true }));
const resetPasswordEmailOTP = vi.fn(async () => ({ success: true }));

vi.mock("./db", () => ({
  withDbTransaction: async (work: (tx: unknown) => Promise<unknown>) =>
    work({ execute }),
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: { requestPasswordResetEmailOTP, resetPasswordEmailOTP },
  }),
}));

const { requestReset } = await import("./recovery/merchant-recovery");
const { MerchantRecoveryError, RATE_LIMITS } =
  await import("./recovery/internal");

const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });

/** Rate-limit counters as returned by the single counting query. */
function counts(emailHour = 0, emailDay = 0, ipHour = 0) {
  return {
    rows: [
      {
        email_hour: String(emailHour),
        email_day: String(emailDay),
        ip_hour: String(ipHour),
      },
    ],
  };
}
const LOCK = { rows: [] };
const INSERT = { rows: [] };
const FOUND = { rows: [{ id: "user_1" }] };
const NOT_FOUND = { rows: [] };

beforeEach(() => {
  results.length = 0;
  execute.mockClear();
  requestPasswordResetEmailOTP.mockClear();
  resetPasswordEmailOTP.mockClear();
  process.env.PASSWORD_RECOVERY_ENABLED = "true";
  process.env.EMAIL_PROVIDER = "console";
});

afterEach(() => {
  delete process.env.PASSWORD_RECOVERY_ENABLED;
  delete process.env.EMAIL_PROVIDER;
});

async function statusOf(run: () => Promise<unknown>) {
  try {
    await run();
    return null;
  } catch (error) {
    if (error instanceof MerchantRecoveryError)
      return { status: error.status, code: error.code };
    throw error;
  }
}

describe("requestReset — gate (spec 0046)", () => {
  it("answers 503 when the feature is off", async () => {
    delete process.env.PASSWORD_RECOVERY_ENABLED;
    expect(
      await statusOf(() => requestReset({ email: "a@b.co" }, { headers })),
    ).toMatchObject({ status: 503 });
    expect(execute).not.toHaveBeenCalled();
  });

  it("answers 503 when the gate is on but the provider is unconfigured", async () => {
    // Incomplete deploy: never pretend the code went out.
    process.env.EMAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    expect(
      await statusOf(() => requestReset({ email: "a@b.co" }, { headers })),
    ).toMatchObject({ status: 503 });
  });
});

describe("requestReset — enumeration resistance", () => {
  it("returns the same body for a known account and sends the code", async () => {
    results.push(LOCK, counts(), INSERT, FOUND);
    await expect(
      requestReset({ email: "Owner@Example.com" }, { headers }),
    ).resolves.toEqual({ ok: true });
    // Email is lowercased before it reaches better-auth.
    expect(requestPasswordResetEmailOTP).toHaveBeenCalledWith({
      body: { email: "owner@example.com" },
    });
  });

  it("returns the identical body for an unknown email and sends nothing", async () => {
    results.push(LOCK, counts(), INSERT, NOT_FOUND);
    await expect(
      requestReset({ email: "ghost@example.com" }, { headers }),
    ).resolves.toEqual({ ok: true });
    expect(requestPasswordResetEmailOTP).not.toHaveBeenCalled();
  });

  it("still answers ok when the email provider is down", async () => {
    // Otherwise the error itself would confirm the account exists.
    results.push(LOCK, counts(), INSERT, FOUND);
    requestPasswordResetEmailOTP.mockRejectedValueOnce(new Error("smtp down"));
    await expect(
      requestReset({ email: "owner@example.com" }, { headers }),
    ).resolves.toEqual({ ok: true });
  });

  it("records the attempt before deciding whether to send", async () => {
    results.push(LOCK, counts(), INSERT, NOT_FOUND);
    await requestReset({ email: "ghost@example.com" }, { headers });
    // lock, count, insert, lookup — the unknown email is rate-limited too.
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it("rejects a malformed email without touching the database", async () => {
    expect(
      await statusOf(() =>
        requestReset({ email: "not-an-email" }, { headers }),
      ),
    ).toMatchObject({ status: 400, code: "invalid_email" });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("requestReset — persistent rate limit", () => {
  it("blocks the 4th request for the same email within the hour", async () => {
    results.push(LOCK, counts(RATE_LIMITS.emailPerHour, 3, 0));
    expect(
      await statusOf(() => requestReset({ email: "a@b.co" }, { headers })),
    ).toMatchObject({ status: 429, code: "too_many_requests" });
    expect(requestPasswordResetEmailOTP).not.toHaveBeenCalled();
  });

  it("blocks past the daily cap even when the hourly one is clear", async () => {
    results.push(LOCK, counts(0, RATE_LIMITS.emailPerDay, 0));
    expect(
      await statusOf(() => requestReset({ email: "a@b.co" }, { headers })),
    ).toMatchObject({ status: 429 });
  });

  it("blocks a sweep from one IP across many emails", async () => {
    results.push(LOCK, counts(0, 0, RATE_LIMITS.ipPerHour));
    expect(
      await statusOf(() => requestReset({ email: "a@b.co" }, { headers })),
    ).toMatchObject({ status: 429 });
  });

  it("lets the request through just below every cap", async () => {
    results.push(
      LOCK,
      counts(
        RATE_LIMITS.emailPerHour - 1,
        RATE_LIMITS.emailPerDay - 1,
        RATE_LIMITS.ipPerHour - 1,
      ),
      INSERT,
      FOUND,
    );
    await expect(
      requestReset({ email: "a@b.co" }, { headers }),
    ).resolves.toEqual({ ok: true });
  });
});
