import { describe, expect, it, vi } from "vitest";
import { ClickSendOtpChannel } from "./otp/clicksend";
import { TwilioOtpChannel } from "./otp/twilio";
import {
  decryptOtp,
  decideOtpVerification,
  encryptOtp,
  generateOtpCode,
  localeForCountry,
  otpHash,
  otpMessage,
  validateRecoveryPhone,
  verifyOtpHash,
} from "./otp/core";
import { otpChannelFromEnv } from "./otp/provider";
import { ConsoleOtpChannel } from "./otp/fake";

const input = {
  phoneE164: "+593987654321",
  countryIso: "EC",
  code: "123456",
  locale: "es" as const,
  purpose: "recover_account" as const,
};

describe("OTP core", () => {
  it("generates six digits and protects them with HMAC + AES-GCM", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
    const hash = otpHash(code, "hmac-secret");
    expect(verifyOtpHash(code, hash, "hmac-secret")).toBe(true);
    expect(verifyOtpHash("000000", hash, "hmac-secret")).toBe(false);
    const key = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptOtp(code, key);
    expect(encrypted).not.toContain(code);
    expect(decryptOtp(encrypted, key)).toBe(code);
  });
  it("applies correct, incorrect, lock and expiry transitions without DB", () => {
    const now = new Date("2026-08-17T00:00:00Z");
    const future = new Date(now.getTime() + 1000);
    expect(
      decideOtpVerification({
        status: "pending",
        attempts: 0,
        expiresAt: future,
        now,
        codeMatches: true,
      }),
    ).toMatchObject({ kind: "accept", status: "verified", purge: true });
    expect(
      decideOtpVerification({
        status: "pending",
        attempts: 0,
        expiresAt: future,
        now,
        codeMatches: false,
      }),
    ).toMatchObject({
      kind: "reject",
      status: "pending",
      attempts: 1,
      purge: false,
    });
    expect(
      decideOtpVerification({
        status: "pending",
        attempts: 1,
        expiresAt: future,
        now,
        codeMatches: false,
      }),
    ).toMatchObject({
      kind: "reject",
      status: "locked",
      attempts: 2,
      purge: true,
    });
    expect(
      decideOtpVerification({
        status: "pending",
        attempts: 0,
        expiresAt: now,
        now,
        codeMatches: true,
      }),
    ).toMatchObject({ kind: "reject", status: "expired", purge: true });
  });
  it("uses the closed allow-list, coherent prefixes, locales and link-free templates", () => {
    expect(validateRecoveryPhone("+5511999999999", "BR").locale).toBe("pt");
    expect(localeForCountry("US")).toBe("en");
    expect(localeForCountry("EC")).toBe("es");
    expect(() => validateRecoveryPhone("+597123456", "SR")).toThrow();
    expect(() => validateRecoveryPhone("+593987654321", "BR")).toThrow();
    for (const locale of ["es", "pt", "en"] as const) {
      expect(otpMessage(locale, "123456")).toContain("123456");
      expect(otpMessage(locale, "123456")).not.toMatch(/https?:\/\//);
    }
  });
});

describe("OTP providers", () => {
  it("never leaks OTP, phone or provider secrets through development logs", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      await new ConsoleOtpChannel().deliverOtp(input);
      const serialized = JSON.stringify(log.mock.calls);
      expect(serialized).not.toContain(input.code);
      expect(serialized).not.toContain(input.phoneE164);
      expect(serialized).not.toContain("hmac-secret");
      expect(serialized).not.toContain("apiKey");
    } finally {
      log.mockRestore();
    }
  });

  it("anchors ClickSend REST auth/body and accepts only individual SUCCESS", async () => {
    const fetchMock = vi.fn<
      (url: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(
          JSON.stringify({
            response_code: "SUCCESS",
            data: { messages: [{ status: "SUCCESS", message_id: "cs-1" }] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const channel = new ClickSendOtpChannel({
      username: "user",
      apiKey: "key",
      from: "CheckPass",
      fetch: fetchMock as typeof fetch,
    });
    await expect(channel.deliverOtp(input)).resolves.toMatchObject({
      provider: "clicksend",
      providerMessageId: "cs-1",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(url).toBe("https://rest.clicksend.com/v3/sms/send");
    expect(headers.authorization).toBe(
      `Basic ${Buffer.from("user:key").toString("base64")}`,
    );
    expect(JSON.parse(init!.body as string)).toEqual({
      messages: [
        {
          source: "checkpass-club",
          from: "CheckPass",
          body: otpMessage("es", "123456"),
          to: input.phoneE164,
        },
      ],
    });

    const blocked = new ClickSendOtpChannel({
      username: "u",
      apiKey: "k",
      fetch: (async () =>
        new Response(
          JSON.stringify({
            response_code: "SUCCESS",
            data: { messages: [{ status: "BLOCKED", message_id: "bad" }] },
          }),
          { status: 200 },
        )) as typeof fetch,
    });
    await expect(blocked.deliverOtp(input)).rejects.toMatchObject({
      provider: "clicksend",
      reason: "rejected",
    });
  });

  it("anchors Twilio classic Messages API form contract", async () => {
    const fetchMock = vi.fn<
      (url: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(JSON.stringify({ sid: "SM123", status: "queued" }), {
          status: 201,
        }),
    );
    const channel = new TwilioOtpChannel({
      accountSid: "AC123",
      authToken: "secret",
      from: "+15550000000",
      fetch: fetchMock as typeof fetch,
    });
    await expect(channel.deliverOtp(input)).resolves.toMatchObject({
      provider: "twilio",
      providerMessageId: "SM123",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(url).toBe(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
    );
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect((init!.body as URLSearchParams).get("Body")).toBe(
      otpMessage("es", "123456"),
    );
    expect((init!.body as URLSearchParams).get("From")).toBe("+15550000000");
    expect((init!.body as URLSearchParams).get("To")).toBe(input.phoneE164);
  });

  it("selects exactly one provider and rejects console in production", () => {
    expect(
      otpChannelFromEnv({
        NODE_ENV: "test",
        OTP_PROVIDER: "clicksend",
        CLICKSEND_USERNAME: "u",
        CLICKSEND_API_KEY: "k",
      } as NodeJS.ProcessEnv),
    ).toBeInstanceOf(ClickSendOtpChannel);
    expect(
      otpChannelFromEnv({
        NODE_ENV: "test",
        OTP_PROVIDER: "twilio",
        TWILIO_ACCOUNT_SID: "a",
        TWILIO_AUTH_TOKEN: "t",
        TWILIO_FROM: "f",
      } as NodeJS.ProcessEnv),
    ).toBeInstanceOf(TwilioOtpChannel);
    expect(() =>
      otpChannelFromEnv({
        OTP_PROVIDER: "console",
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv),
    ).toThrow();
  });
});
