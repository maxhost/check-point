---
spec: 0202
fecha: 2026-10-11
estado: implementada; en PROD `3fe2ad6` (2026-10-11); QA del owner en iPhone pendiente
resumen: El owner entra al panel con un codigo de 6 digitos por email (vence en 10 min, 5 intentos por codigo, 10 fallidos por dia por email) en vez de link magico, para poder entrar desde la PWA instalada en iPhone. Solo el login; alta y verificacion siguen con link.
disjunta: si
archivos: apps/merchant/src/server/auth.ts, apps/merchant/src/server/email/login-code-email.ts, apps/merchant/src/server/merchant-login.ts, apps/merchant/src/app/api/merchant/auth/login/route.ts, apps/merchant/src/app/api/merchant/auth/login/verify/route.ts, apps/merchant/src/app/api/merchant/auth/magic-link/route.ts, tests de esas rutas; UI (GPT): onboarding/_components/account-step.tsx y onboarding/_lib/onboarding-api.ts
---

# 0202 — Login del owner con codigo

> Nivel **L2** (login: piso L2, CLAUDE.md §Niveles). Decision: **ADR 0137**. Zona Claude: API + servidor. La
> pantalla es de GPT con el contrato de la §D4.

## Problema

- `POST /api/merchant/auth/login` manda un **link magico** (`apps/merchant/src/app/api/merchant/auth/login/route.ts:31`,
  `signInMagicLink` con `callbackURL: "/backoffice"`). En iPhone el link abre Safari o Mail, que no comparten cookies
  con la PWA instalada (#86, `adb723c`): **el owner no puede entrar a la app instalada**.
- El plugin `emailOTP` no existe en la instancia (spec 0068 §4, `apps/merchant/src/server/auth.ts:38-42`).

## Alcance

**Entra:**
- `POST /api/merchant/auth/login` manda un **codigo** en vez de un link (mismo contrato de respuesta).
- Ruta nueva `POST /api/merchant/auth/login/verify` que canjea email + codigo por la sesion.
- El email del codigo.
- Plugin `emailOTP` en la instancia con sus 9 rutas HTTP en `disabledPaths`.
- El corte de negocio `closed` y el destino (panel / alta) compartidos entre el link y el codigo.

**No entra:**
- El alta (`onboarding/signup`, email conocido → link) y `verify-email`: siguen con link (ADR 0137 §2).
- El staff (usuario + PIN): no cambia.
- Volver a la pagina de origen despues del login (hoy siempre `/backoffice`): fuera.
- Limite por IP sobre los intentos de verificacion (ver Declarado AFUERA).

## Diseño

### D1 — Instancia (`server/auth.ts`)

Sumar `emailOTP({ otpLength: 6, expiresIn: 600, allowedAttempts: 5, storeOTP: "hashed", disableSignUp: true,
sendVerificationOTP })`. `sendVerificationOTP({ email, otp, type })` solo atiende `type === "sign-in"` (cualquier
otro tipo tira `Error`: nadie lo emite, y si alguien lo emite tiene que fallar ruidoso) y manda el email de la D3 por
`emailChannelFromEnv()`.

`disabledPaths` suma los **9** paths del plugin, medidos en `better-auth@1.7.6/dist/plugins/email-otp/index.mjs`:
`/email-otp/send-verification-otp`, `/email-otp/check-verification-otp`, `/email-otp/verify-email`,
`/sign-in/email-otp`, `/email-otp/request-password-reset`, `/email-otp/reset-password`, `/forget-password/email-otp`,
`/email-otp/request-email-change`, `/email-otp/change-email`.

### D2 — Pedir el codigo: `POST /api/merchant/auth/login`

Igual que hoy (cuerpo `{ email }`, `normalizeEmail`, `assertStartWithinLimits`, `recordStartAttempt`, nunca revela si
la cuenta existe, `isUndeliverableEmail` no manda nada). Cambia la rama del email conocido:

- `auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } })`.
- Un solo codigo vivo: lo garantiza better-auth 1.7.6, que consume la fila MAS NUEVA del email y borra las demas
  (`dist/db/internal-adapter.mjs`, `consumeVerificationValue`). *Corregido en la implementacion:* la spec pedia
  borrar a mano las filas previas; la mutacion M2 sobrevivio y la lectura del adapter mostro que ese borrado
  sobraba, asi que se saco. El caso «pedir dos veces» queda como oraculo de la conducta de better-auth.

Respuestas: `200 { accepted: true }` · `400 invalid_body | invalid_email` · `429 rate_limited` · `503
auth_unavailable` (mensaje: «No pudimos enviar el código. Intenta de nuevo.»).

### D3 — El email (`server/email/login-code-email.ts`)

- Asunto: `Tu código de CheckPass Club: 123456` (el codigo en el asunto se lee en la notificacion sin abrir el mail).
- Cuerpo: el codigo grande, «Vence en 10 minutos y sirve una sola vez.», «Si no pediste entrar, ignora este
  mensaje.» Sin links. Version `text` equivalente.
- `magic-link-email.ts` se queda (alta y verificacion).

### D4 — Canjear el codigo: `POST /api/merchant/auth/login/verify`

Cuerpo `{ email: string, code: string }`.

1. `normalizeEmail(email)`; `code` tiene que ser exactamente `/^\d{6}$/` despues de `trim()`.
2. **Tope de fallidos (owner 2026-10-11):** si el email tiene **10 o mas** filas en `merchant_auth.verification` con
   `identifier = 'login-code-failure-' || email` y `expires_at > now()` → `429 too_many_failures`, **sin llamar al
   plugin** (tampoco un codigo correcto entra). Cada respuesta `code_incorrect` inserta una de esas filas con
   `expires_at = now() + interval '24 hours'` (ventana movil de 24 h). Se usa la tabla generica de verificaciones con
   un prefijo propio para no necesitar migracion; el prefijo no choca con los de better-auth (`sign-in-otp-`, tokens
   del link). Con esto el maximo es 10 intentos por dia por cuenta: 3.650 por año sobre 10⁶ (0,37 %).
3. `auth.api.signInEmailOTP({ body: { email, otp: code }, headers, asResponse: true })`.
4. Con 200 y `set-cookie`: mismo corte que el link — negocio `closed` → borrar las sesiones del usuario y responder
   403; sin negocio → destino `/es/business/onboarding`; si no → `/backoffice`. Esa logica (`verifiedUserId`,
   `businessStatus`) se mueve de `magic-link/route.ts` a `server/merchant-login.ts` y la usan las dos rutas.

Respuestas (JSON; la cookie viaja en el 200):

| Status | `code` | Cuando | Mensaje |
|---|---|---|---|
| 200 | — | entro; cuerpo `{ destination }` | — |
| 400 | `invalid_body` | cuerpo no JSON | «El cuerpo no es válido.» |
| 400 | `invalid_email` | email con forma invalida | «Ingresa un email válido.» |
| 400 | `invalid_code` | el codigo no son 6 digitos | «El código tiene 6 números.» |
| 400 | `code_incorrect` | codigo equivocado, o no hay codigo para ese email (plugin `INVALID_OTP`) | «El código no es correcto.» |
| 400 | `code_expired` | vencido (`OTP_EXPIRED`) o 5 intentos gastados (`TOO_MANY_ATTEMPTS`, 403 del plugin) | «El código venció. Pedí uno nuevo.» |
| 429 | `too_many_failures` | 10 codigos equivocados para ese email en las ultimas 24 h | «Demasiados intentos. Probá de nuevo mañana.» |
| 403 | `business_closed` | negocio cerrado; sesion revocada | «Este negocio está cerrado.» |
| 503 | `auth_unavailable` | cualquier otro error | «No pudimos verificar el código. Intenta de nuevo.» |

El mapeo del error del plugin se hace por su `code` (`EMAIL_OTP_ERROR_CODES` de better-auth), no por el texto.

**Para la UI (GPT):** despues de un 200 de la D2, la pantalla pasa a «Te mandamos un código a {email}»: un campo de
6 digitos con `inputMode="numeric"` y `autoComplete="one-time-code"`, boton «Entrar», «Reenviar código» (vuelve a
llamar a la D2) y «Usar otro email». Con 200 de la D4: `window.location.assign(destination)`. `code_expired` muestra
el mensaje y deja reenviar; `too_many_failures` muestra el mensaje y no deja reenviar. Hoy el paso es `MagicLinkState` en `account-step.tsx`; la funcion nueva en
`onboarding-api.ts` es `verifyMerchantLoginCode(email, code)`.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/auth.ts` | editar (D1) |
| `apps/merchant/src/server/email/login-code-email.ts` | crear (D3) |
| `apps/merchant/src/server/merchant-login.ts` | crear (corte `closed` + destino, sacado de `magic-link/route.ts`) |
| `apps/merchant/src/app/api/merchant/auth/login/route.ts` | editar (D2) |
| `apps/merchant/src/app/api/merchant/auth/login/verify/route.ts` | crear (D4) |
| `apps/merchant/src/app/api/merchant/auth/magic-link/route.ts` | editar (usa `merchant-login.ts`, sin cambio de conducta) |
| `apps/merchant/src/server/merchant-auth-disabled-paths.test.ts` | editar (9 paths + control) |
| `apps/merchant/src/server/merchant-entry-email.test.ts` | editar (el login ya no llama `signInMagicLink`) |
| `apps/merchant/src/server/login-code.neon.integration.test.ts` | crear |
| UI (GPT): `account-step.tsx`, `onboarding-api.ts` | editar (§D4 «Para la UI») |

**Disjunta?** Si con lo de GPT en curso (`apps/public`). La UI del login la toca GPT despues de la API.

## Definition of Done

- [ ] `merchant-auth-disabled-paths.test.ts`: los 9 paths de `emailOTP` + los 2 de `magicLink` dan 404 por HTTP, y el
      control (`/sign-out`) no da 404.
- [ ] `merchant-entry-email.test.ts`: email conocido → `sendVerificationOTP` con `type: "sign-in"` y no
      `signInMagicLink`; email desconocido o `@staff.invalid` → no llama nada y responde `{ accepted: true }`.
- [ ] `tools/neon-test.sh src/server/login-code.neon.integration.test.ts`, contra una rama efimera:
  - codigo correcto → 200, `set-cookie`, `destination: "/backoffice"`, y la cookie abre `/backoffice`;
  - el mismo codigo otra vez → `code_incorrect`;
  - codigo equivocado → `code_incorrect`; al 5º equivocado, el correcto → `code_expired`;
  - vencido (fila con `expires_at` en el pasado) → `code_expired`;
  - pedir dos veces → el primer codigo da `code_incorrect` y el segundo entra;
  - negocio `closed` → 403 `business_closed` y 0 filas en `merchant_auth.session` para ese usuario;
  - `merchant_auth.verification.value` no contiene el codigo en claro;
  - 10 codigos equivocados (pidiendo codigos nuevos en el medio) → el siguiente intento, aun con el codigo correcto,
    da `429 too_many_failures`; con esas filas movidas a `expires_at` en el pasado, el codigo correcto entra.
- [ ] Las suites del link siguen verdes: `tools/neon-test.sh src/server/magic-link.neon.integration.test.ts` y
      `src/server/magic-link-business-closed.neon.integration.test.ts`.
- [x] `pnpm --filter ./apps/merchant exec tsc --noEmit -p .` y eslint de los archivos tocados, exit 0, Node 24.
- [ ] `rg -n MUTATION apps tools` → vacio.
- [ ] QA del owner con la UI de GPT: entrar desde la PWA instalada en iPhone con el codigo.

## Mutaciones — presupuesto: 4. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | Sacar `/sign-in/email-otp` de `disabledPaths` | `merchant-auth-disabled-paths.test.ts` |
| 2 | No borrar el codigo anterior en la D2 | SOBREVIVIO: better-auth ya lo anula; el borrado se saco (ver §D2) |
| 3 | Saltear el corte `closed` en la D4 | «negocio `closed` → 403 y 0 sesiones» |
| 4 | Chequear el tope de fallidos DESPUES de llamar al plugin | «10 equivocados → el correcto da 429» |

**Protocolo:** skill `protocolo-de-verificacion`. De a una, con bitacora en `docs/TASKS.md` y revertidas con `diff`.

## Declarado AFUERA (sin oraculo, a proposito)

- **El tope de fallidos permite bloquear al owner un dia**: quien conozca su email puede tipear 10 codigos
  equivocados y dejarlo sin entrar al panel por 24 h (el staff sigue entrando con PIN). Es el costo de cualquier tope
  por cuenta; contarlo por IP no protege porque las IP se rotan. **Aceptado por el owner (2026-10-11), en la etapa de pruebas.**

- **Sin limite por IP en la verificacion.** Lo acota el plugin: 5 intentos por codigo y, por email, 10 codigos por
  dia. Probar muchos emails desde una IP necesita pedir codigos, y eso ya tiene 20/h por IP.
- **La entrega real del email y la sugerencia de codigo de iOS** no se prueban en CI: las prueba el owner en el QA.

## Handoff

L2: lo implementa Claude en la sesion, sin subagentes. La UI va a GPT con la §D4.

## Abierto

Nada.

UI implementada por GPT: commit `c59ef5047103365277af02550ee7e23b8bbfea82` en `dev` (sin push ni merge). Typecheck, ESLint, formato y guardia UI en 0; e2e 10/10; código real y sesión comprobados en Docker local. [Capturas 390 claro/oscuro y evidencia](../qa/0202/README.md). QA del owner en PWA iPhone pendiente.
