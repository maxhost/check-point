/**
 * Spec 0202 §D3 — el mail del CODIGO de login del owner (ADR 0137). Sin links: el codigo se
 * tipea en la misma pantalla donde se pidio, que es lo que deja entrar desde la PWA instalada
 * en iPhone. El codigo va tambien en el asunto para leerlo en la notificacion sin abrir el mail.
 */
export function loginCodeEmail(code: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Tu código de CheckPass Club: ${code}`;
  const text =
    `Tu código para entrar a tu negocio es ${code}. ` +
    `Vence en 10 minutos y sirve una sola vez. ` +
    `Si no pediste entrar, ignora este mensaje.`;
  const html = `<!doctype html>
<html lang="es">
  <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 0; padding: 24px;">
    <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #666;">CheckPass Club · Negocios</p>
    <h1 style="font-size: 20px; margin: 8px 0 16px;">Tu código para entrar</h1>
    <p style="margin: 0 0 16px; font-size: 32px; font-weight: 700; letter-spacing: 0.2em;">${code}</p>
    <p style="margin: 0 0 8px;">Vence en <strong>10 minutos</strong> y sirve una sola vez.</p>
    <p style="margin: 0; color: #666;">Si no pediste entrar, ignora este mensaje.</p>
  </body>
</html>`;
  return { subject, html, text };
}
