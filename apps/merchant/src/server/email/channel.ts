// Channel-agnostic email delivery (ADR 0045 / spec 0046). The password-recovery flow
// sends the OTP through whatever adapter `emailChannelFromEnv()` resolves; the contract
// below is the seam that lets us swap providers (Resend today, another tomorrow) without
// touching better-auth's `sendVerificationOTP` callback.

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
 * Spanish OTP email for password recovery. Includes the 6-digit code, the 10-minute
 * expiry notice and a "no compartas" warning — same tone as `otpMessage` (SMS side).
 */
export function passwordResetEmail(code: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Tu código para recuperar la contraseña";
  const text =
    `Tu código de CheckPass Club es ${code}. ` +
    `Vence en 10 minutos. No compartas este código con nadie. ` +
    `Si no pediste recuperar tu contraseña, ignorá este mensaje.`;
  const html = `<!doctype html>
<html lang="es">
  <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 0; padding: 24px;">
    <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #666;">CheckPass Club · Negocios</p>
    <h1 style="font-size: 20px; margin: 8px 0 16px;">Recuperar tu contraseña</h1>
    <p style="margin: 0 0 16px;">Usá este código para cambiar tu contraseña:</p>
    <p style="font-size: 32px; font-weight: 700; letter-spacing: 0.2em; margin: 0 0 16px;">${code}</p>
    <p style="margin: 0 0 8px;">Vence en <strong>10 minutos</strong>. No compartas este código con nadie.</p>
    <p style="margin: 0; color: #666;">Si no pediste recuperar tu contraseña, ignorá este mensaje.</p>
  </body>
</html>`;
  return { subject, html, text };
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
