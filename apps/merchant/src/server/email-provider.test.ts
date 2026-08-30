import { afterEach, describe, expect, it } from "vitest";
import { EmailProviderError, passwordResetEmail } from "./email/channel";
import { ConsoleEmailChannel, consoleEmailOutbox } from "./email/console";
import { emailChannelFromEnv } from "./email/provider";
import { ResendEmailChannel } from "./email/resend";

afterEach(() => {
  consoleEmailOutbox.length = 0;
});

describe("emailChannelFromEnv (spec 0046)", () => {
  it("defaults to Resend when EMAIL_PROVIDER is absent", () => {
    const channel = emailChannelFromEnv({
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "no-reply@checkpass.club",
    } as unknown as NodeJS.ProcessEnv);
    expect(channel).toBeInstanceOf(ResendEmailChannel);
  });

  it("fails loudly when Resend credentials are missing", () => {
    expect(() =>
      emailChannelFromEnv({
        EMAIL_PROVIDER: "resend",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(EmailProviderError);
    // A missing EMAIL_FROM is just as fatal as a missing key.
    expect(() =>
      emailChannelFromEnv({
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "re_test",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(EmailProviderError);
  });

  it("allows the console channel outside production", () => {
    const channel = emailChannelFromEnv({
      EMAIL_PROVIDER: "console",
      NODE_ENV: "test",
    } as unknown as NodeJS.ProcessEnv);
    expect(channel).toBeInstanceOf(ConsoleEmailChannel);
  });

  it("refuses the console channel in production", () => {
    // Selecting `console` in prod would silently swallow every recovery email.
    expect(() =>
      emailChannelFromEnv({
        EMAIL_PROVIDER: "console",
        NODE_ENV: "production",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(EmailProviderError);
  });

  it("rejects an unknown provider instead of falling back", () => {
    expect(() =>
      emailChannelFromEnv({
        EMAIL_PROVIDER: "sendgrid",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(EmailProviderError);
  });
});

describe("ResendEmailChannel", () => {
  const options = { apiKey: "re_test", from: "no-reply@checkpass.club" };

  it("posts the message and returns the provider id", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const channel = new ResendEmailChannel({
      ...options,
      fetch: (async (url: string, init: RequestInit) => {
        seen = { url, init };
        return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    const result = await channel.sendEmail({
      to: "owner@example.com",
      subject: "s",
      html: "<p>h</p>",
      text: "t",
    });
    expect(result).toEqual({ provider: "resend", providerMessageId: "msg_1" });
    const call = seen as unknown as { url: string; init: RequestInit };
    expect(call.url).toBe("https://api.resend.com/emails");
    expect((call.init.headers as Record<string, string>).authorization).toBe(
      "Bearer re_test",
    );
    expect(JSON.parse(call.init.body as string)).toMatchObject({
      from: "no-reply@checkpass.club",
      to: "owner@example.com",
    });
  });

  it("raises a typed error when Resend rejects the send", async () => {
    const channel = new ResendEmailChannel({
      ...options,
      fetch: (async () =>
        new Response(JSON.stringify({ message: "nope" }), {
          status: 422,
        })) as unknown as typeof fetch,
    });
    await expect(
      channel.sendEmail({ to: "a@b.co", subject: "s", html: "h", text: "t" }),
    ).rejects.toBeInstanceOf(EmailProviderError);
  });

  it("refuses to construct without credentials", () => {
    expect(() => new ResendEmailChannel({ apiKey: "", from: "" })).toThrow(
      EmailProviderError,
    );
  });
});

describe("passwordResetEmail", () => {
  it("carries the code, the expiry and the do-not-share warning", () => {
    const mail = passwordResetEmail("123456");
    expect(mail.text).toContain("123456");
    expect(mail.html).toContain("123456");
    expect(mail.text).toContain("10 minutos");
    expect(mail.text.toLowerCase()).toContain("no compartas");
    expect(mail.subject.length).toBeGreaterThan(0);
  });
});
