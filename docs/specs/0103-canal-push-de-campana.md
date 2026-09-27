---
spec: 0103
fecha: 2026-09-26
estado: implementada
resumen: Spec B1 — canal push de campaña para las plantillas #3/#5 (implementa el ADR 0095). `enable` recibe `channels` (proximidad, push o ambos; default ambos); el tick decide envios en `core.campaign_push` (holdout 10 %, grupos #5 > #3 desde la ultima visita) y encola `campaign` en `wallet_push_queue`; el worker re-chequea al entregar (cancela o reprograma al horario del negocio), entrega como el transaccional, emite el cupon y marca `sent_at`; click por Web Push; conversion a 7 dias en resultados; `GET/PATCH /api/marketing/settings` para el horario. Migracion `0046`.
disjunta: si
archivos: apps/merchant/drizzle/0046_*, apps/merchant/src/server/schema/{campaign,campaign-coupon,campaign-push,business,consumer,index}.ts, apps/merchant/src/server/marketing/{templates,template-input,template-store,audience-store,tick,campaign-store,results,results-store}.ts + nuevos push-*.ts, apps/merchant/src/server/wallet/{push,push-transports}.ts, apps/merchant/src/server/push/webpush-channel.ts, apps/merchant/public/sw.js, apps/merchant/src/app/api/marketing/settings/route.ts, apps/merchant/src/app/api/public/push/click/route.ts, docs/specs/0101-contratos-de-api.md
---

# 0103 — Canal push de campaña (B1)

> Implementa el **ADR 0095**. Decisiones del owner en `docs/TASKS.md` (bloque B y bloque B1). Lo
> marcado *(ORQUESTADOR)* no lo decidio el owner y se le informa al pedir el OK.

## Problema

Las plantillas «Te extrañamos» (#3) y «Recuperar perdidos» (#5) solo alcanzan por proximidad: al
cliente que tiene pase **y** pasa cerca de una puerta con coordenadas. Un cliente dormido que no pasa
por la puerta no se entera nunca. La clase `campaign` de `consumer.wallet_push_queue` existe pero no
tiene productor (`wallet/push-transports.ts:211`, fan-out provisional), la cola no sabe de que campaña
es una fila, el click de un Web Push no se registra (`public/sw.js:24-43` solo navega) y los resultados
no tienen como medir un push.

## Alcance

**Entra:**
- Canales por campaña (`channel_proximity`/`channel_push`) y `channels` en `enable` de plantillas.
- Decision de envio en el tick (`core.campaign_push`), holdout 10 %, regla de grupos, horario del
  negocio.
- Gate al entregar en el worker (cancelar / reprogramar / enviar), transporte = transaccional, cupon
  por push, `sent_at`.
- Click por Web Push: `sw.js` + `POST /api/public/push/click`.
- Resultados: bloque `push` en `GET /api/marketing/campaigns/{id}/results`.
- `GET`/`PATCH /api/marketing/settings` (horario de push).
- Contrato escrito en `docs/specs/0101-contratos-de-api.md`.

**No entra:**
- Push en campañas custom del compositor (decision del owner: solo plantillas). El compositor sigue
  creando `proximity=true, push=false` y `POST/PATCH /api/marketing/campaigns` NO aceptan canales.
- Plantillas #7/#8 (B2) y #4 (C). El catalogo de grupos se deja preparado (`group`/`rank`) pero solo
  con #3 y #5.
- Tope global o por negocio de frecuencia (el owner lo revoco «hasta que entendamos como aplicarlo»).
- Foto de audiencia del push (exclusiones por tick): `campaign_tick_audience` sigue siendo de
  proximidad. Declarado.
- Click de Apple/Google Wallet (no existe la señal).
- UI (ADR 0070: la construye el owner). Borrar UI vieja: no hay UI de canales que borrar.
- Migrar prod (lo hace el orquestador con OK del owner, despues del PASS).

## Diseño

### Especificación técnica

#### 1. Migracion `0046_canal_push_de_campana.sql` (via `drizzle-kit generate`)

- `core.campaign`: `channel_proximity boolean not null default true`, `channel_push boolean not null
  default false`, `check core_campaign_channel_check (channel_proximity or channel_push)`.
- `core.business`: `push_window_start_hour integer not null default 9`, `push_window_end_hour integer
  not null default 21`, `check core_business_push_window_check (push_window_start_hour between 0 and
  23 and push_window_end_hour between 1 and 24 and push_window_start_hour < push_window_end_hour)`.
- **`core.campaign_push`** (tabla nueva, `schema/campaign-push.ts`):
  `id uuid pk default random`, `campaign_id → core.campaign` not null, `business_id → core.business
  on delete cascade` not null, `consumer_id → consumer.consumer_account` not null, `membership_id →
  consumer.program_membership` not null, `holdout boolean not null`, `queue_id →
  consumer.wallet_push_queue on delete set null` nullable, `decided_at timestamptz not null`,
  `sent_at`, `clicked_at`, `cancelled_at timestamptz` nullable, `cancel_reason text` nullable.
  Checks: `cancel_reason is null or in ('campaign_inactive','membership_gone','opt_out','visited')`;
  `(cancel_reason is null) = (cancelled_at is null)`; `not holdout or (queue_id is null and sent_at is
  null)`; `clicked_at is null or sent_at is not null`. Indices: unique `(queue_id)`; `(business_id,
  consumer_id, decided_at)` (regla de grupos); `(campaign_id)`.
- `core.campaign_coupon`: `push_id uuid → core.campaign_push` nullable, unique `(push_id)` (no
  parcial), `check core_campaign_coupon_single_origin_check (turn_id is null or push_id is null)`.
- `consumer.wallet_push_queue`: `wallet_push_queue_status_check` pasa a `('pending','sending','sent',
  'failed','cancelled')`.

Prod: `core.campaign` tiene filas (0101/0102 en prod) → los defaults dejan las existentes en
proximidad sola, que es lo que son hoy.

#### 2. Catalogo (`marketing/templates.ts`)

`TemplateDefinition` pierde `channel: "proximity"` y gana `channels: readonly ("proximity" |
"push")[]` (las dos para #3 y #5), `group: "reactivation"` y `rank: number` (#3 = 1, #5 = 2; el #4
futuro sera 3). Export nuevo `templateKeysAtOrAbove(template): TemplateKey[]` = las claves del mismo
grupo con `rank >= template.rank`.

#### 3. `enable` (`template-input.ts`, `template-store.ts`)

- Cuerpo nuevo opcional `channels`: arreglo no vacio de `"proximity"`/`"push"` sin repetidos.
  Ausente o `null` → `["proximity","push"]`. Otra cosa → `400 validation` con
  `fields.channels = "Elegí al menos un canal válido."`. `TemplateInput` gana `channelProximity` y
  `channelPush` (booleans).
- `no_usable_location` (409) solo si `channelProximity`. Solo-push sin puertas usables: se crea sin
  filas en `campaign_location` (no se llama `insert` con arreglo vacio).
- El `insert` escribe los dos booleans. El DTO `Campaign` (`campaign-store.ts`) gana `channels:
  ("proximity"|"push")[]` (en ese orden). `GET /api/marketing/templates` gana `channels` (los del
  catalogo) por plantilla; su `live` ya es un `Campaign` y trae los suyos.

#### 4. Tick (`marketing/tick.ts` + archivo nuevo `marketing/push-audience.ts` y `push-store.ts`)

- **Proximidad:** `loadActiveCampaigns` agrega `eq(campaigns.channelProximity, true)`. Una campaña
  solo-push no encola turnos ni escribe foto de audiencia.
- **Paso nuevo, «1b push»**, dentro de la misma transaccion y DESPUES del paso 1: campañas `active`,
  en fecha, `channel_push = true` y `template_key is not null`, ordenadas por `rank` desc (del
  catalogo), despues `created_at`, `id`. Por cada una:
  1. Candidatos: las membresias del negocio con `marketingOptOutAt`, `enrolledAt`, `lastOrderAt`
     (como `loadAudienceCandidates`), **`pushReachable`** = existe `wallet_push_device` de un pase
     Apple del consumidor, O un `wallet_pass` Google, O una `web_push_subscription` (mismo criterio que
     `consumerHasReachableWallet` mas Web Push) y **`lastGroupDecisionAt`** = `max(decided_at)` de
     `campaign_push` NO cancelados (`cancelled_at is null`) del mismo negocio y consumidor cuya campaña
     tenga `template_key in templateKeysAtOrAbove(template)`. SQL crudo con alias propios (gotcha de
     subconsulta correlacionada, `audience-store.ts:110-119`).
  2. Decision PURA `decidePushEligibility(candidate, { now, dormantDays })` en orden: `opt_out` →
     `not_reachable` → `not_dormant` (misma `dormantSince` = `max(enrolledAt, lastOrderAt)` que
     `audience.ts`) → `already_reached` (`lastGroupDecisionAt >= dormantSince`) → `eligible`.
  3. Por cada elegible, `holdout = random() < 0.1` (el `random` del tick, inyectable). Holdout →
     inserta `campaign_push` con `holdout=true`, sin cola. No holdout → inserta la fila de cola
     (`class='campaign'`, `title` = nombre del negocio, `body` = `pushBody(message, couponLabel)`,
     `not_before = nextSendableAt(now, business.timezone, start, end)`) y el `campaign_push` con su
     `queue_id` y `decided_at = now`.
- `TickSummary` gana `pushDecided` y `pushHeld`.
- **Idempotencia:** un segundo tick con el mismo reloj ve las filas recien insertadas como
  `already_reached` → cero filas nuevas. Sin unico: lo sostiene la regla de grupos + el lock del tick.

#### 5. Funciones puras nuevas (`marketing/push-text.ts`, `marketing/push-window.ts`)

- `pushBody(message, couponLabel)`: `message` si `couponLabel` es `null`, si no `${message} ·
  ${couponLabel}` (≤ 60 + 3 + 40).
- `isInPushWindow(at, timeZone, start, end)`: hora local (`Intl.DateTimeFormat` con `hourCycle:
  "h23"`) en `[start, end)`.
- `nextSendableAt(now, timeZone, start, end)`: `now` si esta en el horario; si no, el primer instante
  en punto posterior a `now` cuya hora local es `start` (avanzando de a una hora UTC, maximo 48 pasos;
  si no lo encuentra, lanza — es un bug, no un caso).

#### 6. Worker (`wallet/push.ts` + archivo nuevo `marketing/push-delivery.ts`)

`deliverClaimed`, para `claim.class === "campaign"` y ANTES de escribir `latest_message`, llama a
`gateCampaignPush(queueId, now)` (en marketing; `push.ts` esta en 257 lineas: la logica no entra ahi).
Lee la fila `campaign_push` por `queue_id` con su campaña, negocio y membresia, y devuelve, en orden:

1. sin fila `campaign_push` → `send` sin `clickId` (fila `campaign` huerfana: no deberia existir; no se
   pierde el aviso).
2. campaña `status <> 'active'` o `ends_at <= now` → `cancel campaign_inactive`.
3. no existe la membresia → `cancel membership_gone`.
4. `marketing_opt_out_at is not null` → `cancel opt_out`.
5. existe `core."order"` del negocio y consumidor con `created_at > decided_at` → `cancel visited`.
6. `!isInPushWindow(now, …)` → `reschedule` a `nextSendableAt(now, …)`.
7. si no → `send` con `clickId = campaign_push.id`.

Efectos: `cancel` → cola `status='cancelled'`, `last_error = reason`; `campaign_push.cancelled_at =
now`, `cancel_reason`; no toca `consumer_account`. `reschedule` → cola `status='pending'`,
`not_before`; nada mas. `send` → camino actual, y despues de cerrar la fila `sent` llama
`recordCampaignPushSent(pushId, now)`: `sent_at = now` y emite el cupon (§7). Si la entrega LANZA, el
camino de reintento actual no cambia y `sent_at` queda `null`.

#### 7. Cupon por push (`marketing/coupon-issue.ts`)

Funcion pura `pushCouponToIssue({ pushId, holdout, couponLabel, couponCost, endsAt, sentAt,
hasUnredeemedCoupon })` → `null` si holdout, sin label, `endsAt` null o `<= sentAt`, o
`hasUnredeemedCoupon`; si no `{ pushId, labelSnapshot, costSnapshot ?? "0.00", validFrom: sentAt,
validUntil: endsAt }`. `hasUnredeemedCoupon` = existe `campaign_coupon` de esa campaña y consumidor sin
`coupon_redemption`. Insert con `on conflict (push_id) do nothing`.

#### 8. Transporte (`wallet/push-transports.ts`)

`planTransports("campaign", reachable)` = la misma rama que `transactional`; se borra el fan-out.
`deliverTransports` calcula `consumerHasReachableWallet` para `transactional` **y** `campaign`, y
recibe `opts.clickId?: string`, que viaja en el payload Web Push. `WebPushPayload` gana `clickId?`.

#### 9. Click

- `public/sw.js` guarda `clickId` en `notification.data`; en `notificationclick`, si existe, hace
  `fetch("/api/public/push/click", { method: "POST", headers: {"content-type":"application/json"},
  body: JSON.stringify({ id }), keepalive: true })` dentro del mismo `waitUntil`, sin bloquear la
  navegacion ni fallar si el fetch falla (`catch` vacio).
- `POST /api/public/push/click` (sin sesion): cuerpo `{ id: uuid }`. `update core.campaign_push set
  clicked_at = coalesce(clicked_at, now()) where id = $1 and sent_at is not null`. Responde **204
  siempre** que el cuerpo tenga un uuid (exista o no: no revela ids); cuerpo invalido → `400
  invalid_body`.

#### 10. Resultados (`results.ts`, `results-store.ts`)

`CampaignResults` gana `push: null` si la campaña no tiene `channel_push`, si no:

```ts
push: {
  quality: "observada";
  decided: number;      // campaign_push de la campaña
  held: number;         // holdout
  pending: number;      // no holdout, sin sent_at ni cancelled_at
  sent: number;
  cancelled: { campaign_inactive: number; membership_gone: number; opt_out: number; visited: number };
  clicked: number;      // solo Web Push
  conversion: {
    windowDays: 7;
    sent: { purchases: number; of: number };  // enviados con sent_at + 7 d <= now
    held: { purchases: number; of: number };  // holdout con decided_at + 7 d <= now
  };
  effect: EffectLine;   // estimateEffect({placedN: sent.of, placedPurchases: sent.purchases, holdoutN: held.of, holdoutPurchases: held.purchases})
}
```

«Compro» = existe `core."order"` del negocio y consumidor con `created_at` en `(t0, t0 + 7 d]`, con
`t0 = sent_at` (enviados) o `decided_at` (holdout). El bloque `coupon` existente ya cuenta canjes por
`coupon_redemption.campaign_id` (`results-store.ts:97-103`): incluye los cupones del push sin cambios.

#### 11. `GET`/`PATCH /api/marketing/settings`

Guard `requireMarketingOwner` (delegable, como `enable`). `GET` → `200 { settings: { pushWindow: {
startHour, endHour }, timeZone } }`. `PATCH` cuerpo `{ pushWindow: { startHour, endHour } }` enteros;
invalido (no entero, fuera de rango, `start >= end`) → `400 validation` con `fields.pushWindow`;
ok → `200` con la misma forma que `GET`. Solo toca el negocio de la sesion.

### Arquitectura de referencia

ADR 0037/0038/0040 (cola, transportes, ruteo por clase), 0064 (motor, medicion honesta), 0065
(holdout), 0091/0092 (plantillas), 0093/0094 (cupon), **0095** (este canal).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/0046_canal_push_de_campana.sql` + `meta/` | crear (generate) |
| `src/server/schema/campaign.ts`, `business.ts`, `campaign-coupon.ts`, `consumer.ts`, `index.ts` | editar |
| `src/server/schema/campaign-push.ts` | crear |
| `src/server/marketing/templates.ts`, `template-input.ts`, `template-store.ts`, `campaign-store.ts` | editar |
| `src/server/marketing/audience-store.ts`, `tick.ts` | editar |
| `src/server/marketing/push-audience.ts`, `push-store.ts`, `push-window.ts`, `push-text.ts`, `push-delivery.ts` | crear |
| `src/server/marketing/coupon-issue.ts`, `results.ts`, `results-store.ts` | editar |
| `src/server/wallet/push.ts`, `push-transports.ts`, `src/server/push/webpush-channel.ts` | editar |
| `public/sw.js` | editar |
| `src/app/api/marketing/settings/route.ts`, `src/app/api/public/push/click/route.ts` | crear |
| tests: unit al lado de cada modulo puro; integracion `marketing-push*.neon.integration.test.ts` | crear |
| `docs/specs/0101-contratos-de-api.md` | editar (contrato) |

(Rutas relativas a `apps/merchant/` salvo `docs/`. Todo archivo ≤ 300 lineas: si `wallet/push.ts`
pasa, se divide.)

### Disjunta?

Si. La unica spec abierta en paralelo es la 0100 (`app/backoffice/loyalty/**`, otra sesion): sin
archivos comunes.

### Archivos compartidos

Ninguno que el orquestador tenga que dejar listo.

## Definition of Done

- [ ] Migracion `0046` generada y aplicada en la rama de CI por `tools/neon-test.sh`.
- [ ] `enable` sin `channels` crea `proximity+push`; `["push"]` crea solo-push y NO da
  `no_usable_location` en un negocio sin puertas con coordenadas; `[]`/`["sms"]`/repetidos → 400
  `validation` con `fields.channels`.
- [ ] Una campaña solo-push no encola turnos; una solo-proximidad no decide envios.
- [ ] El tick decide UN `campaign_push` por cliente elegible, ~10 % holdout sin cola; un segundo tick
  no agrega filas; un cliente con push de #5 desde su ultima visita no recibe #3; con push de #3 SI
  recibe #5; tras una compra nueva vuelve a ser elegible.
- [ ] `not_before` cae dentro del horario del negocio en su zona horaria.
- [ ] El worker cancela (`campaign_inactive`, `membership_gone`, `opt_out`, `visited`) sin tocar
  `latest_message`, reprograma fuera de horario, y al enviar marca `sent_at` y emite UN cupon (ninguno
  si ya tiene uno sin canjear de la campaña).
- [ ] `planTransports("campaign", true)` = solo wallet; `(…, false)` = solo Web Push.
- [ ] Click: `POST /api/public/push/click` marca `clicked_at` una vez, 204 para id desconocido; `sw.js`
  lo llama con el `clickId`.
- [ ] Resultados con bloque `push` (y `null` en campañas sin push).
- [ ] `GET/PATCH /api/marketing/settings` con 400 por rango y aislamiento por negocio.
- [ ] Contrato actualizado en `0101-contratos-de-api.md`: `channels` en `enable`/`templates`/DTO
  `Campaign`, bloque `push` de resultados, `settings`, click publico.
- [ ] Seis gates verdes (`typecheck`, `lint`, `test`, `format:check`, `build`, `test:e2e`) + los
  `.neon.integration` de marketing, push y cupon por `tools/neon-test.sh`.

## Plan de pruebas y verificación

- [ ] **Unit** `push-audience.test.ts`: cada exclusion en su orden (un opt-out sin alcance cuenta como
  `opt_out`); `already_reached` con `lastGroupDecisionAt` = `dormantSince` (borde `>=`) y un ms antes →
  elegible.
- [ ] **Unit** `push-window.test.ts`: `America/Argentina/Buenos_Aires` 08:59 local → siguiente 09:00;
  09:00 → ahora; 20:59 → ahora; 21:00 → mañana 09:00; `Europe/Madrid` el dia del cambio de hora.
- [ ] **Unit** `templates`/`template-input`: `templateKeysAtOrAbove(#3)` = `[missed_you, win_back]`,
  `(#5)` = `[win_back]`; los casos de `channels`.
- [ ] **Unit** `push-transports` (existente): `campaign` alcanzable/no alcanzable.
- [ ] **Unit** `coupon-issue`: `pushCouponToIssue` holdout / sin label / vencida / con cupon sin
  canjear → `null`; ok → validez `sentAt..endsAt`.
- [ ] **Integracion** `marketing-push.neon.integration.test.ts` (tick): negocio con clientes dormidos
  con y sin pase/Web Push, `random` inyectado; asserts sobre `campaign_push` y `wallet_push_queue`
  leidos por SQL; los casos de grupos (#5 bloquea #3; #3 no bloquea #5; compra nueva reabre; holdout
  bloquea); doble tick; solo-push sin turnos.
- [ ] **Integracion** `marketing-push-delivery.neon.integration.test.ts` (worker con `runPushWorker`
  y canales doble): los 4 cancel, reschedule fuera de horario, send → `sent_at`, cupon, `latest_message`
  escrito solo en `send`, `clickId` en el payload Web Push.
- [ ] **Integracion** `enable` (en `marketing-templates.neon…`): solo-push sin puertas; ruta de
  `settings` (unit de ruta con `_auth` doblado para 400/200; aislamiento en integracion).
- [ ] **Integracion** resultados: conversion a 7 d con un enviado que compra el dia 6 y uno el dia 8,
  holdout idem.
- [ ] Comandos: `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run format:check`;
  `pnpm run build`; `pnpm test:e2e`; `tools/neon-test.sh` con los archivos nuevos + `marketing-tick`,
  `marketing-templates`, `marketing-results`, `marketing-coupon-issue`, `wallet-push-worker`,
  `wallet-push-routing`, `counter-coupon`.
- [ ] Verificacion manual (QA del owner, despues del deploy): encender #3 con `["push"]` en un negocio
  de prueba con un cliente dormido suscripto a Web Push; correr el tick y el worker; ver llegar el push
  en el telefono, tocarlo, y ver `clicked` en resultados.

### Mutaciones (presupuesto: 8; clase: errores PLAUSIBLES de cableado y de reglas de negocio)

Mecanismos NUEVOS salvo M4 (existente, con linea). El oraculo tiene que dar rojo por la propiedad
(leer la asercion; nada de `TypeError` de un doble posicional). Protocolo: skill
`protocolo-de-verificacion`.

| # | Mecanismo | Mutacion | Oraculo que tiene que dar rojo |
|---|---|---|---|
| M1 | llamada a `gateCampaignPush` en `deliverClaimed` | borrar la llamada (CABLEADO) | delivery: «cancela `visited`» — la fila sale `sent` |
| M2 | regla `visited` del gate | comparar `created_at > sent_at`/`not_before` en vez de `decided_at` (plausible) o borrarla | delivery: compra entre la decision y la entrega → `cancelled`/`visited` |
| M3 | `templateKeysAtOrAbove` | `rank <=` en vez de `>=` (invierte la escala) | integracion de grupos: «#5 bloquea #3» Y «#3 no bloquea #5» (las dos) |
| M4 | fan-out de `campaign` (hoy `push-transports.ts:211`) | volver al fan-out Apple+Google+WebPush | unit `planTransports("campaign", true)` sin Web Push |
| M5 | `cancelled_at is null` en `lastGroupDecisionAt` | quitar el filtro | integracion: push cancelado por `campaign_inactive` NO bloquea la siguiente campaña del grupo |
| M6 | filtro `channel_proximity` en `loadActiveCampaigns` | quitarlo | integracion: campaña solo-push no encola turnos |
| M7 | holdout sin cola | encolar tambien al holdout | integracion tick: holdout con `queue_id` null y sin fila de cola |
| M8 | `no_usable_location` condicionado a proximidad | condicion incondicional (la forma vieja) | integracion `enable` solo-push sin puertas → 201 |

**Declarado fuera:** la reprogramacion por horario tiene oraculo pero no mutacion (presupuesto); el
`keepalive` del `sw.js` no tiene oraculo automatico (QA del owner); el 204 de id desconocido tiene unit
pero no mutacion; la foto de audiencia del push no existe (ver «No entra»).

## Handoff requerido

Un implementador y un revisor independiente (`docs/AGENT-WORKFLOW.md`, ADR 0071). Orden de prod: el
codigo NUEVO sin la migracion rompe el tick (lee `channel_proximity`) → **migrar prod ANTES del deploy**,
con OK explicito del owner. El codigo VIEJO con la migracion aplicada no se rompe (columnas con default,
tabla nueva que no lee, `cancelled` que no escribe).

## Abierto

Nada. **El owner aprobo la spec y los 4 puntos *(ORQUESTADOR)* de abajo («ok, cerrada y mandala a implementar», 2026-09-26):**
1. Un cliente con cupon sin canjear de la campaña no recibe un segundo por push (el aviso igual sale).
2. Solo-push no exige puertas con coordenadas.
3. Holdout cuenta como «ya decidido» para la regla de grupos.
4. Consecuencia: sin tope, hasta 2 push por ausencia por negocio (#3 y #5).

## Cierre (2026-09-27)

Implementada en `4185363` + `f8b867c` (contrato) + `73bb503` (oraculos). Revisor independiente:
**PASS** (gates re-corridos, 1894 tests; Neon 15 archivos 74/74; `test:e2e` solo con el rojo previo de
la 0100). M1-M8 en rojo (implementador). Mutaciones del revisor: R1 (orden por rank) y R5 (`>=`) en
rojo; R2 (cupon ajeno), R4 (compra en otro negocio) y R3 (`t0 = sent_at`) sobrevivian por falta de caso
→ el orquestador agrego los casos y las re-midio: las tres en ROJO por la propiedad.
**Declarado:** `membership_gone` es inalcanzable en la base (FK sin `on delete`; ningun camino de la
app borra membresias; FKs NO ACTION hermanas ya existian) — solo oraculo unit; `WorkerSummary.sent`
cuenta cancel/reschedule (observabilidad); si `recordCampaignPushSent` falla tras el envio, `sent_at`
queda null (push enviado sin cupon ni conversion; no reintenta para no duplicar); `templates` expone
`group`/`rank`; click 500 si cae la base (el `sw.js` lo ignora); un cancel del gate adelanta el reloj
del planner y puede demorar 3 min otra `campaign` del mismo consumidor.
