import {
  OtpProviderError,
  otpMessage,
  type OtpChannel,
  type OtpDeliveryInput,
} from "./core";

type ClickSendOptions = {
  username: string;
  apiKey: string;
  from?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export class ClickSendOtpChannel implements OtpChannel {
  constructor(private readonly options: ClickSendOptions) {
    if (!options.username || !options.apiKey)
      throw new OtpProviderError("clicksend", "configuration");
  }

  async deliverOtp(input: OtpDeliveryInput) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? 8_000,
    );
    try {
      const response = await (this.options.fetch ?? fetch)(
        "https://rest.clicksend.com/v3/sms/send",
        {
          method: "POST",
          headers: {
            authorization: `Basic ${Buffer.from(`${this.options.username}:${this.options.apiKey}`).toString("base64")}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messages: [
              {
                source: "checkpass-club",
                ...(this.options.from ? { from: this.options.from } : {}),
                body: otpMessage(input.locale, input.code),
                to: input.phoneE164,
              },
            ],
          }),
          signal: controller.signal,
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        response_code?: unknown;
        data?: { messages?: Array<{ status?: unknown; message_id?: unknown }> };
      } | null;
      const message = payload?.data?.messages?.[0];
      if (
        !response.ok ||
        payload?.response_code !== "SUCCESS" ||
        message?.status !== "SUCCESS" ||
        typeof message.message_id !== "string"
      ) {
        throw new OtpProviderError("clicksend", "rejected");
      }
      return {
        provider: "clicksend" as const,
        providerMessageId: message.message_id,
        acceptedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof OtpProviderError) throw error;
      throw new OtpProviderError(
        "clicksend",
        error instanceof DOMException && error.name === "AbortError"
          ? "timeout"
          : "invalid_response",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
