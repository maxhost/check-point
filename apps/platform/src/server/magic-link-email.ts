/** Spec 0190 §D7 — el mail del link del panel de plataforma. */
export function adminMagicLinkEmail(url: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Tu enlace para entrar al panel de CheckPass Club";
  const text =
    `Entra al panel de plataforma con este enlace: ${url} ` +
    `Vence en 15 minutos y sirve una sola vez. ` +
    `Si no pediste entrar, ignora este mensaje.`;
  const html = `<!doctype html>
<html lang="es">
  <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 0; padding: 24px;">
    <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #666;">CheckPass Club · Plataforma</p>
    <h1 style="font-size: 20px; margin: 8px 0 16px;">Entra al panel</h1>
    <p style="margin: 0 0 16px;"><a href="${url}" style="display: inline-block; background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none;">Entrar</a></p>
    <p style="margin: 0 0 8px;">Vence en <strong>15 minutos</strong> y sirve una sola vez.</p>
    <p style="margin: 0; color: #666;">Si no pediste entrar, ignora este mensaje.</p>
  </body>
</html>`;
  return { subject, html, text };
}
