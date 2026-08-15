---
spec: 0037
fecha: 2026-08-15
estado: borrador
resumen: Segundo transporte de notificación — Web Push del navegador (Push API + Service Worker + VAPID), **solo Android** — para dar notificaciones de contenido controlado donde el pase de Google muestra un banner genérico. Separa claramente "notificar vía wallet" (0033) de "vía browser" bajo un modelo de aviso común (ADR 0038): tabla `web_push_subscription`, canal `PushChannel` `webpush`, service worker, captura de suscripción Android, fan-out del aviso transaccional a los transportes que el consumidor tenga, y la dimensión de transporte provisionada para que las campañas futuras elijan wallet/browser.
disjunta: no
archivos: apps/merchant/src/server/schema/consumer.ts, apps/merchant/src/server/wallet/push-channel.ts, apps/merchant/src/server/wallet/push.ts, apps/merchant/src/server/push/*, apps/merchant/src/app/api/public/push/subscribe/route.ts, apps/merchant/public/sw.js (o ruta equivalente), apps/merchant/drizzle/0022_*.sql
---

# 0037 — Web Push (notificaciones de navegador, Android)

> **Nada de código empieza sin esta spec en `cerrada`.** Está en `borrador`: la sección
> **Abierto** tiene decisiones que hay que cerrar con el owner antes de codear.
>
> Cuarta rebanada del canal de notificación. Depende de la spec **0033** (cola + worker + canal de
> push), del **ADR 0037** (outbox/prioridad/cooldown) y del **ADR 0038** (dos transportes: `wallet` y
> `webpush`, Web Push solo Android). La captura del permiso vive en una superficie de consumidor que
> hoy es la landing de enrolamiento (0028) y mañana el dashboard (0031).

## Problema

El pase de Wallet (0033) notifica **rico en iOS** (Apple renderiza el `changeMessage`) pero
**pobre en Android**: Google `addMessage` muestra un **banner genérico** ("Mensaje nuevo / Presiona
para ver el pase") y el texto real queda **dentro del pase** — el emisor no controla el banner
(verificado en QA del owner, 2026-08-15). Hoy **no hay** ningún canal que muestre en la pantalla de
un Android el texto "Se acreditaron 10 puntos en tu cuenta 🎉" sin instalar una app.

## Alcance

**Entra:**
- **Transporte Web Push** (Push API + Service Worker + VAPID) como **segundo transporte** junto al
  `wallet` de 0033 (ADR 0038): claves VAPID, service worker, cifrado de payload, envío al endpoint.
- **Captura de suscripción, solo Android**: prompt de permiso en una superficie de consumidor,
  registro de la `PushSubscription` en el backend. UA no-Android → no se ofrece (iOS lo cubre el pase).
- **Tabla `web_push_subscription`** (N por consumidor) + canal `PushChannel` `webpush` intercambiable
  (`fake` para test) seleccionado por entorno.
- **Fan-out del aviso transaccional**: al acreditar (0030), el aviso sale por el pase (como hoy) **y
  además por Web Push** si el consumidor tiene suscripciones Android — con el texto rico controlado.
- **Dimensión de transporte provisionada** en el modelo de la cola para que las campañas futuras
  elijan `wallet`/`webpush`/ambos (sin construir el productor de campañas).
- **Baja de suscripción muerta**: `404`/`410` del endpoint borra la fila (como el `410` de APNs).

**No entra (cada uno su spec o feature):**
- **Web Push en iOS** (exige PWA en pantalla de inicio; el pase de Apple ya notifica bien) — diferido.
- **El productor/UI de campañas de marketing** — la 0037 provisiona el transporte, no su origen.
- **El dashboard rico "Ver mis programas"** (spec 0031) — aunque el prompt de permiso puede vivir ahí.
- **La lógica de acreditación** (0030) — la 0037 solo suma el fan-out del aviso ya encolado.

## Diseño

### Especificación técnica

**Arquitectura y límites.** Nuevo dominio `apps/merchant/src/server/push/*` (VAPID, cifrado, canal
`webpush`, suscripciones). Reutiliza la cola/worker de 0033 (`wallet/push*.ts`) — el worker, al
entregar un aviso, hace fan-out a **todos los transportes** del consumidor: el pase (0033) y las
suscripciones Web Push (0037). Runtime **Node**. No toca `core` ni `merchant_auth`.

**Modelo de datos** (esquema `consumer`; migración aditiva **0022**):

| Entidad | Campos / invariantes |
|---|---|
| `web_push_subscription` (**crear**) | `id` uuid PK; `consumer_id` → `consumer_account.id` (on delete cascade); `endpoint` text **unique** (URL del push service del navegador); `p256dh_key` text, `auth_key` text (claves de cifrado del cliente, RFC 8291); `user_agent` text; `created_at`, `last_seen_at`. **`endpoint`, `p256dh_key`, `auth_key` NUNCA se serializan** en un DTO. |
| cola de aviso (**editar**, ADR 0038) | dimensión de **transporte** para que un aviso pueda dirigirse a `wallet`, `webpush` o ambos. El transaccional apunta a "todos los transportes del consumidor"; la campaña (futura) elige. Forma concreta = decisión abierta (ver **Abierto**). |

**Canal `webpush`.** Cifra el payload (RFC 8291/8188, `aes128gcm`) y hace `POST` al `endpoint` con
el JWT VAPID (RFC 8292). Un `201/202` = entregado al push service; `404/410` = suscripción muerta →
se borra la fila. Errores por suscripción no abortan el resto (igual que APNs por-dispositivo en 0033).

**Service worker.** Sirve un `sw.js` en scope raíz que escucha `push` (muestra la notificación con
título = negocio, cuerpo = el aviso) y `notificationclick` (abre la landing/pase). El registro del SW
y la suscripción se hacen desde el cliente en la superficie de consumidor, **solo si UA Android**.

**Captura de suscripción.** `POST /api/public/push/subscribe` (autenticada con la cookie de sesión
de consumidor de 0028): recibe la `PushSubscription` (endpoint + keys), hace upsert por `endpoint`,
la asocia al consumidor de la sesión. Anti-fuga: la respuesta no devuelve keys.

**VAPID.** Par de claves en entorno (`WEB_PUSH_VAPID_PUBLIC_KEY` / `WEB_PUSH_VAPID_PRIVATE_KEY` +
subject `mailto:`). La pública va al cliente; la privada firma el JWT VAPID. Sin claves → el canal
queda deshabilitado (no se ofrece el prompt), análogo a 503 de proveedores no configurados.

**Fan-out y cooldown.** El worker entrega un aviso a los transportes del consumidor; el **cooldown es
por consumidor y por aviso**, no por transporte (un aviso por pase + Web Push cuenta como **uno**).

**Autorización y no-fuga.** La suscripción se crea contra la sesión del consumidor (no se puede
suscribir a otro). Ningún DTO/respuesta serializa `endpoint`/`p256dh_key`/`auth_key` (test por
entidad).

### Arquitectura de referencia

- **ADR 0038** — dos transportes (`wallet`/`webpush`), Web Push Android-only, campañas eligen transporte.
- **ADR 0037** — cola outbox, prioridad, cooldown (se reutiliza).
- **ADR 0013** — proveedores/canales intercambiables (`webpush` como uno más).
- **ADR 0024** — secretos en entorno (VAPID).
- **Spec 0033** — cola + worker + `PushChannel` + fan-out.
- **Spec 0028** — sesión de consumidor (autoriza el `subscribe`).

Fuentes de conversión (2026-08-15): pase de Wallet ~90% open rate; Web Push opt-in ~5–6% (10–15%
con buen prompt), open ~34% promocional / ~65% automatizado, CTR ~2–7%.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/schema/consumer.ts` | editar (`web_push_subscription`) |
| `apps/merchant/drizzle/0022_*.sql` | crear (migración aditiva: tabla + índices; + transporte en la cola) |
| `apps/merchant/src/server/push/vapid.ts` | crear (JWT VAPID) |
| `apps/merchant/src/server/push/webpush-channel.ts` | crear (cifrado RFC 8291 + envío; canal `webpush` + `fake`) |
| `apps/merchant/src/server/push/subscriptions.ts` | crear (upsert/borrado/lectura + DTO anti-fuga) |
| `apps/merchant/src/server/wallet/push.ts` / `push-worker.ts` | editar (fan-out del aviso a los transportes) |
| `apps/merchant/src/app/api/public/push/subscribe/route.ts` | crear (`POST`, sesión de consumidor) |
| `apps/merchant/public/sw.js` (o ruta) | crear (service worker: `push` + `notificationclick`) |
| superficie de consumidor (enroll `done` / dashboard 0031) | editar (registro SW + prompt Android) |

### Disjunta?

**No.** Toca `wallet/push*.ts` (0033) y `consumer.ts`/`schema` (0028/0033), y se cruza con la
**spec 0031** (borrador) si el prompt vive en el dashboard. **Serializar** con 0031; 0033 ya está
implementada (retoque aditivo del fan-out).

## Definition of Done

- [ ] Un Android suscripto recibe, al acreditarle puntos (0030), una **notificación de contenido
      controlado** ("Se acreditaron X puntos en tu cuenta 🎉") **además** del aviso del pase.
- [ ] El prompt/suscripción **solo** se ofrece en UA Android; iOS no lo ve.
- [ ] `POST /api/public/push/subscribe` hace upsert por `endpoint` contra la sesión del consumidor;
      no permite suscribir a otro consumidor.
- [ ] Un `404`/`410` del push service borra la `web_push_subscription`.
- [ ] El JWT VAPID es válido (verificable con la clave pública) y el payload va cifrado (RFC 8291).
- [ ] El cooldown cuenta un aviso multi-transporte como **uno**.
- [ ] Ningún DTO serializa `endpoint`/`p256dh_key`/`auth_key` (test por entidad).
- [ ] Migración `0022` aditiva aplicada y verificada en rama efímera y prod; `core`/`merchant_auth`
      intactos.

## Plan de pruebas y verificación

- [ ] Unidad: JWT VAPID (firma verificable con la pública); cifrado RFC 8291 (vector conocido);
      DTO de suscripción sin keys.
- [ ] Integración (Neon): `subscribe` upsert idempotente por `endpoint`; aislamiento por sesión;
      `410` → borrado; fan-out entrega por `webpush` + `wallet` con canal `fake` y cuenta un cooldown.
- [ ] Autorización: no se puede suscribir contra la sesión de otro consumidor.
- [ ] Comandos: `pnpm typecheck`, `pnpm lint`, `pnpm test`, integración Neon efímera, `pnpm build`.
- [ ] Manual (residual): Android real — suscribir en la landing, acreditar, ver la notificación rica
      con el browser cerrado. iOS — confirmar que NO se ofrece el prompt.

## Handoff requerido

Implementador + revisor independiente con el formato de `AGENT-WORKFLOW.md`. Foco del revisor: el
cifrado/VAPID, la no-fuga de keys, el aislamiento del `subscribe` por sesión, el fan-out sin doble
cooldown, y la migración aditiva. Rama Neon efímera + migración `0022` verificada.

## Abierto

Bloquea el cierre hasta resolverlo con el owner:

- **Dónde vive el prompt de permiso** y su UX: ¿landing de enrolamiento (0028, pantalla `done`) o el
  dashboard "Ver mis programas" (0031)? ¿Soft pre-prompt antes del permiso nativo del navegador?
- **Forma de la dimensión de transporte en la cola**: (a) columna `transport` en la cola de 0033, (b)
  entrega-a-todos-los-transportes para el transaccional + selección explícita recién con campañas, o
  (c) cola separada. Recomendación: **(b)** — el transaccional hace fan-out a todo lo que el consumidor
  tenga; la selección `wallet`/`browser` se agrega como filtro cuando llegue el productor de campañas.
- **Paquete de Web Push**: ¿`web-push` (probado, RFC 8291/8292 resueltos, **suma dependencia** → re-warm
  del store de pnpm) o implementación con `node:crypto`? Recomendación: `web-push`.
- **Hosting del service worker** en el dominio de `apps/merchant` (scope, cache, versión).
- **¿El transaccional a Android debería salir SOLO por Web Push** (evitar el doble aviso pase+browser)
  o por ambos? Recomendación: ambos por ahora (el pase igual actualiza su "Última novedad"); revisable.
