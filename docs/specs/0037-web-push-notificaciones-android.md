---
spec: 0037
fecha: 2026-08-15
estado: implementada
resumen: Segundo transporte de notificación — Web Push del navegador (Push API + Service Worker + VAPID), **iOS + Android** — separado del canal wallet (0033) bajo el modelo de aviso común (ADR 0038/0039). En **Android** se suscribe en la pestaña y da el contenido rico que el banner de Google no controla. En **iOS** vive en **dos contextos** (ADR 0039): la landing de Safari muestra cómo añadir a inicio + un **escape hatch** que da el pase de Wallet sin instalar; el **micro-portal** (la página `(consumer)/wallet` ya existente, hecha instalable) es el único lugar donde se pide permiso y se crea la `PushSubscription`. Tabla `web_push_subscription`, canal `PushChannel` `webpush` (cripto `node:crypto`, sin dependencia, verificada contra el vector del RFC 8291), service worker + manifest, fan-out del aviso transaccional, purge de suscripciones en la rotación del pase, y la dimensión de transporte provisionada para las campañas futuras.
disjunta: no
archivos: apps/merchant/src/server/schema/consumer.ts, apps/merchant/src/server/push/vapid.ts, apps/merchant/src/server/push/webpush-channel.ts, apps/merchant/src/server/push/subscriptions.ts, apps/merchant/src/server/wallet/push.ts, apps/merchant/src/server/wallet/rotate.ts, apps/merchant/src/app/api/public/push/subscribe/route.ts, apps/merchant/src/app/(consumer)/wallet/*, apps/merchant/public/sw.js, apps/merchant/public/manifest.webmanifest, apps/merchant/drizzle/0022_*.sql
---

# 0037 — Web Push (notificaciones de navegador, iOS + Android)

> **Implementada** (2026-08-15) con el protocolo de `AGENT-WORKFLOW.md`: implementador →
> revisor independiente **PASS** (sin bloqueantes). Diseño acordado con el owner (2026-08-15),
> reencuadrada por el **ADR 0039** (incluye iOS, no solo Android). **Dos correcciones al texto
> aplicadas en la implementación:** (1) la migración es **`0023_round_shape`** — `0022` ya estaba
> tomado; (2) el `manifest` se sirve como **route dinámica** (`(consumer)/wallet/manifest.webmanifest/
> route.ts`), no como archivo estático en `public/`, porque el `start_url` debe encapsular el
> `web_view_token` per-consumidor (ADR 0039 §5: rotar el token deja el ícono viejo en 404); el
> revisor la evaluó y aceptó como cumpliendo la intención del ADR. `public/sw.js` sí es estático.
>
> **Enmienda post-QA (2026-08-16, owner en iPhone real):** el instructivo de "añadir a inicio"
> vivía solo en `/wallet` (detrás del link "Ver mi tarjeta"), pero el ADR 0039 §2(1) lo ubica en
> la **landing de Safari post-registro** = la pantalla "¡Listo!" del enroll (spec 0028). Se extrajo
> a un componente presentacional reusable `(consumer)/ios-install-hint.tsx` (+ `isIosSafariBrowser()`)
> y se renderiza inline en la confirmación del enroll (`enroll-form.tsx`, screen `done`) para iOS
> Safari, junto a los botones de Wallet (escape hatch). `push-prompt.tsx` reusa el mismo componente.
> UI-only; typecheck 3/3, lint, unit 136, build 3/3.
>
> **Enmienda post-QA 2 (2026-08-16, owner en iPhone real):** ajustes de UX sobre el instructivo
> y la confirmación. (1) Se **quitó el botón "Abrir Compartir"** de `ios-install-hint.tsx`: usaba
> `navigator.share()`, que abre la hoja de compartir *del contenido* (mandar-un-link) — NUNCA
> contiene "Añadir a pantalla de inicio", esa acción vive solo en el menú de Safari; el botón
> confundía. (2) Se **rehízo el paso a paso**: beneficio fuerte arriba (un toque = QR + avisos +
> beneficio esperando) + 3 pasos numerados con los glifos de Compartir y Añadir dibujados como
> **SVG inline** (sin assets externos; se pueden swapear por capturas reales luego). (3) Se **quitó
> la sección "Tus programas"** de `(consumer)/wallet/page.tsx` (con su query de memberships e imports
> muertos). UI-only; typecheck 3/3, lint, unit 136, build 3/3, prettier. **Falta re-QA del owner.**
>
> **Enmienda post-QA 3 (2026-08-16, QA iOS real):** el Web Push **no llegaba en iOS** (el wallet
> sí). Diagnóstico por SQL en prod: la suscripción se creó bien (`web_push_subscription` con la
> `ios`), la fila de cola quedó `sent`, pero `last_error = "webpush: push service responded 403"`
> — Apple `web.push.apple.com` rechazaba la **autenticación VAPID**. Causa raíz: el
> `WEB_PUSH_VAPID_SUBJECT` estaba cargado como **email pelado** (`hola@nocodecompany.co`) sin
> el esquema `mailto:` que exige RFC 8292 §2.1; el par de claves era válido (verificado derivando
> la pública desde la privada con ECDH). **Fix de config (owner):** `mailto:hola@nocodecompany.co`
> en Vercel. **Fix estructural (mistake→rule):** `normalizeVapidSubject()` en `push/vapid.ts`
> antepone `mailto:` a cualquier subject sin esquema, así una env var mal cargada nunca puede
> deshabilitar el canal en silencio; test unitario nuevo (unit 137). typecheck 3/3, lint, prettier.
>
> Cuarta rebanada del canal de notificación. Depende de la spec **0033** (cola + worker +
> canal de push), del **ADR 0037** (outbox/prioridad/cooldown), del **ADR 0038** (dos
> transportes `wallet`/`webpush`) y del **ADR 0039** (iOS vía PWA + micro-portal + escape
> hatch). El micro-portal es la página post-registro **ya existente** (`(consumer)/wallet`,
> spec 0029) hecha instalable; su contenido rico sigue siendo la spec **0031**.

## Problema

El pase de Wallet (0033) notifica **rico en iOS** (Apple renderiza el `changeMessage`) pero
**pobre en Android**: Google `addMessage` muestra un **banner genérico** ("Mensaje nuevo /
Presiona para ver el pase") y el texto real queda **dentro del pase** — el emisor no controla
el banner (verificado en QA del owner, 2026-08-15). Hoy **no hay** ningún canal que muestre en
la pantalla de un Android el texto "Se acreditaron 10 puntos en tu cuenta 🎉" sin instalar una
app. Y en iOS no hay **micro-portal** en el home: el consumidor no tiene un acceso directo a sus
programas/cupones/QR más allá del pase.

## Alcance

**Entra:**
- **Transporte Web Push** (Push API + Service Worker + VAPID) como **segundo transporte** junto
  al `wallet` de 0033 (ADR 0038): claves VAPID, service worker, cifrado de payload, envío al
  endpoint. **Cripto con `node:crypto`, sin dependencia** (ADR 0039).
- **Micro-portal instalable (PWA):** la página `(consumer)/wallet` ya existente gana `manifest`
  + `sw.js` para ser **añadible a la pantalla de inicio**. En iOS es el **único** contexto donde
  se puede pedir permiso y suscribir (ADR 0039); su `start_url` encapsula el `web_view_token`.
- **Captura de suscripción por plataforma:**
  - **Android:** prompt de permiso + suscripción **en la pestaña** (Chrome), tras un gesto.
  - **iOS:** landing de Safari muestra **cómo añadir a inicio** (instrucciones inline) + **escape
    hatch** ("solo dame mi pase de Wallet" → botón Apple Wallet directo, sin instalar). El
    permiso/suscripción se piden **al abrir la PWA instalada**.
- **Tabla `web_push_subscription`** (N por consumidor) + canal `PushChannel` `webpush`
  intercambiable (`fake` para test) seleccionado por entorno.
- **Fan-out del aviso transaccional**: al acreditar (0030), el aviso sale por el pase (como hoy)
  **y además por Web Push** si el consumidor tiene suscripciones — con el texto rico controlado.
- **Purge en la rotación del pase:** `rotatePassCredentials` (`wallet/rotate.ts`) también borra
  las `web_push_subscription` del consumidor (simetría con el borrado de devices; lo consumirá la
  recuperación de 0032).
- **Dimensión de transporte provisionada** en el modelo de la cola para que las campañas futuras
  elijan `wallet`/`webpush`/ambos (sin construir el productor de campañas).
- **Baja de suscripción muerta**: `404`/`410` del endpoint borra la fila (como el `410` de APNs).

**No entra (cada uno su spec o feature):**
- **El contenido rico del micro-portal** (dashboard "Ver mis programas": historial, cupones,
  progreso) — **spec 0031**. La 0037 solo hace instalable la página mínima existente.
- **El productor/UI de campañas de marketing** — la 0037 provisiona el transporte, no su origen.
- **La lógica de acreditación** (0030) — la 0037 solo suma el fan-out del aviso ya encolado.
- **La recuperación de cuenta / rotación en sí** (spec 0032) — la 0037 solo agrega el purge de
  suscripciones al `rotatePassCredentials` existente.

## Diseño

### Especificación técnica

**Arquitectura y límites.** Nuevo dominio `apps/merchant/src/server/push/*` (VAPID, cifrado, canal
`webpush`, suscripciones). Reutiliza la cola/worker de 0033 (`wallet/push*.ts`) — el worker, al
entregar un aviso, hace fan-out a **todos los transportes** del consumidor: el pase (0033) y las
suscripciones Web Push (0037). Runtime **Node**. No toca `core` ni `merchant_auth`.

**Los dos contextos de iOS (ADR 0039).** En iOS la Push API solo existe con el sitio **instalado
como PWA en la pantalla de inicio** (iOS 16.4+); `Notification.requestPermission()` y
`pushManager.subscribe()` solo funcionan **dentro de la PWA standalone**, con gesto del usuario,
**nunca en la pestaña de Safari**. Y iOS **no** permite disparar "Añadir a inicio" por código
(no hay `beforeinstallprompt`): solo instruir. Por eso el flujo iOS se parte en:
1. **Landing de Safari** (post-registro 0028): instrucciones inline "Compartí → Añadir a inicio →
   Añadir" vendiendo el **valor del portal** (programas/cupones/QR) + **escape hatch** "solo dame
   mi pase" (botón Apple Wallet directo, sin instalar → no se pierde el canal wallet).
2. **PWA abierta desde el ícono del home** (`(consumer)/wallet` en standalone): ve su pase, añade a
   Wallet **y** se le ofrece el permiso de notificaciones → al aceptar, `subscribe`.

**Android.** No requiere instalar: el prompt de permiso y `pushManager.subscribe()` corren en la
pestaña de Chrome tras un gesto; el botón de Wallet (Google) se muestra en la misma landing. El
"añadir a inicio" se puede ofrecer para engagement (`beforeinstallprompt`), no es requisito.

**Modelo de datos** (esquema `consumer`; migración aditiva **0022**):

| Entidad | Campos / invariantes |
|---|---|
| `web_push_subscription` (**crear**) | `id` uuid PK; `consumer_id` → `consumer_account.id` (on delete cascade); `endpoint` text **unique** (URL del push service del navegador); `p256dh_key` text, `auth_key` text (claves de cifrado del cliente, RFC 8291); `user_agent` text; `platform` text (`ios`/`android`/`other`, para analítica y para el purge); `created_at`, `last_seen_at`. **`endpoint`, `p256dh_key`, `auth_key` NUNCA se serializan** en un DTO. |
| cola de aviso (**editar**, ADR 0038) | dimensión de **transporte** para que un aviso pueda dirigirse a `wallet`, `webpush` o ambos. El transaccional apunta a "todos los transportes del consumidor" (fan-out); la campaña (futura) elige. **Forma elegida: entrega-a-todos-los-transportes para el transaccional** — sin columna `transport` explícita en la cola por ahora; la selección `wallet`/`webpush` se agrega como filtro cuando llegue el productor de campañas (opción (b) del cierre; evita repintar el worker). |

**Canal `webpush` (`node:crypto`, sin dependencia).** Cifra el payload (RFC 8291/8188,
`aes128gcm`) con `createECDH('prime256v1')` + `hkdf` (SHA-256) + `createCipheriv('aes-128-gcm')`,
y hace `POST` al `endpoint` con el header `Authorization` VAPID (JWT ES256, RFC 8292, firmado con
`sign('sha256')` sobre la privada P-256 — mismo patrón que el JWT de APNs de 0033). Un `201/202`
= entregado al push service; `404/410` = suscripción muerta → se borra la fila. Errores por
suscripción no abortan el resto (igual que APNs por-dispositivo en 0033). **El cifrado se verifica
contra el vector de prueba del Apéndice A del RFC 8291** (oráculo externo; requisito del CLAUDE.md
para cripto DIY). Canal `fake` para el gate.

**Service worker + manifest.** `public/manifest.webmanifest` (nombre, íconos, `display:
standalone`, `start_url` = el portal con el `web_view_token`) hace la página instalable. `public/
sw.js` en scope raíz escucha `push` (muestra la notificación: título = negocio, cuerpo = el aviso)
y `notificationclick` (abre el portal). El registro del SW y la suscripción se hacen desde el
cliente **en el contexto correcto por plataforma** (iOS: PWA standalone; Android: pestaña).

**Captura de suscripción.** `POST /api/public/push/subscribe` (autenticada con la cookie de sesión
de consumidor de 0028): recibe la `PushSubscription` (endpoint + keys + UA), deriva `platform`,
hace upsert por `endpoint`, la asocia al consumidor de la sesión. Anti-fuga: la respuesta no
devuelve keys.

**VAPID.** Par de claves en entorno (`WEB_PUSH_VAPID_PUBLIC_KEY` / `WEB_PUSH_VAPID_PRIVATE_KEY` +
subject `mailto:`). La pública va al cliente; la privada firma el JWT VAPID. Sin claves → el canal
queda deshabilitado (no se ofrece el prompt), análogo a 503 de proveedores no configurados.

**Fan-out y cooldown.** El worker entrega un aviso a los transportes del consumidor; el **cooldown
es por consumidor y por aviso**, no por transporte (un aviso por pase + Web Push cuenta como
**uno**).

**Rotación y purge.** `rotatePassCredentials` (`wallet/rotate.ts`) —que ya rota `qr_token` +
`web_view_token` y borra devices— también **borra las `web_push_subscription` del consumidor**.
Consecuencia: recuperar la cuenta (0032) deja el ícono viejo del home apuntando a un
`web_view_token` muerto (404) y corta sus notificaciones. Deseado ante pérdida de dispositivo.

**Autorización y no-fuga.** La suscripción se crea contra la sesión del consumidor (no se puede
suscribir a otro). Ningún DTO/respuesta serializa `endpoint`/`p256dh_key`/`auth_key` (test por
entidad).

### Arquitectura de referencia

- **ADR 0039** — iOS vía PWA + micro-portal load-bearing + escape hatch + cripto `node:crypto`.
- **ADR 0038** — dos transportes (`wallet`/`webpush`), fan-out, campañas eligen transporte.
- **ADR 0037** — cola outbox, prioridad, cooldown (se reutiliza).
- **ADR 0013** — proveedores/canales intercambiables (`webpush` como uno más).
- **ADR 0024** — secretos en entorno (VAPID).
- **Spec 0033** — cola + worker + `PushChannel` + fan-out + `rotatePassCredentials`.
- **Spec 0029** — página `(consumer)/wallet`, `web_view_token`, magic-link `/c/[webViewToken]`.
- **Spec 0028** — sesión de consumidor (autoriza el `subscribe`).
- **Spec 0031** — contenido rico del micro-portal (downstream; serializar).

Fuentes de conversión (2026-08-15): pase de Wallet ~90% open rate; Web Push opt-in ~5–6% (10–15%
con buen prompt), open ~34% promocional / ~65% automatizado, CTR ~2–7%.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/schema/consumer.ts` | editar (`web_push_subscription`) |
| `apps/merchant/drizzle/0022_*.sql` | crear (migración aditiva: tabla + índices) |
| `apps/merchant/src/server/push/vapid.ts` | crear (JWT VAPID ES256 con `node:crypto`) |
| `apps/merchant/src/server/push/webpush-channel.ts` | crear (cifrado RFC 8291 con `node:crypto` + envío; canal `webpush` + `fake`) |
| `apps/merchant/src/server/push/subscriptions.ts` | crear (upsert/borrado/lectura + DTO anti-fuga + purge) |
| `apps/merchant/src/server/wallet/push.ts` | editar (fan-out del aviso a los transportes) |
| `apps/merchant/src/server/wallet/rotate.ts` | editar (purge de `web_push_subscription` al rotar) |
| `apps/merchant/src/app/api/public/push/subscribe/route.ts` | crear (`POST`, sesión de consumidor) |
| `apps/merchant/src/app/(consumer)/wallet/*` (`page.tsx`/`wallet-cta.tsx`) | editar (registro SW + prompt por plataforma + escape hatch iOS) |
| `apps/merchant/public/sw.js` | crear (service worker: `push` + `notificationclick`) |
| `apps/merchant/public/manifest.webmanifest` | crear (PWA instalable, `start_url` con `web_view_token`) |

### Disjunta?

**No.** Toca `wallet/push.ts` y `wallet/rotate.ts` (0033), `consumer.ts`/schema (0028/0033), y la
página `(consumer)/wallet` (0029). Se cruza con la **spec 0031** (borrador) en la misma página del
portal. 0033 y 0029 ya están implementadas (retoque aditivo). **Serializar con 0031**.

## Definition of Done

- [x] **Android** suscripto recibe, al acreditarle puntos (0030), una **notificación de contenido
      controlado** ("Se acreditaron X puntos en tu cuenta 🎉") **además** del aviso del pase.
      *(fan-out `webpush`+`wallet` en `deliverTransports`; integración lo verifica con canal `fake`.
      QA en Android real = residual.)*
- [x] **iOS**: la página `(consumer)/wallet` es **instalable** (manifest + SW); abierta como PWA
      standalone pide permiso y crea la suscripción; la landing de Safari muestra el instructivo de
      "añadir a inicio" **y** el **escape hatch** que da el pase de Wallet sin instalar. *(QA en
      iPhone real = residual.)*
- [x] En iOS, el permiso/suscripción **no** se intentan desde la pestaña de Safari (solo standalone).
      *(gate `ios && !standalone` en `push-prompt.tsx`.)*
- [x] `POST /api/public/push/subscribe` hace upsert por `endpoint` contra la sesión del consumidor;
      no permite suscribir a otro consumidor; deriva `platform`. *(401 sin sesión, 400 body inválido,
      test de aislamiento A→B.)*
- [x] Un `404`/`410` del push service borra la `web_push_subscription`.
- [x] `rotatePassCredentials` borra las `web_push_subscription` del consumidor al rotar. *(plegado en
      el CTE de rotación — atómico; integración lo verifica.)*
- [x] El JWT VAPID es válido (verificable con la clave pública) y el payload va cifrado (RFC 8291),
      **verificado contra el vector del Apéndice A** *(reproducido byte-a-byte en `push.test.ts`).*
- [x] El cooldown cuenta un aviso multi-transporte como **uno** *(una fila de cola cerrada, un
      `lastPushAt`; integración `summary.sent == 1` con los 3 transportes golpeados).*
- [x] Ningún DTO serializa `endpoint`/`p256dh_key`/`auth_key` (test por entidad).
- [x] Migración **`0023`** aditiva aplicada y verificada en rama efímera y **prod** (24 migraciones;
      `consumer` 7→8 tablas, 9 cols + 3 índices; `core`(22)/`merchant_auth`(4) intactos).

## Plan de pruebas y verificación

- [x] Unidad: JWT VAPID (firma verificable con la pública); **cifrado RFC 8291 contra el vector
      del Apéndice A** (oráculo externo); DTO de suscripción sin keys. *(`push.test.ts`, 6/6.)*
- [x] Integración (Neon): `subscribe` upsert idempotente por `endpoint`; aislamiento por sesión;
      `410` → borrado; `rotatePassCredentials` → purge de suscripciones; fan-out entrega por
      `webpush` + `wallet` con canal `fake` y cuenta un cooldown. *(`web-push.neon.integration.test.ts`,
      6/6 en rama efímera.)*
- [x] Autorización: no se puede suscribir contra la sesión de otro consumidor.
- [x] Comandos: `pnpm run typecheck` (3/3), `pnpm run lint`, `pnpm run test` (136), integración Neon
      efímera (6/6), `pnpm run build` (3/3) — todos verdes por el implementador y por el revisor
      independiente por su cuenta.
- [ ] Manual (residual): **Android real** — suscribir en la pestaña, acreditar, ver la notificación
      rica con el browser cerrado. **iOS real** — añadir a inicio, abrir la PWA, dar permiso,
      acreditar, ver la notificación; y confirmar que el **escape hatch** da el pase sin instalar.
      *(Requiere cargar el secreto VAPID en Vercel — ver más abajo.)*

## Handoff requerido

Implementador + revisor independiente con el formato de `AGENT-WORKFLOW.md`. Foco del revisor: el
cifrado/VAPID **contra el vector del RFC** (cripto DIY), la no-fuga de keys, el aislamiento del
`subscribe` por sesión, el fan-out sin doble cooldown, el purge en la rotación, los **dos contextos
de iOS** (que no se intente suscribir desde Safari) y el **escape hatch**, y la migración aditiva.
Rama Neon efímera + migración `0022` verificada.
