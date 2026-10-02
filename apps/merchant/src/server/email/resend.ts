import { EmailProviderError, type EmailChannel } from "./channel";

type ResendOptions = {
  apiKey: string;
  from: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

/**
 * Resend adapter over the plain HTTP API (no `resend` npm dependency): validate config in
 * the constructor, one `fetch` with an AbortController timeout, bearer auth, JSON body, and a
 * typed provider error on failure.
 */
export class ResendEmailChannel implements EmailChannel {
  constructor(private readonly options: ResendOptions) {
    if (!options.apiKey || !options.from)
      throw new EmailProviderError("resend", "configuration");
  }

  async sendEmail(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? 8_000,
    );
    try {
      const response = await (this.options.fetch ?? fetch)(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.options.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: this.options.from,
            to: input.to,
            subject: input.subject,
            html: input.html,
            text: input.text,
          }),
          signal: controller.signal,
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        id?: unknown;
        name?: unknown;
      } | null;
      if (!response.ok || typeof payload?.id !== "string") {
        // El código y estado ayudan a distinguir dominio no verificado, clave inválida
        // o límite del proveedor sin registrar destinatario, cuerpo ni credenciales.
        console.error("resend_email_rejected", {
          status: response.status,
          code: typeof payload?.name === "string" ? payload.name : null,
        });
        throw new EmailProviderError("resend", "rejected");
      }
      return { provider: "resend" as const, providerMessageId: payload.id };
    } catch (error) {
      if (error instanceof EmailProviderError) throw error;
      throw new EmailProviderError(
        "resend",
        error instanceof DOMException && error.name === "AbortError"
          ? "timeout"
          : "invalid_response",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
