// Channel-agnostic email delivery (ADR 0045 / spec 0046). El unico mail que sale hoy es el
// del LINK MAGICO del owner, y sale por el adapter que resuelve `emailChannelFromEnv()`: el
// contrato de abajo es la costura que deja cambiar de proveedor (Resend hoy, otro mañana)
// sin tocar al que lo llama.

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
      | "configuration"
      | "timeout"
      | "rejected"
      | "invalid_response",
  ) {
    super(`Email provider ${provider} failed: ${reason}`);
    this.name = "EmailProviderError";
  }
}

/**
 * Spec 0067 §2 — el mail del LINK MAGICO del owner. Mismo canal que ya existe
 * (`emailChannelFromEnv`): esta spec no agrega un proveedor nuevo.
 *
 * `url` apunta a `GET /api/merchant/auth/magic-link?token=…`, ruta PROPIA, y no al
 * endpoint del plugin: los dos que publica estan en `disabledPaths` (`server/auth.ts`).
 * El link abre sesion y, de paso, marca el email como verificado — better-auth 1.6.26
 * pone `emailVerified: true` al consumir el token (`plugins/magic-link/index.mjs`), que
 * es exactamente la prueba de control del buzon que pide el gate de la §3.
 */
export function magicLinkEmail(url: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Tu enlace para entrar a CheckPass Club";
  const text =
    `Entrá a tu negocio con este enlace: ${url} ` +
    `Vence en 15 minutos y sirve una sola vez. ` +
    `Si no pediste entrar, ignorá este mensaje.`;
  const html = `<!doctype html>
<html lang="es">
  <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 0; padding: 24px;">
    <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #666;">CheckPass Club · Negocios</p>
    <h1 style="font-size: 20px; margin: 8px 0 16px;">Entrá a tu negocio</h1>
    <p style="margin: 0 0 16px;">Tocá el botón para entrar. No hace falta contraseña.</p>
    <p style="margin: 0 0 16px;"><a href="${url}" style="display: inline-block; background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none;">Entrar</a></p>
    <p style="margin: 0 0 8px;">Vence en <strong>15 minutos</strong> y sirve una sola vez.</p>
    <p style="margin: 0; color: #666;">Si no pediste entrar, ignorá este mensaje.</p>
  </body>
</html>`;
  return { subject, html, text };
}
