---
spec: 0029
fecha: 2026-08-14
estado: implementada
resumen: Emite UN pase de identidad "Mi Pasaporte" por consumidor en Apple Wallet (iOS) y Google Wallet (Android) — barcode = `qr_token` de la 0028, sin progreso por-programa, con enlace "Ver mis programas" (token dedicado revocable). Provider intercambiable: Google real (gratis), Apple firma self-signed en tests (el install en iPhone real difiere el $99). El canal de push se separa a la spec 0033.
disjunta: sí
archivos: apps/merchant/src/server/wallet/*, apps/merchant/src/server/schema/consumer.ts, apps/merchant/src/app/api/public/wallet/*, apps/merchant/src/app/(consumer)/wallet/*, apps/merchant/src/app/(consumer)/c/[webViewToken]/*, apps/merchant/drizzle/0016_*.sql
---

# 0029 — Pase de Wallet (Apple / Google)

> **Segunda rebanada del "camino A"** (ADR 0031). Depende de la spec **0028** (identidad +
> `qr_token` ya emitido) y del **ADR 0033** (proveedor de Wallet), que fija: pase de identidad
> **único** por consumidor (branded Mi Pasaporte, no por negocio), barcode = `qr_token`
> global, sin progreso por-programa, con enlace "Ver mis programas"; `WalletProvider`
> intercambiable; el canal de push se separa a la **spec 0033**.

## Problema

La spec 0028 emite el `qr_token` personal del consumidor pero no lo renderiza ni lo hace
portable. El modelo merchant-first (ADR 0031) define la **Wallet nativa como superficie de
consumidor**: la credencial de Marcos vive en Apple/Google Wallet. Hoy, tras enrolarse, la
confirmación muestra "Listo" sin QR **a propósito** (nota al pie de la 0028). Falta: renderizar
el QR, generar y firmar el pase, ofrecer "Añadir a Apple/Google Wallet" según el dispositivo, y
dejar provisionados los ganchos de actualización que consumirá la spec 0033.

## Alcance

**Entra:**

- **Render visual del QR personal** (a partir del `qr_token` de la 0028) como imagen escaneable
  en la superficie web de consumer.
- **Emisión de UN pase de identidad por consumidor** (ADR 0033), branded "Mi Pasaporte":
  - **Apple**: construir y firmar el `.pkpass` (pass.json + `manifest.json` + firma PKCS#7 +
    imágenes), estilo *storeCard*/*generic*. Barcode = `qr_token`. En dev/test la firma es
    **self-signed** (verifica el builder; no instala en iPhone real).
  - **Google**: armar el JWT de "Añadir a Google Wallet" contra una *Loyalty Class* de Mi
    Pasaporte y un *Loyalty Object* por consumidor. Barcode = `qr_token`.
- **Botones "Añadir a Apple/Google Wallet"** en la superficie de consumer (post-enrolamiento y
  desde "Ver mis programas"), con detección de dispositivo por user-agent y **fallback a mostrar
  ambos**.
- **Enlace "Ver mis programas"** en el pase → ruta mínima de consumer que, vía un
  **`web_view_token` dedicado y revocable** (magic-link que abre sesión), lista los programas del
  consumidor (reusa el contrato de `GET /enroll/me`). El **dashboard rico** (cada `CardPreview`,
  progreso, términos) es la **spec 0031**.
- **Ganchos de actualización provisionados** en el pase (`webServiceURL` + `authenticationToken`
  para Apple; objeto creado por API para Google) y el **registro `wallet_pass`** — para que la
  spec 0033 actualice/pushee sin re-emitir.
- **`WalletProvider` intercambiable** (`apple`/`google`/`console`/`fake`) seleccionado por
  entorno, con los secretos del ADR 0033.

**No entra (cada uno su spec):**

- **Canal de actualización/push** (web service REST de PassKit, APNs, `PATCH`/`addMessage` de
  Google, rotación/revocación) → **spec 0033**.
- **Progreso por-programa en el pase** — no aplica: el pase es identidad, no programa (ADR 0033).
- **Dashboard rico "Ver mis programas"** (CardPreview por programa, progreso, términos) →
  **spec 0031**. La 0029 solo entrega la ruta mínima que resuelve el token.
- **Auto-enrolamiento por escaneo** y resolución del QR en mostrador → **spec 0030**.
- **Otorgamiento de puntos/sellos** (0030) y **notificaciones** (0031).

## Diseño

### Especificación técnica

**Arquitectura y límites.** Todo el dominio de Wallet vive bajo
`apps/merchant/src/server/wallet/*` (lógica + adaptadores de proveedor), con rutas públicas en
`apps/merchant/src/app/api/public/wallet/*` y las superficies en el route group `(consumer)`. No
toca `core` ni `merchant_auth`. Reusa el `qr_token` de la 0028 (no se re-emite). La firma corre
en runtime **Node** (no Edge).

**Modelo de datos** (esquema `consumer`; migración aditiva `0016`):

| Entidad | Campos / invariantes |
|---|---|
| `consumer_account` (**editar**) | + `web_view_token` text **único, not null**, opaco, sin PII, ≥128 bits, **distinto del `qr_token`**. Emitido al crear la cuenta (backfill para cuentas existentes en la migración). Autoriza "Ver mis programas"; revocable/rotable independiente del `qr_token`. **Nunca se serializa en crudo** (igual que `qr_token`/`token_hash`). |
| `wallet_pass` (**crear**) | `id` uuid PK; `consumer_id` → `consumer_account.id` (on delete cascade); `provider` text (`apple`\|`google`); `serial_number` text **único** (Apple: `serialNumber`; Google: object id); `auth_token_hash` text (Apple: hash del `authenticationToken` del web service — se compara en la 0033, nunca se serializa; Google: null); `created_at`, `updated_at`; **unique (`consumer_id`, `provider`)** (un pase por proveedor por consumidor). |

**Provider (`WalletProvider`).** Interfaz agnóstica seleccionada por entorno
(`WALLET_PROVIDER`/secretos presentes), misma filosofía que `OtpChannel` de la 0032:

- `buildApplePass(consumer): { bytes: Buffer, mime: "application/vnd.apple.pkpass" }` — arma
  pass.json (estilo storeCard, barcode `PKBarcodeFormatQR` = `qr_token`, `webServiceURL` +
  `authenticationToken`, `serialNumber`, campos de branding Mi Pasaporte, `barcode.altText`
  vacío/sin PII), `manifest.json` (sha1 por archivo), firma PKCS#7 (cert Pass Type ID + WWDR; en
  test **self-signed**), y comprime el zip.
- `buildGoogleSaveUrl(consumer): string` — JWT firmado (service account) que referencia la
  Loyalty Class de Mi Pasaporte y el Loyalty Object del consumidor (barcode QR = `qr_token`);
  devuelve la URL `https://pay.google.com/gp/v/save/<jwt>`.
- `console`/`fake` — para dev/test sin secretos reales (loguean/retornan artefactos
  estructuralmente válidos pero no firmados por una CA de confianza).

Secretos (ADR 0024/0033, base64 en Vercel): `APPLE_PASS_CERT_P12`, `APPLE_WWDR_CERT`,
`APPLE_TEAM_ID`, `APPLE_PASS_TYPE_ID`, `GOOGLE_WALLET_SA_JSON`, `GOOGLE_WALLET_ISSUER_ID`. APNs
(`.p8`) **no** entra acá (spec 0033).

**Rutas / contrato** (públicas; autorizadas por la cookie de sesión de consumer de la 0028,
salvo el magic-link):

| Método · Ruta | Auth | Salida OK | Errores |
|---|---|---|---|
| `GET /api/public/wallet/apple.pkpass` | cookie de sesión | `200` bytes `.pkpass` (`Content-Type: application/vnd.apple.pkpass`); crea-o-reusa la fila `wallet_pass` (`apple`) | `401` sin sesión; `503` si el proveedor Apple no está configurado |
| `GET /api/public/wallet/google` | cookie de sesión | `302` a la URL de guardado de Google (o `200 { saveUrl }`); crea-o-reusa `wallet_pass` (`google`) | `401`; `503` si el proveedor Google no está configurado |
| `GET /c/[webViewToken]` | token en la ruta | `302` a `(consumer)/wallet` con la **sesión abierta** (setea la cookie `HttpOnly` de la 0028) | `404` token inexistente/revocado |
| `GET /api/public/enroll/me` (existente 0028) | cookie | `200 { account, memberships[] }` | `401` |

**Autorización y no-fuga.** La emisión del pase se autoriza por la **sesión de consumer**; el
artefacto resultante es **al portador** (como el QR — ADR 0014). El `web_view_token` es un
bearer revocable; visitarlo **abre sesión** (magic-link) — aceptable porque el pase ya es al
portador y el threat model ("teléfono desbloqueado de Marcos") no cambia. **Ninguna respuesta ni
DTO serializa** `qr_token`, `web_view_token`, `token_hash` ni `auth_token_hash` en crudo (patrón
anti-fuga del proyecto; test por entidad). El barcode del pase contiene el `qr_token` — es su
uso legítimo (portarlo), no una fuga en un DTO JSON.

**Branding del pase.** Colores/logo de "Mi Pasaporte" (constantes de la app, no de un negocio);
el pase **no** lleva branding por-comercio (eso vive en "Ver mis programas"/spec 0031). Sin PII
visible más allá del nombre del consumidor.

**Estados de interfaz (móvil-first).** Tras enrolarse (0028), la superficie de consumer muestra:
(1) el **QR renderizado**; (2) botones "Añadir a Apple/Google Wallet" (detección por UA, ambos
como fallback); (3) enlace "Ver mis programas". La ruta mínima "Ver mis programas" lista los
programas del consumidor (nombre de programa + negocio, reusando `me`); el detalle rico es 0031.

### Arquitectura de referencia

- **ADR 0033** — proveedor de Wallet: emisor único, pase de identidad único, barcode = `qr_token`,
  provider intercambiable, dev sin pagar Apple, push separado a 0033.
- **ADR 0014** — QR opaco, revocable, al portador, sin PII.
- **ADR 0031/0032** — identidad de consumidor de plataforma, esquema `consumer`.
- **ADR 0024** — secretos en entorno.
- **Spec 0028** — `qr_token`, sesión, membresía (fundación).

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/schema/consumer.ts` | editar (`web_view_token` en `consumer_account` + tabla `wallet_pass`) |
| `apps/merchant/drizzle/0016_*.sql` | crear (migración aditiva: columna + backfill + tabla `wallet_pass`) |
| `apps/merchant/src/server/wallet/provider.ts` | crear (interfaz `WalletProvider` + selección por entorno) |
| `apps/merchant/src/server/wallet/apple.ts` | crear (builder + firma PKCS#7 del `.pkpass`) |
| `apps/merchant/src/server/wallet/google.ts` | crear (JWT de guardado + Loyalty Object) |
| `apps/merchant/src/server/wallet/fake.ts` | crear (proveedor console/fake para dev/test) |
| `apps/merchant/src/server/wallet/core.ts` | crear (registro `wallet_pass`, `web_view_token`, DTOs anti-fuga, render del QR server-side si aplica) |
| `apps/merchant/src/app/api/public/wallet/apple.pkpass/route.ts` | crear (`GET`) |
| `apps/merchant/src/app/api/public/wallet/google/route.ts` | crear (`GET`) |
| `apps/merchant/src/app/(consumer)/c/[webViewToken]/route.ts` | crear (magic-link → sesión) |
| `apps/merchant/src/app/(consumer)/wallet/page.tsx` | crear (QR + botones Wallet + "Ver mis programas" mínimo) |
| `apps/merchant/src/app/(consumer)/enroll/[programId]/enroll-form.tsx` | editar (tras enrolar, enlazar a `(consumer)/wallet`) |

### Disjunta?

**Sí.** El dominio `wallet/*` y las rutas `api/public/wallet/*` + `(consumer)/wallet` +
`(consumer)/c` son territorio nuevo. Toca `consumer.ts` (aditivo: 1 columna + 1 tabla) y un
retoque en `enroll-form.tsx`, ambos de la 0028 (ya `implementada`, no en curso). No colisiona con
specs abiertas (0030/0031/0032/0033 no tocan estos archivos hoy).

### Archivos compartidos

Ninguno que otra spec abierta consuma en paralelo. El orquestador deja listo, antes de despachar:
el `web_view_token` y la tabla `wallet_pass` (migración `0016`), y los secretos del proveedor en
el entorno de test (self-signed Apple + service account de demo Google).

## Definition of Done

> **Implementada 2026-08-14** — implementador + revisor independiente **PASS** (`AGENT-WORKFLOW.md`),
> ambos con gates propios (typecheck 3/3, eslint, unit 60/23-skip con 7 de wallet, build 3/3) +
> integración Neon **4/4** (wallet) y **9/9** (regresión 0028) en rama efímera. Migración `0016`
> aplicada y verificada por SQL en la rama efímera **y en prod** (17 migraciones; `web_view_token`
> NOT NULL/único, 2 cuentas backfilleadas con tokens distintos y URL-safe, ninguno igual al
> `qr_token`; `wallet_pass` + 3 uniques; `core`(14)/`merchant_auth`(4) intactos). Residuales
> aceptados: install en iPhone real ($99) y verificación manual en Android real.

- [x] La superficie de consumer post-enrolamiento **renderiza el QR** del `qr_token` (escaneable,
      SVG server-side) y **ya no** muestra "Listo" sin QR.
- [x] `GET /wallet/google` con sesión válida devuelve una URL de guardado de Google Wallet válida
      (JWT RS256 firmado que instala un Loyalty Object con el barcode = `qr_token`; firma
      verificada con la pública en unit). Verificación en **Android real** = residual del owner.
- [x] `GET /wallet/apple.pkpass` con sesión válida devuelve un `.pkpass` **estructuralmente
      válido** (pass.json + `manifest.json` con sha1 correctos + firma PKCS#7 presente + zip) —
      verificado por unit contra un cert **self-signed**; el install en iPhone real queda como
      residual (necesita el cert de pago).
- [x] Ambos endpoints exigen sesión (`401` sin cookie) y crean-o-reusan **una** fila `wallet_pass`
      por (consumidor, proveedor) (unique + re-select en 23505; integración: 2ª llamada no duplica).
- [x] El pase Apple incluye `webServiceURL` + `authenticationToken` (ganchos para la 0033) y un
      `serialNumber` estable; el objeto Google queda creado/patcheable por la 0033.
- [x] La landing muestra botones "Añadir a Apple/Google Wallet" con detección por UA y **ambos**
      como fallback (nunca oculta por detección fallida).
- [x] El pase lleva un enlace "Ver mis programas"; visitarlo (`/c/[webViewToken]`) **abre sesión**
      y lista los programas del consumidor. Token inexistente/revocado → `404`.
- [x] Ninguna respuesta/DTO serializa `qr_token`, `web_view_token`, `token_hash` ni
      `auth_token_hash` en crudo (test por entidad, patrón anti-fuga).
- [x] Migración `0016` aditiva aplicada y verificada en rama Neon efímera y en prod: existe
      `web_view_token` (único, backfill completo URL-safe) y la tabla `wallet_pass` con su unique;
      `core`/`merchant_auth` intactos.

## Plan de pruebas y verificación

- [ ] Unidad: el `.pkpass` construido tiene pass.json bien formado, `manifest.json` con los sha1
      de cada archivo, firma PKCS#7 presente (self-signed) y zip abrible; el barcode = `qr_token`.
- [ ] Unidad: el JWT de Google está firmado por la service account, referencia la Loyalty Class y
      el Object correctos y su barcode = `qr_token`.
- [ ] Unidad: `web_view_token` es aleatorio ≥128 bits, distinto del `qr_token`, y los DTOs no lo
      exponen (ni a él ni al `auth_token_hash`).
- [ ] Integración (Neon, rama efímera): emitir pase Apple/Google crea-o-reusa **una** fila
      `wallet_pass` por (consumidor, proveedor); segunda llamada no duplica.
- [ ] Integración/sesión: `/wallet/*` sin cookie → `401`; `/c/[token]` con token válido abre
      sesión y con token revocado/inexistente → `404`.
- [ ] Comandos exactos: `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit), integración Neon en
      rama efímera, `pnpm build`, y `drizzle-kit migrate` de la `0016` verificada.
- [ ] Verificación manual: **Android real** — abrir la superficie, tocar "Añadir a Google
      Wallet", ver el pase Mi Pasaporte con el QR escaneable y el enlace "Ver mis programas".
      **iOS real** — residual hasta el alta Apple Developer ($99); documentado como pendiente,
      no bloquea el PASS del código.

## Handoff requerido

Implementador y revisor usan el formato de `docs/AGENT-WORKFLOW.md`. El revisor produce un
`PASS` independiente —con foco en la no-fuga de `qr_token`/`web_view_token`/`auth_token_hash`, la
validez estructural del `.pkpass` y del JWT de Google, la autorización por sesión y el
aislamiento— antes de marcar `implementada`. Residual explícito: install en iPhone real (post
alta Apple).

## Abierto

- **Nada bloquea el cierre.** Los residuales conocidos están acotados y no impiden implementar:
  - **Install en iPhone real** requiere la membresía Apple ($99) — el código se verifica con
    firma self-signed; el install es QA residual, no gate del PASS.
  - **Fidelidad visual al diseño de tarjeta 0027** (strip image con los recuadros de sello
    dibujados) queda **fuera de alcance a propósito**: el pase de identidad no muestra progreso;
    el diseño por-programa vive en "Ver mis programas" (spec 0031). Si a futuro se quiere un
    pase más rico, es otra spec.
