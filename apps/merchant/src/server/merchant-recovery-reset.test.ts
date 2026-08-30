import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Split out of `merchant-recovery.test.ts`, which hit the 300-line budget:
// divide, do not extend. This half covers step 2 (redeem the code).

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

const { resetPassword } = await import("./recovery/merchant-recovery");
const { MerchantRecoveryError } = await import("./recovery/internal");

const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });

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

describe("resetPassword", () => {
  it("changes the password for a recoverable user", async () => {
    results.push(FOUND, INSERT);
    await expect(
      resetPassword(
        { email: "owner@example.com", otp: "123456", password: "supersecret" },
        { headers },
      ),
    ).resolves.toEqual({ ok: true });
    expect(resetPasswordEmailOTP).toHaveBeenCalledWith({
      body: {
        email: "owner@example.com",
        otp: "123456",
        password: "supersecret",
      },
    });
  });

  it("gives the same generic error for an unknown user and a wrong code", async () => {
    results.push(NOT_FOUND, INSERT);
    const unknown = await statusOf(() =>
      resetPassword(
        { email: "ghost@example.com", otp: "123456", password: "supersecret" },
        { headers },
      ),
    );
    expect(unknown).toMatchObject({ status: 400, code: "invalid_or_expired" });
    // A disabled staff member never reaches better-auth.
    expect(resetPasswordEmailOTP).not.toHaveBeenCalled();

    results.push(FOUND, INSERT);
    resetPasswordEmailOTP.mockRejectedValueOnce(
      Object.assign(new Error("Invalid OTP"), {
        body: { code: "INVALID_OTP" },
      }),
    );
    const wrongCode = await statusOf(() =>
      resetPassword(
        { email: "owner@example.com", otp: "999999", password: "supersecret" },
        { headers },
      ),
    );
    expect(wrongCode).toEqual(unknown);
  });

  it("maps an expired code onto the same generic error", async () => {
    results.push(FOUND, INSERT);
    resetPasswordEmailOTP.mockRejectedValueOnce(
      Object.assign(new Error("OTP expired"), {
        body: { code: "OTP_EXPIRED" },
      }),
    );
    expect(
      await statusOf(() =>
        resetPassword(
          {
            email: "owner@example.com",
            otp: "123456",
            password: "supersecret",
          },
          { headers },
        ),
      ),
    ).toMatchObject({ code: "invalid_or_expired" });
  });

  it("reports a blocked code distinctly so the user asks for a new one", async () => {
    results.push(FOUND, INSERT);
    resetPasswordEmailOTP.mockRejectedValueOnce(
      Object.assign(new Error("Too many attempts"), {
        body: { code: "TOO_MANY_ATTEMPTS" },
      }),
    );
    expect(
      await statusOf(() =>
        resetPassword(
          {
            email: "owner@example.com",
            otp: "123456",
            password: "supersecret",
          },
          { headers },
        ),
      ),
    ).toMatchObject({ status: 400, code: "otp_blocked" });
  });

  it("rejects a short password before the code is consumed", async () => {
    expect(
      await statusOf(() =>
        resetPassword(
          { email: "owner@example.com", otp: "123456", password: "short" },
          { headers },
        ),
      ),
    ).toMatchObject({ status: 400, code: "password_too_short" });
    expect(resetPasswordEmailOTP).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric code generically", async () => {
    expect(
      await statusOf(() =>
        resetPassword(
          { email: "owner@example.com", otp: "abc", password: "supersecret" },
          { headers },
        ),
      ),
    ).toMatchObject({ code: "invalid_or_expired" });
  });

  it("answers 503 when the feature is off", async () => {
    delete process.env.PASSWORD_RECOVERY_ENABLED;
    expect(
      await statusOf(() =>
        resetPassword(
          {
            email: "owner@example.com",
            otp: "123456",
            password: "supersecret",
          },
          { headers },
        ),
      ),
    ).toMatchObject({ status: 503 });
  });
});
