---
spec: 0046
fecha: 2026-08-30
estado: cerrada
resumen: Recuperación de contraseña de owner y staff por OTP de 6 dígitos al email (Resend, intercambiable), usando el plugin emailOTP de better-auth para OTP y set de contraseña; resistente a enumeración, con rate-limit persistente y gate por env. Consumidor (SMS, 0032) intacto.
disjunta: si
archivos: server/auth.ts, server/email/** (nuevo), server/recovery/merchant-recovery.ts (nuevo), server/schema/merchant-recovery.ts (nuevo), migración, app/api/merchant/recovery/** (nuevo), app/forgot-password (nuevo UI), .env.example, tests
---

# 0046 — Recuperación de owner/staff por OTP al email

> **Nada de código empieza sin esta spec en `cerrada`.** Cierra las decisiones para que el
> implementador no invente durante el código. Consume el **ADR 0045**.

## Problema

Owner y staff se autentican con email + contraseña (better-auth). **Hoy no tienen ningún
mecanismo de recuperación**: `auth.ts` no configura olvido de contraseña. Un owner que
olvida su clave queda sin acceso al backoffice, sin salida por producto. El OTP existente
(spec 0032) recupera **consumidores por SMS** y está casado con el teléfono: no sirve para
owner/staff, que se identifican por email.

## Alcance

**Entra:**
- Recuperación de contraseña por **OTP de 6 dígitos al email** para **owner y staff** (ambos
  son `merchant_auth.user`).
- Proveedor de email **Resend**, detrás de un contrato `EmailChannel` intercambiable por env.
- Página pública `/forgot-password` (pedir código) + verificación (código + contraseña nueva).
- Resistencia a enumeración, rate-limit persistente (por email y por IP), gate por env,
  revocación de sesiones al resetear.

**No entra:**
- Recuperación del **consumidor** (spec 0032, SMS) — se mantiene intacta y aislada.
- **SMS para owner/staff.** El contrato de entrega queda agnóstico de canal (costura para el
  futuro), pero el adaptador SMS para usuarios del comercio **no se construye** en esta spec.
- Login por magic-link, 2FA/MFA, cambio de email, o recuperación de cuentas deshabilitadas.
- Auto-registro: `/forgot-password` no crea cuentas.

## Diseño

Flujo passwordless-reset por OTP, con el OTP y el set de contraseña delegados en el plugin
`emailOTP` de **better-auth** (ADR 0045, decisión 2), y la entrega delegada en un
`EmailChannel` intercambiable (Resend activo).

```
/forgot-password (público)
  Paso 1: ingresa email
    └─ POST /api/merchant/recovery/request
         → rate-limit persistente (email + IP); si excede → 429 genérico
         → si el email existe y el usuario está habilitado:
              better-auth emailOTP.sendVerificationOTP({ email, type: "forget-password" })
              → callback sendVerificationOTP → EmailChannel.sendEmail(Resend) con el código
         → SIEMPRE responde 200 genérico ("si existe una cuenta, te llegó un código")
  Paso 2: ingresa código de 6 dígitos + contraseña nueva
    └─ POST /api/merchant/recovery/reset
         → better-auth emailOTP.resetPassword({ email, otp, password })
              (better-auth valida el OTP, aplica el hashing y persiste la contraseña)
         → al éxito: revoca TODAS las sesiones del usuario; 200 → redirect a /login
         → OTP inválido/vencido → 400 genérico; intentos agotados → 400 "código bloqueado"
```

### Especificación técnica

**Mecanismo (better-auth `emailOTP`).** Se agrega el plugin `emailOTP` a `getMerchantAuth()`
en `server/auth.ts`, configurado: `otpLength: 6`, `expiresIn: 600` (10 min), `allowedAttempts:
3`, y `sendVerificationOTP({ email, otp, type })` que, **solo** para `type === "forget-password"`,
envía el email vía `emailChannelFromEnv()`. El reset se hace con el método de reset por OTP del
plugin (`resetPassword`/`checkVerificationOTP` según la versión).

> **El implementador DEBE verificar la API del plugin contra la versión instalada** leyendo
> `node_modules/better-auth` (import path, firma de `sendVerificationOTP`, nombre exacto del
> método de reset y si expone revocación de sesiones). El `AGENTS.md` de merchant es explícito:
> este better-auth puede diferir del de training; no asumir de memoria. Si el plugin no revoca
> sesiones por sí mismo, revocarlas explícitamente tras el reset.

**Contrato de email (intercambiable).**
```ts
export interface EmailChannel {
  sendEmail(input: {
    to: string; subject: string; html: string; text: string;
  }): Promise<{ provider: string; providerMessageId: string }>;
}
```
- `ResendEmailChannel` (adaptador Resend, usa `RESEND_API_KEY` + `EMAIL_FROM`).
- `ConsoleEmailChannel` (dev/test: loguea el código, no envía; prohibido en `production`).
- `emailChannelFromEnv(env)`: `EMAIL_PROVIDER` (default `resend`); `console` solo si
  `NODE_ENV !== "production"`. Config faltante → error de configuración (no silencioso).
- Plantilla del email: asunto y cuerpo en español, incluye el código, aviso de expiración
  (10 min) y "no compartas". Mismo tono que `otpMessage` del consumidor.

**Autorización / audiencia.**
- Aplica a cualquier `merchant_auth.user` con cuenta de contraseña (`account.providerId =
  'credential'`). Owner y staff por igual.
- **Staff deshabilitado** (`business_membership.status = 'disabled'`) **no recupera**: el
  request no envía email (pero responde 200 genérico igual, por enumeración). El reset de un
  usuario cuyo único membership está deshabilitado se rechaza genérico.

**Resistencia a enumeración.**
- `/request` responde **siempre** `200 { ok: true }` con el mismo cuerpo y timing similar,
  exista o no el email. El email solo sale si la cuenta existe y está habilitada.
- `/reset` con email inexistente u OTP incorrecto responde el **mismo** 400 genérico
  (`invalid_or_expired`). No distinguir "email no existe" de "código malo".

**Rate-limit persistente + auditoría (tabla nueva `merchant_auth.password_reset_attempt`).**
- Registra cada solicitud aceptada: `email` (lowercased), `ip_hash`, `kind` (`request` |
  `reset_ok` | `reset_fail`), `created_at`.
- Límites por email: **3 por hora** y **5 por día** (cuenta filas `request` en la ventana).
  Por IP: cap defensivo (p.ej. **10/h**) para frenar barridos. Excedido → `429` genérico.
- Sobrevive reinicios (es DB, no memoria). Sirve además de log de auditoría append-only.

**Gate por env.** `PASSWORD_RECOVERY_ENABLED` (análogo a `RECOVERY_ENABLED` del consumidor):
si no es `true`, `/forgot-password` y ambas rutas responden **503** (oscuro a propósito). Sin
`RESEND_API_KEY`/`EMAIL_FROM` con el gate encendido → 503 (configuración incompleta), logueado.

**Secretos (todos server-only, NUNCA `NEXT_PUBLIC`):** `PASSWORD_RECOVERY_ENABLED`,
`EMAIL_PROVIDER` (default `resend`), `RESEND_API_KEY`, `EMAIL_FROM` (remitente verificado en
Resend, p.ej. `no-reply@checkpass.club`). Documentar en `.env.example`.

**Contraseña nueva.** `minPasswordLength: 8` (igual que el signup actual). La aplica
better-auth; no se toca `account.password` a mano. Al éxito, revocar todas las sesiones →
el usuario re-loguea con la clave nueva en todos los dispositivos.

**Estados de interfaz (móvil-first, reusa `panel`/`button`/`input` como el resto).**
- Paso 1: input email + "Enviarme un código". Al responder → pasa al paso 2 con mensaje
  genérico ("Si hay una cuenta con ese email, te enviamos un código").
- Paso 2: input código (6 dígitos, `inputmode="numeric"`) + contraseña nueva + confirmar →
  "Cambiar contraseña". Éxito → redirect `/login` con aviso. Errores genéricos, sin filtrar
  existencia. Link "Volver a intentar" respeta el cooldown.
- `/login` linkea a `/forgot-password` ("¿Olvidaste tu contraseña?").

**Idempotencia / concurrencia.** El plugin maneja el ciclo de vida del OTP en
`verification`. El rate-limit usa la tabla nueva; un `pg_advisory_xact_lock` por email en
`/request` evita doble-envío en ráfaga (mismo patrón que el consumidor).

**Observabilidad.** Contadores de `request`/`reset_ok`/`reset_fail` (misma tabla). Sin PII en
logs: nunca loguear el OTP ni la contraseña; el email va hasheado en `ip_hash`… (el email en
claro solo en la tabla, no en logs).

### Arquitectura de referencia

- **ADR 0045** — recovery de owner/staff por OTP al email, canal intercambiable (Resend),
  set de contraseña delegado en better-auth.
- **ADR 0013** — OTP con transporte intercambiable (lo que este ADR enmienda para email).
- better-auth (`emailAndPassword` ya activo en `server/auth.ts`).

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/auth.ts` | editar — agregar plugin `emailOTP` + `sendVerificationOTP` → `EmailChannel` |
| `apps/merchant/src/server/email/channel.ts` | crear — contrato `EmailChannel` + plantilla |
| `apps/merchant/src/server/email/resend.ts` | crear — adaptador Resend |
| `apps/merchant/src/server/email/console.ts` | crear — canal consola (dev/test) |
| `apps/merchant/src/server/email/provider.ts` | crear — `emailChannelFromEnv` |
| `apps/merchant/src/server/recovery/merchant-recovery.ts` | crear — orquestación request/reset + rate-limit + enumeración |
| `apps/merchant/src/server/schema/merchant-recovery.ts` | crear — tabla `password_reset_attempt` |
| `apps/merchant/src/server/schema.ts` | editar — re-exportar la tabla nueva |
| `apps/merchant/drizzle/0027_*.sql` (+ `meta`) | crear — migración de la tabla |
| `apps/merchant/src/app/api/merchant/recovery/request/route.ts` | crear |
| `apps/merchant/src/app/api/merchant/recovery/reset/route.ts` | crear |
| `apps/merchant/src/app/forgot-password/page.tsx` | crear — UI (2 pasos) |
| `apps/merchant/src/app/forgot-password/forgot-form.tsx` | crear — form cliente |
| `apps/merchant/src/app/login/**` | editar — link "¿Olvidaste tu contraseña?" |
| `.env.example` | editar — secretos nuevos documentados |
| `apps/merchant/src/server/email-provider.test.ts` | crear — unit del selector + adaptador |
| `apps/merchant/src/server/merchant-recovery.test.ts` | crear — unit rate-limit + enumeración |
| `apps/merchant/src/server/merchant-recovery.neon.integration.test.ts` | crear — integración Neon (request→reset→sesión revocada) |

### Disjunta?

**Sí.** La única otra spec abierta es **0031** (vista de programas del consumidor), que toca
`(consumer)/**` y `push/subscriptions.ts` — cero solape con `merchant_auth`, `auth.ts` y el
flujo de email. `auth.ts` ya fue tocado por el fix de dominio (`11c5f26`, ya commiteado, no es
una spec abierta). Puede implementarse en paralelo sin colisión de archivos.

## Criterios de aceptación (verificables)

- [ ] Con `PASSWORD_RECOVERY_ENABLED=true` + Resend configurado: pedir código en
  `/forgot-password` con un email de owner existente entrega un email con OTP de 6 dígitos.
- [ ] Ingresar el OTP + contraseña nueva válida cambia la contraseña; el owner loguea con la
  nueva y **las sesiones previas quedan revocadas** (verificable en integración Neon).
- [ ] Email inexistente en `/request` responde **200 genérico** y **no** envía email
  (enumeración). Mismo cuerpo/timing que un email existente.
- [ ] OTP incorrecto/vencido y email inexistente en `/reset` responden el **mismo** 400
  genérico. Tras `allowedAttempts` fallidos, el código queda bloqueado.
- [ ] Rate-limit: 4ª solicitud del mismo email dentro de la hora → **429**; persiste tras
  reiniciar el proceso (tabla, no memoria). Cap por IP frena barridos.
- [ ] Con `PASSWORD_RECOVERY_ENABLED` ausente/false: `/forgot-password` y ambas rutas → **503**.
- [ ] `RESEND_API_KEY` no aparece en el bundle del cliente (no es `NEXT_PUBLIC`); grep del
  build lo confirma. El OTP y la contraseña nunca se loguean.
- [ ] Staff deshabilitado no recibe email ni puede resetear (respuesta genérica igual).
- [ ] El flujo del **consumidor** (0032, SMS) no se tocó: sus tests siguen verdes.

## Pruebas

- **Unit:** `email-provider.test.ts` (selección por env, error de config, console prohibido en
  prod). `merchant-recovery.test.ts` (rate-limit por email/IP con ventanas, respuesta genérica
  ante email inexistente, gate 503).
- **Integración Neon (rama efímera):** `merchant-recovery.neon.integration.test.ts` — crear
  user, `/request`, leer el OTP de test vía `ConsoleEmailChannel` inyectado, `/reset`, afirmar
  contraseña cambiada + sesiones revocadas + fila de auditoría. Idempotencia y límites contra
  DB real.
- **Verificación en vivo (owner, tras PASS del revisor):** cargar secretos en Vercel, pedir
  reset del propio email, recibir el OTP en Resend, cambiar la clave, re-loguear.

## Notas de operación (owner, no bloquean el código)

- Alta de dominio remitente en **Resend** (verificar `checkpass.club` o usar el sandbox de
  Resend para desarrollo) → `EMAIL_FROM=no-reply@checkpass.club`. Resend free tier alcanza
  para desarrollo.
- Cargar en Vercel (Production): `PASSWORD_RECOVERY_ENABLED=true`, `EMAIL_PROVIDER=resend`,
  `RESEND_API_KEY`, `EMAIL_FROM`. Sin esto el flujo responde 503 a propósito.
- La migración `0027` se aplica a prod **después** del PASS del revisor, con el patrón Neon
  del `CLAUDE.md` (`DATABASE_URL_UNPOOLED=... db:migrate`), verificando por MCP que
  `merchant_auth`/`core`/`consumer` quedan intactos.
