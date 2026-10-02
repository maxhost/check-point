---
spec: 0119
fecha: 2026-10-01
estado: cerrada
resumen: Alta y login del cliente SOLO con Google o Apple (OIDC server-side, `jose`), identidad (proveedor, sub) en `consumer.consumer_identity`, telefono opcional, un toque con sesion viva; se borran el formulario, `/recover`, el OTP y sus tablas. Migracion 0061.
disjunta: no
archivos: packages/db/src/schema/consumer.ts, packages/db/src/schema/otp.ts, packages/db/src/schema/business-customer.ts, packages/db/drizzle/0061_*, packages/domain/src/server/consumer/*, packages/domain/src/server/otp/*, packages/domain/src/server/wallet/rotate.ts, packages/domain/src/server/hosts.ts, apps/consumer/src/app/(consumer)/enroll/**, apps/consumer/src/app/(consumer)/recover/**, apps/consumer/src/app/(consumer)/wallet/page.tsx, apps/consumer/src/app/api/public/{auth,enroll,recovery}/**, apps/public/src/legacy-routes.ts, apps/merchant/src/server/customers/list.ts
---

# 0119 — El cliente entra con Google o Apple

> **Nada de codigo empieza sin esta spec en `cerrada`.** Implementa el ADR 0111; las decisiones del owner estan
> citadas ahi textuales y no se re-preguntan.

## Problema

- El alta pide nombre, apellido y telefono en cada comercio nuevo si el navegador no tiene sesion
  (`apps/consumer/src/app/(consumer)/enroll/[programId]/enroll-form.tsx`).
- Aunque haya sesion viva, `/enroll/<id>` la ignora y muestra el formulario vacio (`page.tsx` no llama a
  `resolveSession`).
- El telefono es la identidad y no esta verificado (tarea 41): quien conoce uno ajeno obtiene su sesion.
- Volver a entrar exige SMS (`/recover`, OTP pago).

## Alcance

**Entra:**
- Login/alta con Google y con Apple en `/enroll/<programId>` y en `/wallet` sin sesion.
- Un toque con sesion viva en `/enroll/<programId>`.
- Tabla `consumer.consumer_identity`; `phone_e164` nullable en `consumer.consumer_account` y en
  `core.business_customer`; `email` nullable en `consumer_account`.
- Borrado: formulario, `/recover`, `api/public/recovery/*`, `server/otp/*`, `consumer/recovery*`, `rate-limit.ts`,
  `validation.ts` (alta), `rotate.ts`, tablas `otp_challenge`/`otp_delivery`/`enroll_attempt`, y sus tests.
- Fallback de nombre vacio en el DTO del listado del comercio.
- **El nombre de marca es «CheckPass Club», junto** (owner, 2026-10-01: «que se llame CheckPass Club»). Lo pide
  Google: la verificacion de marca rechazo «Check Pass Club» porque la web publica dice «CheckPass Club». Medido con
  `rg -n "Check Pass"`: 8 apariciones en 7 archivos, todas en `apps/consumer` (`public/sw.js:1,16`, `layout.tsx:6`,
  `ios-install-hint.tsx:121`, `wallet/page.tsx:60`, `wallet/bottom-nav.tsx:19`, `enroll/[programId]/page.tsx:50`, y
  `recover/page.tsx:23`, que se borra). Ningun test las nombra.

**No entra:**
- Cargar o editar el telefono (ni ningun dato) desde el perfil: el owner lo dejo para «si lo necesito en algun
  momento». No se crea pantalla ni endpoint de perfil.
- Union de cuentas (ni por email, ni por telefono) — ADR 0111 §3.
- Google One Tap / FedCM, el boton «CheckPass», passkeys.
- Cerrar sesiones de otros dispositivos / rotar el pase (se pierde con la recuperacion; hallazgo en `PARQUEADO.md`).
- Tocar la busqueda por telefono del comercio (sigue igual; hallazgo en `PARQUEADO.md`).
- Rediseño visual: la landing conserva su marco actual (logo/nombre del negocio, color de marca en el boton
  primario, oferta de bienvenida); solo cambia el contenido del formulario por los botones.

## Precondicion del owner (antes de despachar)

1. **Google Cloud**: un cliente OAuth tipo *Web application* con redirect
   `https://my.checkpass.club/api/public/auth/google/callback` (y `http://localhost:<puerto>/…` para dev), pantalla de
   consentimiento en produccion. Env en el proyecto Vercel del cliente: `CONSUMER_GOOGLE_CLIENT_ID`,
   `CONSUMER_GOOGLE_CLIENT_SECRET`.
2. **Apple Developer**: un *Services ID* con Sign in with Apple, dominio `my.checkpass.club` y Return URL
   `https://my.checkpass.club/api/public/auth/apple/callback`; una *Key* con Sign in with Apple (`.p8`). Env:
   `APPLE_SIGNIN_SERVICE_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_PRIVATE_KEY` (contenido del `.p8`) y
   `APPLE_TEAM_ID` (ya existe para PassKit: confirmar que esta cargada en el proyecto del cliente).
3. **La `0060` aplicada en PROD** (espera OK del owner, spec 0118): la `0061` va despues en el journal y el
   migrador las aplica en orden.

## Diseño

### Modelo de datos — migracion `0061`

Generada con `drizzle-kit generate` desde el schema y completada a mano como la `0060` (skill `gotchas-del-repo`,
migraciones a PROD):

```sql
CREATE TABLE consumer.consumer_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id uuid NOT NULL REFERENCES consumer.consumer_account(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','apple')),
  subject text NOT NULL,           -- claim `sub` del id_token
  email text,                      -- del id_token al crear; informativo
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX consumer_identity_provider_subject_unique ON consumer.consumer_identity (provider, subject);
CREATE INDEX consumer_identity_consumer_idx ON consumer.consumer_identity (consumer_id);
ALTER TABLE consumer.consumer_account ALTER COLUMN phone_e164 DROP NOT NULL;
ALTER TABLE consumer.consumer_account ADD COLUMN email text;
ALTER TABLE core.business_customer ALTER COLUMN phone_e164 DROP NOT NULL;
DROP TABLE consumer.otp_delivery; DROP TABLE consumer.otp_challenge; DROP TABLE consumer.enroll_attempt;
GRANT SELECT, INSERT ON consumer.consumer_identity TO checkpass_consumer;
```

- Los unicos de telefono (`consumer_account_phone_unique`, `core_business_customer_phone_unique`) se quedan:
  Postgres admite varios `NULL`.
- `consumer_identity` sin `UPDATE`/`DELETE` para el rol: una identidad nunca se reescribe.
- Los default privileges de la `0060` cierran la tabla nueva; el `GRANT` explicito es el que la abre.

### Modulos (`packages/domain/src/server/consumer/`)

- **`oauth/tokens.ts`** — `verifyIdToken({ token, jwks, issuer, audience, nonce })` con `jose.jwtVerify`
  (`issuer`, `audience`, `exp`) + comparacion de `nonce`. Devuelve `{ sub, email, emailVerified, givenName,
  familyName }`. El `jwks` es inyectable (`createRemoteJWKSet` en prod, `createLocalJWKSet` en tests).
  Issuers: Google `https://accounts.google.com` y `accounts.google.com`; Apple `https://appleid.apple.com`.
- **`oauth/google.ts`** — `googleAuthorizeUrl(...)` (scope `openid email profile`, `state`, `nonce`, PKCE S256,
  `prompt=select_account`) y `exchangeGoogleCode(code, verifier, redirectUri, fetchImpl)` →
  `POST https://oauth2.googleapis.com/token`.
- **`oauth/apple.ts`** — `appleAuthorizeUrl(...)` (scope `name email`, `response_mode=form_post`, `state`, `nonce`),
  `appleClientSecret(env, now)` (JWT ES256, `iss`=team, `sub`=service id, `aud`=`https://appleid.apple.com`,
  `exp`=now+5 min, `kid`=key id) y `exchangeAppleCode(...)` → `POST https://appleid.apple.com/auth/token`.
  `parseAppleUser(raw)` lee `name.firstName`/`name.lastName` del campo `user` (JSON, puede faltar o venir roto →
  `null`, nunca lanza).
- **`oauth/state-cookie.ts`** — codifica/decodifica la cookie `__Host-cp_oauth`: `{ provider, state, nonce,
  verifier?, programId?, loc?, exp }` en JSON base64url. `httpOnly`, `secure`, `sameSite: "none"`, `path: "/"`,
  `maxAge: 600`. Sin dominio. `state`, `nonce` y `verifier` con `generateOpaqueToken()` (`core.ts:27`).
- **`identity.ts`** — `findOrCreateAccountByIdentity({ provider, subject, email, firstName, lastName })`:
  busca por `(provider, subject)`; si existe devuelve la cuenta **sin escribir nada**; si no, en UNA transaccion
  inserta `consumer_account` (`phone_e164` null, `country_iso` null, nombres `?? ""`, `email`, `qr_token` y
  `web_view_token` nuevos) y la `consumer_identity`. Carrera (`23505` en la identidad) → relee por
  `(provider, subject)`. **Nunca consulta por email.**
- **`enrollment.ts`** — `enroll(programId, input, loc)` pasa a `enrollAccount(programId, accountId, loc)`:
  `loadEnrollableProgram` + `resolveOriginLocation` + `insertMembershipWithProjection`
  (`customers/projection.ts:91`); `23505` → `ConsumerError(409, "already_member")`. Se borran `accountByPhone`, el
  `existingAccount` y la rama de creacion de cuenta. `EnrollInput` desaparece.
- **`core.ts`** — `ConsumerAccountRow`/DTO: `phoneE164: string | null`, `email: string | null`; se borran
  `phoneVerified` y el tipo `EnrollInput`.

### Rutas (`apps/consumer/src/app/api/public/`)

| Ruta | Entrada | Efecto | Salida |
|---|---|---|---|
| `GET auth/[provider]/start` | `provider` ∈ {google, apple}; query `programId?`, `loc?` | setea `__Host-cp_oauth` | 302 al proveedor; provider desconocido → 404 |
| `GET auth/google/callback` | `code`, `state` (o `error`) | ver «callback comun» | 303 |
| `POST auth/apple/callback` | form: `code`, `state`, `user?` (o `error`) | ver «callback comun» | 303 |
| `POST enroll/[programId]` | cookie de sesion; JSON `{ loc? }` | `enrollAccount` + `issueWelcomeGiftsSafely` | 201 `{ membership }`; sin sesion 401 `unauthenticated`; 404; 409 `already_member` |

`redirect_uri` = `consumerOriginOr(request.nextUrl.origin)` (`hosts.ts:113`) + path del callback.

**Callback comun** (una funcion en `apps/consumer/src/server/oauth-callback.ts`, las dos rutas solo parsean):
1. Leer y **borrar** la cookie `__Host-cp_oauth`. Falta, vencida, otro `provider`, o `state` distinto → 303 a
   `destino?error=auth`, **sin sesion, sin filas**.
2. `error=access_denied` (el usuario cancelo) → 303 a `destino` sin `error`.
3. Canjear el codigo, verificar el `id_token` (`nonce` = el de la cookie; `aud` = client id / service id).
   Cualquier falla → 303 a `destino?error=auth`. Google: `email_verified=false` → `email` se guarda `null`.
4. `findOrCreateAccountByIdentity` (Apple: nombres de `parseAppleUser`; Google: `given_name`/`family_name`).
5. Si hay `programId`: `enrollAccount`; `already_member` **no es error**. Despues `issueWelcomeGiftsSafely`.
6. `issueSession` + cookie de sesion igual que hoy (`httpOnly`, `secure`, `lax`, 30 dias).
7. 303 a `/enroll/<programId>/ready` (alta nueva), `/wallet` (ya era miembro, o login sin programa).

`destino` = `/enroll/<programId>` si la cookie traia programa, si no `/wallet`.

**Decididos durante la implementacion (owner, 2026-10-01: «aceptado»):** (a) si el programa de la cookie ya no
esta disponible (404, o 403 de un negocio cerrado/suspendido), el callback abre la sesion igual y redirige a
`/enroll/<programId>`, que muestra «no disponible»; (b) `issueWelcomeGiftsSafely` se llama siempre que la cookie
trae programa, tambien si ya era miembro (es idempotente). Logs: proveedor + motivo, **nunca**
el `code`, el `id_token`, el `sub` ni el email.

### Pantallas

- **`/enroll/<programId>`** (server): programa no disponible → igual que hoy. Si no:
  - sin sesion: marco actual + **dos botones** «Continuar con Apple» / «Continuar con Google» (`<a>` a
    `start?programId=…&loc=…`); en iOS (user agent) Apple primero, si no Google primero. `?error=auth` → aviso
    «No pudimos completar el ingreso. Probá de nuevo.»
  - con sesion y ya miembro: «Ya sos parte de <negocio>» + «Ver mi tarjeta» (`/wallet`).
  - con sesion y no miembro: «Sumarme como <firstName>» (o «Sumarme» si el nombre esta vacio) → `POST enroll` →
    201 `location.assign(/enroll/<id>/ready)`; 409 → `/wallet`. Debajo, «No soy yo» muestra los dos botones.
- **`/enroll/<id>/ready`**: igual, sin `existingAccount` ni `?existing=1`.
- **`/wallet` sin sesion**: los dos botones (`start` sin `programId`) en lugar del enlace a `/recover`.
- **`settings-tab`** (`settings-tab.tsx:49` muestra `{phone}`): con `null` no muestra la fila.

### Borrado y referencias

`/recover` desaparece de `hosts.ts:36-37` y de `apps/public/src/legacy-routes.ts:44-45` (un 308 a una ruta
borrada es un 404). `enroll-form.tsx` se borra entero (incluido el salto a `/recover`, `:128`). Comentarios que
citan la recuperacion (`manifest.webmanifest/route.ts:21`, `push/subscriptions.ts:123`) se corrigen.
`purgeConsumerSubscriptions` (`push/subscriptions.ts:127`) hoy no tiene llamador de produccion (medido: solo `apps/merchant/src/server/web-push.neon.integration.test.ts`): se borra con su caso.

### Arquitectura de referencia

ADR 0111 (esta decision), 0032 (esquema `consumer`, sesion opaca), 0042 (`loc`), 0049 (manifest en la
confirmacion), 0070 §17 (borrar lo viejo), 0106 (`my.`), 0110 (rol minimo).

## Archivos

| Archivo | Accion |
|---|---|
| `packages/db/src/schema/consumer.ts` | editar (identity, phone nullable, email; borrar `enrollAttempts`) |
| `packages/db/src/schema/otp.ts` | borrar |
| `packages/db/src/schema/business-customer.ts` | editar (phone nullable) |
| `packages/db/drizzle/0061_*.sql` + `meta/` | crear |
| `packages/domain/src/server/consumer/oauth/{tokens,google,apple,state-cookie}.ts` | crear |
| `packages/domain/src/server/consumer/identity.ts` | crear |
| `packages/domain/src/server/consumer/{enrollment,core,session}.ts` | editar |
| `packages/domain/src/server/consumer/{rate-limit,validation,recovery}.ts`, `recovery/*`, `server/otp/*`, `wallet/rotate.ts`, `lib/recovery-countries.ts` | borrar |
| `packages/domain/package.json` | `jose` como dependencia directa (`pnpm add --offline`) |
| `packages/domain/src/server/hosts.ts` | editar |
| `apps/consumer/src/app/api/public/auth/**` | crear |
| `apps/consumer/src/server/oauth-callback.ts` | crear |
| `apps/consumer/src/app/api/public/enroll/[programId]/route.ts` | reescribir |
| `apps/consumer/src/app/api/public/recovery/**`, `(consumer)/recover/**` | borrar |
| `apps/consumer/src/app/(consumer)/enroll/[programId]/{page,enroll-form,enroll-confirmation,ready/page}.tsx` | editar / borrar el form / crear `enroll-buttons.tsx` |
| `apps/consumer/src/app/(consumer)/wallet/{page,settings-tab}.tsx` | editar |
| `apps/public/src/legacy-routes.ts` | editar |
| `apps/merchant/src/server/customers/list.ts` | editar (`:48`, nombre vacio → «Sin nombre») |
| `apps/consumer/public/sw.js`, `apps/consumer/src/app/layout.tsx`, `(consumer)/ios-install-hint.tsx`, `(consumer)/wallet/bottom-nav.tsx` | editar («CheckPass Club») |
| tests: los de recovery/OTP/enroll por telefono (`recovery-routes`, `consumer-role-recovery`, `enroll-existing-account`, `otp`, `recovery-config`, `consumer-recovery*` en merchant) | borrar; `consumer-role*`, `consumer-role-support.ts`, `hosts.test`, `legacy-routes.test`, `wallet-manifest.test` | editar |

### Disjunta?

**No.** Colisiona con cualquier spec abierta que toque `packages/domain/src/server/consumer/*`, la PWA del cliente o
el journal de migraciones. Hoy: la 0110 (borrador, toca campañas/push, no estos archivos) es disjunta; el arreglo
de `test:e2e` pendiente en `TASKS.md` toca el backoffice, disjunto. Serializar contra el rediseño de la PWA si
vuelve a abrirse.

## Definition of Done

- [ ] Gates locales verdes: `pnpm run typecheck`, `lint`, `test`, `format:check`, `build` (Node 24) y
      **`pnpm test:e2e`** (toca UI del cliente).
- [ ] `tools/neon-test.sh` verde sobre `consumer-role*.neon.integration.test.ts` y los nuevos de integracion.
- [ ] `rg -n 'phoneE164|recover|otp' apps/consumer/src packages/domain/src/server/consumer` solo devuelve
      `phoneE164` nullable del DTO/schema (se lista lo que queda y por que).
- [ ] `rg -n "'/recover'|\"/recover\"" apps packages -g '!**/node_modules/**' -g '!**/.next/**'` → vacio.
- [ ] `rg -n 'Check Pass' apps packages -g '!**/node_modules/**' -g '!**/.next/**'` → vacio.
- [ ] Las 7 mutaciones medidas, transcritas y revertidas con `diff` vacio.
- [ ] Revisor independiente: PASS.
- [ ] Deploy de `my.checkpass.club` en READY con el sha, y QA del owner (abajo) hecho.

## Plan de pruebas y verificación

**Unitarias (sin red; `fetch` y JWKS inyectados, claves con `jose.generateKeyPair`):**
- `tokens.test.ts`: firma valida → claims; `aud` ajeno, `iss` ajeno, vencido, `nonce` distinto, firma de otra
  clave → rechazo.
- `apple.test.ts`: `appleClientSecret` verifica con la publica y trae `iss/sub/aud/kid/exp≤5min`;
  `parseAppleUser` con JSON valido, ausente y roto.
- `state-cookie.test.ts`: ida y vuelta; vencida → null; `Set-Cookie` de `start` trae `__Host-`, `Secure`,
  `HttpOnly`, `SameSite=None`, `Path=/`, sin `Domain`.
- `oauth-callback.test.ts` (con dobles de dominio): `state` distinto → 303 `?error=auth` sin cookie de sesion y sin
  llamar a `findOrCreateAccountByIdentity`; `access_denied` → 303 sin `error`; `already_member` → 303 `/wallet`.

**Integracion (`*.neon.integration.test.ts`, via `tools/neon-test.sh`):**
- `identity`: mismo `(provider, sub)` dos veces → una cuenta; **dos `sub` con el mismo email → dos cuentas**;
  identidad existente + nombres nuevos → la cuenta queda byte a byte igual.
- `consumer-role` (COMO `checkpass_consumer`): el callback de Google con un id_token de prueba crea cuenta
  (telefono `NULL`), identidad, membresia con su `loc`, fila de `business_customer` con telefono `NULL`, y sesion;
  `POST enroll` con sesion → 201; sin sesion → 401 y 0 filas.
- `consumer-role-denied`: `UPDATE`/`DELETE` en `consumer.consumer_identity` → `42501`.

**Mutaciones — presupuesto 7.** Clase de error a cazar: union/robo de cuenta, CSRF en el callback, token forjado o
de otro cliente, perfil reescrito, `GRANT`/`NOT NULL` que rompe PROD, cookie que Apple no devuelve. Las M1–M6
atacan codigo que esta spec CREA (no existe hoy en el arbol: el implementador anota archivo:linea al abrir cada
fila); M7 ataca la `0061`.

| # | Mutacion | Oraculo | Guard hermano |
|---|---|---|---|
| M1 | `findOrCreateAccountByIdentity` busca por `email` antes de crear | integracion: «dos `sub`, mismo email → dos cuentas» rojo | ninguno: el unico `(provider, subject)` no impide unir por email |
| M2 | el callback no compara `state` | unit: «`state` distinto → `?error=auth`» rojo | el `nonce`: el caso usa un id_token con el `nonce` de la cookie para que solo el `state` corte |
| M3 | `verifyIdToken` sin `audience` | unit: «`aud` ajeno → rechazo» rojo | ninguno (mismo `iss`, misma clave) |
| M4 | `verifyIdToken` sin comparar `nonce` | unit: «`nonce` distinto → rechazo» rojo | ninguno |
| M5 | identidad existente → `UPDATE` de nombres con el `user` nuevo | integracion: «cuenta byte a byte igual» rojo | ninguno |
| M6 | `sameSite: "lax"` en `__Host-cp_oauth` | unit: atributos del `Set-Cookie` rojo | ninguno; el efecto real (Apple sin cookie) solo se ve en el QA |
| M7 | `0061` sin el `GRANT … consumer_identity` | integracion `consumer-role`: callback rojo con `42501` | ninguno: la tabla nace cerrada por default privileges |

Las de base (M7) se aplican y revierten en la rama de CI reaplicando la `0061` limpia, como en la 0118.

**Declarado, fuera del presupuesto:** la firma real de Google/Apple, el canje real del codigo y el `form_post`
cross-site no se prueban automaticamente (se doblan `fetch` y JWKS) → los cubre el QA. Apple no se puede probar en
local ni en previews (Return URL exacta, sin `localhost`).

**QA del owner (PROD, `my.checkpass.club`):**
1. iPhone, Safari, sin sesion: escanear el QR de Plátano → «Continuar con Apple» → Face ID → confirmacion con el
   nombre del Apple ID → pase/instalar como hoy.
2. Mismo iPhone: QR de otro comercio → «Sumarme como <nombre>» → un toque → confirmacion.
3. Android (o el mismo iPhone en otro navegador): «Continuar con Google» → confirmacion.
4. `/wallet` en un navegador limpio → botones → entra a la billetera sin programa nuevo.
5. Backoffice de Plátano → Clientes: aparece el cliente nuevo con su nombre.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`: un implementador para toda la spec, un revisor independiente al final con el
presupuesto de arriba. Bitacora de mutaciones en `TASKS.md` antes de medir.

## Abierto

Nada bloqueante. A `PARQUEADO.md` como **hallazgos a decidir** (ADR 0111, consecuencias): sin «cerrar sesiones en
otros dispositivos» tras borrar la recuperacion; la busqueda por telefono del comercio queda vacia para clientes
nuevos.
