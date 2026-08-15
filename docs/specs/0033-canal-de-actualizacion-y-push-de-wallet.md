---
spec: 0033
fecha: 2026-08-14
estado: cerrada
resumen: Canal de actualización y push del pase de Wallet — web service REST de PassKit (registro de dispositivos + APNs) para Apple y `addMessage`/`PATCH` para Google, alimentado por una cola `wallet_push_queue` (outbox transaccional escrito en el grant de 0030) con prioridad transaccional > campaña y cooldown por-consumidor (ADR 0037); un único slot "Última novedad" en el pase; más el mecanismo de rotación/revocación del pase (rotar `qr_token`/`web_view_token`) que invocará la recuperación por OTP de la 0032.
disjunta: no
archivos: apps/merchant/src/server/schema/consumer.ts, apps/merchant/src/server/wallet/*, apps/merchant/src/server/counter/orders.ts, apps/merchant/src/app/api/public/wallet/passkit/*, apps/merchant/src/app/api/internal/wallet-push/route.ts, apps/merchant/drizzle/0021_*.sql, apps/merchant/vercel.json
---

# 0033 — Canal de actualización y push de Wallet

> **Cerrada 2026-08-15** con el owner. Cuarta rebanada del "camino A" (ADR 0031). Depende de la
> spec **0029** (pase emitido con los ganchos `webServiceURL` + `authenticationToken` y el
> registro `wallet_pass`), del **ADR 0033** (proveedor de Wallet, notificaciones scopeadas por
> destinatario, ciclo de vida como identidad) y del **ADR 0037** (cola de push con prioridad y
> cooldown, outbox transaccional). El disparador de la rotación es la **spec 0032** (recuperación
> por OTP), aún en borrador: la 0033 provee el **mecanismo**, no la UX de recuperación.

## Problema

La spec 0029 emite el pase de identidad con los ganchos de actualización provisionados, pero
**nadie responde a esos ganchos**: el pase no se puede actualizar ni notificar. El loop de la
0031 ("La Gringa te dio un sello") no tiene canal de push. Además, ante **pérdida de
dispositivo** o cuenta olvidada, hoy no hay forma de **revocar/rotar** el pase.

Dos restricciones que el diseño tiene que respetar:

- El pase es **único y compartido** entre todos los programas del consumidor, **casi-estático**,
  con **un solo slot visible** "Última novedad" (ADR 0033). No hay campos de progreso por-programa.
- Dos negocios pueden notificar al **mismo** consumidor cerca en el tiempo. El aviso
  **transaccional** (acreditación 0030) debe ser **inmediato y preemptar** al de **campaña**
  (marketing, feature futura), que sale **después** respetando un espaciado (ADR 0037).

## Alcance

**Entra:**

- **Apple — web service REST de PassKit** que responde a los ganchos del pase (montado en
  `webServiceURL = /api/public/wallet/passkit`, ya fijado por la 0029): registrar/desregistrar un
  dispositivo, listar seriales actualizados desde un tag, servir la última versión del pase, y
  **autenticar cada request** con el `authenticationToken` del pase (`auth_token_hash` de
  `wallet_pass`). Tabla nueva de **registros de dispositivo** (device library id + push token APNs).
- **Apple — APNs**: push **vacío** (HTTP/2) que despierta al dispositivo a hacer pull; iOS muestra
  el `changeMessage` del campo "Última novedad". Auth por **JWT ES256** con la key `.p8` (secreto
  nuevo). El pase Apple gana el campo "Última novedad" con `changeMessage`.
- **Google — `addMessage`/`PATCH`** sobre el Loyalty Object para empujar el aviso (sin registro de
  dispositivos; sin secreto nuevo — el mismo service account de la emisión).
- **Cola de push `wallet_push_queue`** (ADR 0037): **outbox transaccional** escrito dentro de
  `persistGrant` (0030) para la clase `transactional`; **worker** de cron
  (`/api/internal/wallet-push`) que drena respetando **prioridad** (transaccional > campaña) y
  **cooldown por-consumidor**; **dispatch inmediato best-effort** del transaccional tras el commit.
  La clase `campaign` queda **provisionada** (enum + prioridad + cooldown), sin productor.
- **`PushChannel` intercambiable** (`apple` APNs / `google` addMessage / `fake`/`console`),
  seleccionado por entorno — el worker y los tests corren **sin pagar Apple**.
- **Notificaciones scopeadas por destinatario** (ADR 0033 §5): el conjunto alcanzable de un aviso
  se calcula desde `program_membership`; un no-miembro **no** es alcanzable. (Hoy el único
  productor es el transaccional, que ya es 1 consumidor; el scoping por conjunto lo estrena la
  feature de campañas — el helper de resolución de destinatarios se deja listo.)
- **Rotación/revocación del pase**: función que **rota** `qr_token` **y** `web_view_token`,
  **invalida** los registros de dispositivo del pase viejo y **re-empuja** el pase nuevo. La
  invoca la recuperación por OTP (spec 0032).

**No entra (cada uno su spec o feature):**

- **El otorgamiento** que dispara el aviso (spec 0030) — la 0033 solo **agrega el enqueue** en su
  transacción, no cambia su lógica de acreditación.
- **La UX de recuperación de cuenta** (spec 0032) — la 0033 expone el mecanismo de rotación; el
  flujo de OTP/verificación que lo dispara es 0032.
- **El contenido/UX de la landing en vivo y el dashboard rico** para consumidores (spec 0031).
- **La feature/productor de campañas de marketing** (futuro, tier Plus): la 0033 provisiona la
  clase `campaign` en la cola, no su origen.

## Diseño

### Especificación técnica

**Arquitectura y límites.** Todo vive bajo `apps/merchant/src/server/wallet/*` (lógica + canales
de push), rutas públicas de PassKit en `apps/merchant/src/app/api/public/wallet/passkit/*`, el
worker en `apps/merchant/src/app/api/internal/wallet-push/route.ts`. El único punto de contacto
con otra feature es el **enqueue outbox** dentro de `counter/orders.ts` (`persistGrant`, 0030).
No toca `core` ni `merchant_auth`. La firma/HTTP2 corre en runtime **Node** (no Edge).

**Modelo de datos** (esquema `consumer`; migración aditiva **0021**):

| Entidad | Campos / invariantes |
|---|---|
| `consumer_account` (**editar**) | + `latest_message` text **nullable** (texto del último aviso mostrado, ej. "La Gringa: +1 sello"); + `message_updated_at` timestamptz nullable (tag de "cambió el pase", base del `Last-Modified`/`passesUpdatedSince` de Apple); + `last_push_at` timestamptz nullable (base del cooldown). Ninguno serializa `qr_token`/`web_view_token`. |
| `wallet_push_device` (**crear**) | `id` uuid PK; `wallet_pass_id` → `wallet_pass.id` (on delete cascade); `device_library_id` text; `push_token` text (token APNs del dispositivo); `created_at`, `updated_at`. **unique (`device_library_id`, `wallet_pass_id`)** (idempotencia del registro PassKit). `push_token` **nunca se serializa** en un DTO. |
| `wallet_push_queue` (**crear**) | `id` uuid PK; `consumer_id` → `consumer_account.id` (on delete cascade); `class` text (`transactional`\|`campaign`); `title` text, `body` text (el aviso / "Última novedad"); `status` text (`pending`\|`sent`\|`failed`); `not_before` timestamptz **not null** (default now; el worker no envía antes); `attempts` int not null default 0; `last_error` text nullable; `created_at`, `sent_at` nullable. Índice `(status, not_before)`. |

**Enqueue outbox (0030).** Dentro de la transacción de `persistGrant`, tras persistir el pedido y
el saldo, se inserta **una** fila `wallet_push_queue` (`class='transactional'`, `not_before=now`,
`body` derivado de `unitsGranted`/`accrualKind`/nombre del negocio). Si el grant hace rollback, la
fila no existe (invariante del ADR 0037). Es aditivo: no cambia el contrato ni la idempotencia de
`grantAccrual` (un retry con el mismo `clientRequestId` **no** duplica el pedido → **no** duplica
el push, porque el insert de la cola va atado al insert del pedido en la misma tx idempotente).

**Worker + dispatch (ADR 0037).**

- **Dispatch inmediato best-effort:** tras commitear el grant, el request dispara (no bloqueante)
  el envío de esa fila `transactional`. Falla silenciosa → queda `pending` para el cron.
- **Cron `/api/internal/wallet-push`** (autenticado como los crons internos existentes; se agrega a
  `vercel.json`): selecciona filas `pending` con `not_before ≤ now`, las ordena **por consumidor**
  (transaccional por antigüedad, luego campaña por `not_before`), y para cada una:
  1. **Cooldown:** si `class='campaign'` y `now < last_push_at + COOLDOWN` → se reprograma
     (`not_before = last_push_at + COOLDOWN`) y se saltea. `transactional` no chequea cooldown.
  2. **Materializa el aviso:** actualiza `latest_message` + `message_updated_at` del consumidor;
     **Apple** → APNs vacío a cada `wallet_push_device` del pase Apple del consumidor; **Google**
     → `addMessage` sobre el Loyalty Object. Errores por dispositivo no abortan el resto.
  3. **Cierra:** `status='sent'`, `sent_at=now`, `last_push_at=now`; **empuja** el `not_before` de
     cualquier `campaign` pendiente del mismo consumidor a `now + COOLDOWN` (preempción).
  4. **Fallo:** `attempts++`, `last_error`, queda `pending` (backoff por `not_before`); tras N
     intentos → `failed` (observabilidad, no reintenta).
- `COOLDOWN_MINUTES` y `MAX_PUSH_ATTEMPTS` en constantes de entorno.

**Web service PassKit** (público; auth por `Authorization: ApplePass <token>` comparado en tiempo
constante contra `wallet_pass.auth_token_hash`; runtime Node):

| Método · Ruta (`/api/public/wallet/passkit/v1/...`) | Auth | OK | Errores |
|---|---|---|---|
| `POST /devices/{deviceLibraryId}/registrations/{passTypeId}/{serialNumber}` (body `{pushToken}`) | ApplePass | `201` alta nueva / `200` ya existía; upsert `wallet_push_device` | `401` token inválido; `404` serial inexistente |
| `DELETE /devices/{deviceLibraryId}/registrations/{passTypeId}/{serialNumber}` | ApplePass | `200`; borra el registro | `401`; `200` idempotente si no existía |
| `GET /devices/{deviceLibraryId}/registrations/{passTypeId}?passesUpdatedSince={tag}` | — (device-scoped) | `200 {lastUpdated, serialNumbers[]}` con los seriales cambiados desde `tag`; `204` si ninguno | — |
| `GET /passes/{passTypeId}/{serialNumber}` | ApplePass | `200` `.pkpass` con el campo "Última novedad" actual (`Last-Modified` = `message_updated_at`); `304` si `If-Modified-Since` ≥ tag | `401`; `404` |
| `POST /log` (body `{logs[]}`) | — | `200`; registra para observabilidad | — |

**APNs.** JWT **ES256** firmado con la key `.p8` (`node:crypto`), header `apns-topic` = Pass Type
ID (`pass.com.checkpass.identity`), body vacío (payload `{}` de PassKit), HTTP/2 contra
`api.push.apple.com` (`node:http2`). Token APNs inválido/expirado (410) → se borra el
`wallet_push_device`. Sin paquetes nuevos.

**Google.** `addMessage` (o `PATCH` del objeto) autenticado con el **mismo service account** de la
emisión (0029); sin registro de dispositivos ni secreto nuevo.

**Rotación/revocación.** Función `rotatePassCredentials(consumerId)`: en una transacción rota
`qr_token` **y** `web_view_token` (reusa `generateOpaqueToken`), **borra** los
`wallet_push_device` del consumidor (los dispositivos viejos dejan de recibir push) y **encola** un
push `transactional` de re-emisión (fuerza el pull del pase nuevo con el `qr_token` rotado). El
pase viejo queda inválido para escaneo (el `qr_token` viejo ya no resuelve — 0030) sin romper a
otros dispositivos legítimos, que reciben la versión nueva. La invoca la **spec 0032**.

**Autorización, aislamiento y no-fuga.**
- El web service se autoriza con el **token del pase** (bearer revocable vía `auth_token_hash`),
  como manda PassKit; sin token válido → `401`.
- **Rate-limit por `serial`/token del pase, NO por IP** (decisión de la 0033, coherente con 0028):
  los consumidores están detrás de NAT de carrier y los fetch los dispara el propio iOS; limitar
  por IP castigaría inocentes y chocaría con el polling del OS. El límite acá es anti-DoS (los
  endpoints devuelven el pase que el portador ya tiene), no autorización. Reusa el patrón de
  rate-limit de 0028, keyeado por serial.
- **Ningún DTO/respuesta serializa** `qr_token`, `web_view_token`, `token_hash`, `auth_token_hash`
  ni `push_token` en crudo (patrón anti-fuga del proyecto; test por entidad).

**Idempotencia y concurrencia.** El registro de dispositivo es upsert por
`(device_library_id, wallet_pass_id)`. El enqueue va atado a la idempotencia de `persistGrant`. El
worker toma filas con un update condicional (`status='pending' → 'sending'`) para no enviar dos
veces la misma bajo concurrencia dispatch-inline vs cron.

### Arquitectura de referencia

- **ADR 0033** — proveedor de Wallet, notificaciones scopeadas por destinatario, ciclo de vida
  como identidad, ganchos provisionados.
- **ADR 0037** — cola de push con prioridad transaccional > campaña, cooldown y outbox
  transaccional.
- **ADR 0013** — proveedores intercambiables (`PushChannel` como uno más).
- **ADR 0024** — secretos en entorno (APNs `.p8`).
- **ADR 0014** — QR opaco, revocable, al portador (base de la rotación).
- **Spec 0029** — pase emitido, `wallet_pass`, `auth_token_hash`, `webServiceURL`.
- **Spec 0030** — `persistGrant` (punto de enqueue).

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/server/schema/consumer.ts` | editar (`latest_message`/`message_updated_at`/`last_push_at` en `consumer_account`; tablas `wallet_push_device` + `wallet_push_queue`) |
| `apps/merchant/drizzle/0021_*.sql` | crear (migración aditiva: columnas + 2 tablas + índices) |
| `apps/merchant/src/server/wallet/push.ts` | crear (cola: enqueue, drenado con prioridad/cooldown, dispatch, rotación) |
| `apps/merchant/src/server/wallet/passkit.ts` | crear (lógica del web service: registro, list, serve, auth ApplePass) |
| `apps/merchant/src/server/wallet/apns.ts` | crear (cliente APNs: JWT ES256 + HTTP/2) |
| `apps/merchant/src/server/wallet/push-channel.ts` | crear (interfaz `PushChannel` + selección por entorno) |
| `apps/merchant/src/server/wallet/google.ts` | editar (`addMessage`/`PATCH` del objeto) |
| `apps/merchant/src/server/wallet/apple.ts` | editar (campo "Última novedad" + `changeMessage` en pass.json) |
| `apps/merchant/src/server/wallet/fake.ts` | editar (canal de push `fake`/`console`) |
| `apps/merchant/src/server/wallet/core.ts` | editar (DTOs anti-fuga de las entidades nuevas) |
| `apps/merchant/src/server/counter/orders.ts` | editar (enqueue outbox `transactional` en `persistGrant`) |
| `apps/merchant/src/app/api/public/wallet/passkit/v1/devices/[deviceLibraryId]/registrations/[passTypeId]/[serialNumber]/route.ts` | crear (`POST`/`DELETE`) |
| `apps/merchant/src/app/api/public/wallet/passkit/v1/devices/[deviceLibraryId]/registrations/[passTypeId]/route.ts` | crear (`GET` list) |
| `apps/merchant/src/app/api/public/wallet/passkit/v1/passes/[passTypeId]/[serialNumber]/route.ts` | crear (`GET` serve) |
| `apps/merchant/src/app/api/public/wallet/passkit/v1/log/route.ts` | crear (`POST`) |
| `apps/merchant/src/app/api/internal/wallet-push/route.ts` | crear (worker de cron) |
| `apps/merchant/vercel.json` | editar (cron `/api/internal/wallet-push`) |

### Disjunta?

**No.** Comparte archivos con specs vecinas:

- **`counter/orders.ts`** es de la **spec 0030** (`implementada`, no en curso) — el enqueue es un
  retoque aditivo; no colisiona con trabajo abierto.
- **`consumer.ts`** y `wallet/*` son de la **0028/0029** (`implementadas`).
- **spec 0032** (borrador, abierta) tocará `consumer_account` y consumirá `rotatePassCredentials`:
  **serializar** — la 0033 deja la función lista y la 0032 la invoca después. No arrancan en
  paralelo sobre `consumer.ts`.
- **spec 0031** (borrador, abierta) consume el canal pero su superficie es web (dashboard):
  colisión baja, pero **serializar** por prudencia (ambas tocan textos de aviso).

### Archivos compartidos

El orquestador deja listo antes de despachar: la migración **0021** (columnas + 2 tablas), los
secretos APNs en el entorno de test (o el canal `fake`), y el `PushChannel` seleccionable por
entorno para que los tests corran sin APNs real.

## Definition of Done

La feature está terminada solo con estos criterios observables, verificados por el revisor
independiente:

- [ ] Acreditar en mostrador (0030) **encola** una fila `wallet_push_queue` `transactional` en la
      **misma transacción** del grant; un rollback del grant **no** deja fila; un retry idempotente
      (mismo `clientRequestId`) **no** duplica la fila.
- [ ] El worker `/api/internal/wallet-push` drena `pending`: envía el `transactional` de inmediato
      y **preempta** un `campaign` en cola del mismo consumidor (el campaign sale recién tras el
      cooldown). Verificado con reloj inyectable en integración.
- [ ] Cooldown por-consumidor respetado: dos `campaign` seguidos al mismo consumidor no salen a
      menos de `COOLDOWN_MINUTES`; un `transactional` siempre sale sin esperar.
- [ ] Web service PassKit: `POST/DELETE registrations` hace upsert/borrado idempotente de
      `wallet_push_device`; `GET registrations?passesUpdatedSince` lista los seriales cambiados (o
      `204`); `GET passes/...` sirve el `.pkpass` con "Última novedad" actual y responde `304` con
      `If-Modified-Since`. Sin `Authorization: ApplePass` válido → `401`.
- [ ] APNs: se arma el JWT ES256 con la `.p8` (verificado con la pública en unit) y se envía un
      push vacío por HTTP/2; un `410` borra el `wallet_push_device`. Con canal `fake` end-to-end
      sin APNs real.
- [ ] Google: `addMessage`/`PATCH` sobre el objeto con el service account de emisión; verificado
      con canal `fake` (llamada bien formada), real como residual de QA.
- [ ] `rotatePassCredentials` rota `qr_token` **y** `web_view_token`, borra los
      `wallet_push_device` del consumidor y encola un push de re-emisión; el `qr_token` viejo deja
      de resolver (0030) y los tokens nuevos son distintos y URL-safe.
- [ ] Rate-limit por serial (no IP) en el web service; supera el límite → `429`.
- [ ] Ningún DTO/respuesta serializa `qr_token`/`web_view_token`/`token_hash`/`auth_token_hash`/
      `push_token` en crudo (test por entidad).
- [ ] Migración `0021` aditiva aplicada y verificada en rama Neon efímera **y** en prod: existen
      las 3 columnas + `wallet_push_device` + `wallet_push_queue` con sus índices/uniques;
      `core`/`merchant_auth` intactos.

## Plan de pruebas y verificación

- [ ] Unidad: el JWT APNs es ES256, `apns-topic` = Pass Type ID, payload PassKit vacío; firma
      verificable con la pública.
- [ ] Unidad: el drenado de la cola ordena por prioridad y respeta/saltea el cooldown según clase
      (reloj inyectable); la preempción empuja el `not_before` del campaign.
- [ ] Unidad: DTOs de `wallet_push_device`/`wallet_push_queue` no exponen `push_token` ni tokens.
- [ ] Integración (Neon, rama efímera): `persistGrant` deja pedido **y** fila de cola atómicamente;
      rollback no deja fila; retry idempotente no duplica.
- [ ] Integración: `POST registrations` upsert idempotente; `GET registrations?passesUpdatedSince`
      devuelve el serial tras un cambio; `GET passes` responde `200`/`304`; `401` sin token.
- [ ] Integración: `rotatePassCredentials` rota ambos tokens, borra devices y encola re-emisión;
      el `qr_token` viejo no resuelve en el escaneo de 0030.
- [ ] Autorización/aislamiento: token ApplePass de un pase no accede al pase de otro; rate-limit
      por serial → `429`.
- [ ] Comandos exactos: `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit), integración Neon en rama
      efímera, `pnpm build`, `drizzle-kit migrate` de la `0021` verificada por SQL.
- [ ] Verificación manual (residual, no gate del PASS): **Android real** — acreditar y ver la
      notificación de Google Wallet con el aviso. **iPhone real** — con la `.p8` cargada, acreditar
      y ver la notificación de PassKit / el pase con "Última novedad" actualizada. Rotación:
      recuperar (simulado) invalida el pase viejo.

## Handoff requerido

Implementador y revisor usan el formato de `docs/AGENT-WORKFLOW.md`. El revisor produce un `PASS`
independiente —foco en: la atomicidad del enqueue outbox dentro de `persistGrant`, la idempotencia
del worker bajo dispatch-inline vs cron, la auth `ApplePass` + rate-limit por serial, la no-fuga de
tokens/`push_token`, y la corrección del JWT APNs— antes de marcar `implementada`. Rama Neon
efímera + migración `0021` verificada en efímera y prod. **Antes de codear bajo codex:** no hace
falta re-warmear el store (sin paquetes nuevos); sí cargar la `.p8`/Key ID/Team ID en el entorno
de prueba **o** correr con canal `fake`.

## Abierto

- **Nada bloquea el cierre.** Residuales acotados que no impiden implementar:
  - **Envío APNs/Google real** requiere la `.p8` (ya generada por el owner) cargada en Vercel y el
    QA en dispositivos reales — el código se verifica end-to-end con el canal `fake`; el push real
    es QA residual, no gate del PASS.
  - **El productor de campañas** no existe: la clase `campaign` se prueba **inyectando** filas de
    cola en test (no hay UI que las cree todavía). Es a propósito (ADR 0037).
  - **El disparador de la rotación** (recuperación por OTP) es la **spec 0032**: la 0033 entrega
    `rotatePassCredentials` con sus tests; el flujo que lo llama llega con 0032.
