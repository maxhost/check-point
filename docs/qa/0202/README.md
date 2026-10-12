# QA UI 0202 — login del owner con código

2026-10-11, Node 24.20.0, Chromium local. Capturas de 390 × 844, revisadas visualmente:

- [Email claro](email-claro.png) y [email oscuro](email-oscuro.png).
- [Código claro](codigo-claro.png) y [código oscuro](codigo-oscuro.png).

Typecheck merchant (`tsc --noEmit -p .`), ESLint del paquete merchant y del e2e,
Prettier del paquete merchant y guardia UI: salida 0.

E2E: 10/10 (7 de `merchant-login-code.spec.ts` y 3 regresiones de
`onboarding-google-places.spec.ts`). Las rutas de pedido y verificación se simulan
con `page.route`. Se comprueban navegación de documento, atributos de autofill,
validación de seis números, reintento, bloqueo, cambio de email y reenvío con
campo limpio. Reporte local: `/private/tmp/0202-report/index.html`.

Prueba de navegador con API real y Docker local, cuenta sembrada
`owner-cafe@example.test`: pedido 200; `EMAIL_PROVIDER=console`, evento
`email_console` y asunto «Tu código de CheckPass Club: NNNNNN»; código leído del
log del servidor e ingresado en la pantalla; verificación 200; navegación a
`/backoffice`; `/api/onboarding/state` confirma `authenticated: true` después
de navegar. Sin base de producción ni envío real de correo.

Pendiente: QA del owner en la PWA instalada en iPhone, incluida la sugerencia
real del código del email sobre el teclado de iOS. Oscuro inspeccionado mediante
`data-theme="dark"`; el layout merchant conserva su tema claro por defecto.
