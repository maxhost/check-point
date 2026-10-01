import {
  OtpProviderError,
  otpMessage,
  type OtpChannel,
  type OtpDeliveryInput,
} from "./core";

type TwilioOptions = {
  accountSid: string;
  authToken: string;
  from: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};
const ACCEPTED = new Set([
  "accepted",
  "queued",
  "sending",
  "sent",
  "delivered",
]);

export class TwilioOtpChannel implements OtpChannel {
  constructor(private readonly options: TwilioOptions) {
    if (!options.accountSid || !options.authToken || !options.from)
      throw new OtpProviderError("twilio", "configuration");
  }
  async deliverOtp(input: OtpDeliveryInput) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? 8_000,
    );
    try {
      const body = new URLSearchParams({
        Body: otpMessage(input.locale, input.code),
        From: this.options.from,
        To: input.phoneE164,
      });
      const response = await (this.options.fetch ?? fetch)(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.options.accountSid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            authorization: `Basic ${Buffer.from(`${this.options.accountSid}:${this.options.authToken}`).toString("base64")}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          body,
          signal: controller.signal,
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        sid?: unknown;
        status?: unknown;
      } | null;
      if (
        !response.ok ||
        typeof payload?.sid !== "string" ||
        typeof payload.status !== "string" ||
        !ACCEPTED.has(payload.status)
      )
        throw new OtpProviderError("twilio", "rejected");
      return {
        provider: "twilio" as const,
        providerMessageId: payload.sid,
        acceptedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof OtpProviderError) throw error;
      throw new OtpProviderError(
        "twilio",
        error instanceof DOMException && error.name === "AbortError"
          ? "timeout"
          : "invalid_response",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
