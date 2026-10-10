// Channel-agnostic email delivery (ADR 0045 / spec 0046). Salen los mails de LINK MAGICO del
// owner del comercio y del admin de plataforma (spec 0190 lo mudo aca desde el merchant), por el
// adapter que resuelve `emailChannelFromEnv()`: el contrato de abajo es la costura que deja
// cambiar de proveedor (Resend hoy, otro mañana) sin tocar al que lo llama.

export interface EmailChannel {
  sendEmail(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ provider: string; providerMessageId: string }>;
}

/** Typed provider failure, mirrors `OtpProviderError` of the SMS side (spec 0032). */
export class EmailProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly reason:
      "configuration" | "timeout" | "rejected" | "invalid_response",
  ) {
    super(`Email provider ${provider} failed: ${reason}`);
    this.name = "EmailProviderError";
  }
}
