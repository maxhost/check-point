---
adr: 0045
fecha: 2026-08-30
estado: aceptada
resumen: Owner y staff recuperan acceso con un OTP de 6 dígitos al email (no SMS), porque el email ya es su identidad en better-auth. El OTP y el set de contraseña los posee el plugin emailOTP de better-auth; Resend es el proveedor de email activo detrás de un contrato EmailChannel intercambiable. Enmienda el 0013 (que solo contemplaba OTP por SMS para el consumidor).
---

# 0045 — Recovery de owner/staff por OTP al email

> Enmienda del **ADR 0013** (OTP con transporte intercambiable, SMS-only para el
> consumidor). No lo reemplaza: el flujo del consumidor sigue igual. Este ADR agrega una
> **audiencia nueva** (usuarios del comercio: owner y staff) sobre un **canal nuevo**
> (email).

## Contexto

- El OTP existente (ADR 0013 + spec 0032) recupera **cuentas de consumidor** por **SMS**:
  la identidad es el teléfono E.164, el schema (`consumer.otp_challenge`/`otp_delivery`),
  la validación y los mensajes están todos casados con el teléfono. El transporte
  intercambiable es solo **entre proveedores de SMS** (ClickSend ↔ Twilio).
- El **owner y el staff** del comercio son un sistema distinto: se autentican con
  **email + contraseña** vía better-auth (`emailAndPassword`, `merchant_auth.user`). Su
  identidad ya es el email, y ese email ya está on-file y es único
  (`merchant_auth_user_email_unique`).
- **Hoy owner/staff no tienen NINGÚN recovery.** `auth.ts` no configura
  `sendResetPassword` ni ningún flujo de olvido de contraseña. Un owner que olvida la clave
  queda afuera sin salida. Es un hueco real, no una mejora cosmética.
- El owner pidió un recovery por email para owner/staff, **production-grade**, con el canal
  **intercambiable a futuro** ("email y SMS que yo pueda cambiar más adelante"), y fijó
  **Resend** (no SendGrid) como proveedor de email.

## Decisión

1. **Owner y staff recuperan acceso con un OTP de 6 dígitos enviado al email**, no por SMS.
   El email es su identidad y está on-file; el SMS para usuarios del comercio queda **fuera
   de alcance** (no tenemos teléfono verificado de owner/staff). El contrato de entrega se
   deja **agnóstico de canal** para no cerrar la puerta a SMS más adelante, pero SMS no se
   construye ahora (YAGNI: se deja la costura, no la implementación).

2. **El OTP y el seteo de la contraseña los posee `better-auth` (plugin `emailOTP`), no
   código propio.** Escribir a mano en `merchant_auth.account.password` es frágil y está
   acoplado a la versión (el `AGENTS.md` de merchant advierte que este better-auth es una
   build modificada). El plugin `emailOTP` da semántica de OTP nativa (generación,
   almacenamiento en `merchant_auth.verification`, expiración, intentos) y un
   `resetPassword` que aplica el hashing correcto y revoca sesiones. Delegarlo elimina toda
   una clase de bugs de seguridad.
   - **Corolario:** este flujo **NO reutiliza** `server/otp/core.ts`. Ese núcleo se diseñó
     para el dominio teléfono/consumidor y su tabla de rate-limit es phone-keyed; forzar
     email en un schema con forma de teléfono sería peor que delegar en el plugin. El core
     del consumidor queda intacto y aislado.

3. **Resend es el proveedor de email activo, detrás de un contrato `EmailChannel`
   intercambiable** (mismo patrón que el `OtpChannel` de SMS del 0013). El callback
   `sendVerificationOTP` de better-auth **no** llama a Resend directo: llama al
   `EmailChannel` resuelto por `emailChannelFromEnv()` (`EMAIL_PROVIDER=resend` por
   defecto). Ahí vive el "cambiar más adelante": agregar otro proveedor de email es un
   adaptador nuevo, sin tocar el flujo.

4. **Sobre la seguridad del plugin ponemos las mismas garantías que el flujo del
   consumidor:** endpoint de solicitud **resistente a enumeración** (siempre responde
   genérico; el email sale solo si el usuario existe y está activo), **rate-limit
   persistente** por email y por IP (sobrevive reinicios, tabla en `merchant_auth`), gate
   por env (`PASSWORD_RECOVERY_ENABLED`; apagado → 503, oscuro a propósito) y **revocación
   de todas las sesiones** al resetear.

## Alternativas descartadas

- **Rodar OTP propio reusando `otp/core.ts` + escribir la contraseña a mano.** Da control
  total pero obliga a re-implementar el hashing de better-auth y la revocación de sesiones
  contra una build modificada del lib — exactamente la clase de código frágil que el
  `AGENTS.md` de merchant advierte. El riesgo de seguridad no compensa el control.
- **Reset por link/token de better-auth (`sendResetPassword`).** Es lo built-in más simple,
  pero el owner pidió **OTP** (código de 6 dígitos), consistente con el patrón del
  consumidor, y un link revela por email si la cuenta existe. Descartado por UX + enumeración.
- **Extender el OTP del consumidor (spec 0032) para incluir email.** El consumidor se
  identifica por teléfono y no tiene email on-file; mezclar audiencias en el mismo
  schema/flow rompe el aislamiento. Se mantienen separados.
- **SendGrid.** Reemplazado por Resend por decisión del owner.

## Consecuencias

- Aparece una dependencia nueva (`resend`) y el plugin `emailOTP` de better-auth. El
  implementador **debe verificar la API del plugin contra la versión instalada** (import,
  firma de `sendVerificationOTP`, nombres de `forgetPassword`/`resetPassword`) leyendo
  `node_modules/better-auth` — no asumir de memoria (regla del `AGENTS.md`).
- El OTP de owner/staff vive en `merchant_auth.verification` (ya existe); solo hace falta
  una tabla nueva chica para el rate-limit/auditoría persistente.
- Secretos nuevos server-only (`RESEND_API_KEY`, `EMAIL_FROM`, `PASSWORD_RECOVERY_ENABLED`,
  `EMAIL_PROVIDER`). `RESEND_API_KEY` **nunca** `NEXT_PUBLIC`.
- El detalle implementable (rutas, estados, límites, migración, tests) va en la **spec
  0046**.
