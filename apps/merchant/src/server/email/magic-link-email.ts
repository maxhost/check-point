/**
 * Spec 0067 §2 — el mail del LINK MAGICO del owner. El canal (`emailChannelFromEnv`) vive en
 * `@mi-pasaporte/domain/server/email` desde la spec 0190; el texto es del comercio y queda aca.
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
    `Entra a tu negocio con este enlace: ${url} ` +
    `Vence en 15 minutos y sirve una sola vez. ` +
    `Si no pediste entrar, ignora este mensaje.`;
  const html = `<!doctype html>
<html lang="es">
  <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 0; padding: 24px;">
    <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #666;">CheckPass Club · Negocios</p>
    <h1 style="font-size: 20px; margin: 8px 0 16px;">Entra a tu negocio</h1>
    <p style="margin: 0 0 16px;">Toca el botón para entrar. No hace falta contraseña.</p>
    <p style="margin: 0 0 16px;"><a href="${url}" style="display: inline-block; background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none;">Entrar</a></p>
    <p style="margin: 0 0 8px;">Vence en <strong>15 minutos</strong> y sirve una sola vez.</p>
    <p style="margin: 0; color: #666;">Si no pediste entrar, ignora este mensaje.</p>
  </body>
</html>`;
  return { subject, html, text };
}
