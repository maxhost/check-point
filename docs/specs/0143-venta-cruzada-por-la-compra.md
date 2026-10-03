---
spec: 0143
fecha: 2026-10-03
estado: implementada
resumen: Spec 4 del ADR 0115 (implementa el ADR 0117). Cuando el mostrador acredita en el comercio A, se elige por loteria H4 UNA campaña cruzada elegible, se emite su cupon al cliente y se encola el push «🎁 Tenés un regalo» a la separacion minima (3 min), sin ventana horaria; cada decision queda registrada con sus candidatos, factores, probabilidades y numero sorteado (migracion 0063: `core.cross_decision` + `core.cross_candidate`). La lista «a pedido» (C1/C2) se apaga, y activar una cruzada exige fecha de fin.
disjunta: si
archivos: .github/workflows/wallet-push-cron.yml (borrar), docs/notificaciones/README.md, packages/domain/src/server/marketing/{cross-lottery,cross-sale,cross-sale-store,cross-sale-push,enabled-campaigns,push-delivery}.ts, packages/domain/src/server/notifications/limits.ts, packages/db/src/schema/cross-sale.ts (+ barrel), packages/db/drizzle/0063_* + meta, apps/merchant/src/server/counter/{grant,after-grant}.ts, apps/merchant/src/server/marketing/template-input.ts, apps/consumer/src/app/api/public/consumer/cross-offers/** (apagar), tests nuevos y reescritura declarada
---

# 0143 — La Venta cruzada se dispara por la compra

## Problema

- Hoy la Venta cruzada es **a pedido**: el cliente abre C1 (`listCrossOffers`, `consumer/cross-offers.ts:95`) y reclama
  con C2 (`claimCrossOffer`, `:190`). El ADR 0117 la cambia: **la dispara la compra en A** (§1), el cupon **ya es
  suyo** (§2), **una sola oferta por compra** (§3) elegida por **loteria H4** (§12, §13), con push «regalo misterio»
  (§14) y **todo registrado desde el dia uno** (§10). La lista a pedido **se apaga** (§5).
- Hoy no existe ningun registro de por que un cliente recibio una oferta: no se puede aprender ni medir equidad.
- Una campaña cruzada puede no tener fecha de fin: `template-input.ts:220` saltea `requireEndForCoupon` para `cross`
  (`offer = cross || valley`, `:187`). Con «una vez por campaña» (§15) eso es «una vez para siempre».

## Decisiones del owner que esta spec consume

ADR 0117 §1–§15, y las cerradas el **2026-10-03** al escribir esta spec (van al 0117, «Cerrado despues»):

- **Ventana horaria:** «No, sale con la compra» — el regalo misterio no espera a la ventana 9–21 del comercio.
- **Fecha de fin:** «Exigir fecha de fin» — la API rechaza activar una cruzada sin `endsAt`.
- **Disparador:** «Solo acreditar» — solo una orden nueva del mostrador; canjear un premio o un cupon no dispara.
- **Demora del push → ADR 0118:** el worker de la cola lo dispara **cron-job.org cada 10 min, de 7:00 a 18:00**
  (`America/Guayaquil`), editable en su pantalla sin deploy; el GitHub Action que lo disparaba (medido cada 2,4–7,8 h)
  se borra. El regalo misterio llega entre 3 y ~13 min despues de la compra; de una compra despues de las 17:50, a
  las 7:00. Consecuencia aceptada por el owner (ADR 0118): el recordatorio del dia sin compra con hora objetivo despues
  de las 17:50 no sale.

## Alcance

**Entra:** la decision despues de acreditar (loteria H4, cupon, push, registro); la migracion 0063; el gate del push
cruzado y su clic; las constantes de la loteria en `limits.ts`; apagar C1/C2; `endsAt` obligatorio para `cross`;
**borrar `.github/workflows/wallet-push-cron.yml`** y documentar el job de cron-job.org en `docs/notificaciones/README.md`
(ADR 0118).

**No entra:** pantallas (GPT; la UI ya no consume C1/C2 y `benefits-tab.tsx` ya muestra los cupones cruzados con
`origin: "cross"`); crear y configurar el job en cron-job.org (lo hace el owner: cuenta y `CRON_SECRET`, §8); etapas 2 y 3 del algoritmo (afinidad,
merito, modelo); grupo de control (§11); que el comercio A decida (§4); limpiar campañas cruzadas vivas sin fin (no
hay usuarios reales; el `check` de la base NO cambia); un deep link a «Mis beneficios» (el push abre `/wallet`, el
default del service worker); registrar campañas NO elegibles con su motivo (solo se registran las elegibles y las
compras con 0 elegibles, como pide `venta-cruzada-algoritmo.md` §4).

## Diseño

### 1. Cuando corre

`grantAccrual` (`apps/merchant/src/server/counter/grant.ts`, 298 lineas: al limite de 300) cambia su ultima llamada
`dispatchGranted(granted.pushQueueId)` por `afterGrant(granted)` de un modulo nuevo `counter/after-grant.ts`, que hace
lo de antes **y**, solo si `granted.pushQueueId !== null` (la orden la creo ESTA llamada; un reintento o la relectura
del perdedor de la carrera la trae nula, `readOrderByRequest`, `orders.ts:186`), programa `decideCrossSale(granted.id)` con `after()` (mismo
patron y mismo fallback inline que `dispatchGranted`, `wallet/push.ts`). Best-effort: nunca lanza ni demora la
respuesta del mostrador; un fallo se loguea y esa oportunidad se pierde (declarado). Si
`campaignKindEnabled("cross")` es `false`, no hace nada.

### 2. La decision (`marketing/cross-sale.ts`, una transaccion)

1. **Idempotencia:** `insert into core.cross_decision (order_id, …) … on conflict (order_id) do nothing returning id`.
   Sin fila → otra corrida ya decidio esta orden: termina sin escribir nada mas.
2. **Hechos del cliente:** `loadConsumerPosition(tx, consumerId, null)` — la orden recien commiteada es su evento mas
   reciente, asi que da el rubro de A y el punto del local de la orden (o, si la orden no tiene local, el del ultimo
   evento geocodificado). Sin GPS: en el mostrador no hay. `loadCrossMemberships` y `loadClaimedCrossCoupons`.
3. **Candidatas:** `loadCrossCampaigns(tx, now)` (solo `cross`) y, por cada una, `decideCrossOffer` igual que C1
   (`cross-offers.ts:123-127`): mismo orden de razones, el tope mensual contado al final. **Antes de contar topes** se
   bloquean con `for update` las filas de `core.campaign` de las que pasaron las demas razones, **en orden de id**
   (sin deadlocks entre dos compras simultaneas), y el tope se cuenta bajo ese bloqueo.
4. **Loteria H4** (§3) sobre las `k` elegibles. `k = 0` o sin origen → se registra la decision con `outcome
   = 'no_candidates'` / `'no_origin'` y termina.
5. **Cupon:** el mismo insert de `claimCrossOffer` (`insertCrossCoupon`, `cross-offers.ts:154`: se exporta o se mueve,
   sin cambiar su SQL), con `cross_claimed_at = now` — eso mantiene `origin: "cross"` (`coupons.ts:117`), el unico
   parcial «una vez por campaña» y la regla de la Bienvenida (`hasCrossCouponFrom`, `cross-store.ts`). Si el `on
   conflict` no devuelve fila (el mismo cliente comprando en dos A a la vez) → `outcome = 'coupon_conflict'`, sin push.
6. **Push:** fila en `consumer.wallet_push_queue`: `class 'campaign'`, titulo `🎁 Tenés un regalo`, cuerpo `Por tu
   compra en {nombre de A}. Abrí la app y descubrí qué es.`, `not_before = now + COOLDOWN_MS` (`limits.ts`).
7. **Registro:** `cross_decision` se completa (`chosen_campaign_id`, `coupon_id`, `queue_id`, `draw`, `outcome
   = 'issued'`) y se inserta una fila de `cross_candidate` por elegible.

`now` y el generador del sorteo son inyectables (los tests los fijan).

### 3. La loteria H4 (`marketing/cross-lottery.ts`, PURA)

Para cada elegible `i` (campaña = comercio: hay una sola cruzada viva por comercio, `core_campaign_template_live_unique`):

- **Cercania** `c_i = e^(−d_i / CROSS_LOTTERY_DECAY_METERS)`, `d_i` = metros al local mas cercano de B.
- **Atraso** `a_i = clamp((1 + F_i) / (1 + R_i), CROSS_LOTTERY_BEHIND_MIN, CROSS_LOTTERY_BEHIND_MAX)`. `F_i` = suma de
  `1/k` de las decisiones del mes local de B en que `i` fue candidata, **incluida esta** (`1/k` de la actual); `R_i` =
  decisiones del mes en que `i` salio elegida. Es «igual por oportunidad» (`venta-cruzada-algoritmo.md` §3).
- **Bono H4** `b_i = CROSS_LOTTERY_NEW_CUSTOMER_BONUS` si B **no consiguio ningun cliente nuevo en su mes local**, si no
  `1`. **Cliente nuevo de B en el mes** = un cliente cuya **primera orden en B** (de siempre) cae en el mes. Es la
  traduccion del orquestador del «comercio sin clientes nuevos en el mes» del 0117 §12 (la simulacion usaba «sin
  canjes»).
- **Probabilidad** `p_i = ε/k + (1 − ε) · c_i·a_i·b_i / Σ_j c_j·a_j·b_j`, con `ε = CROSS_LOTTERY_EPSILON`.
- **Sorteo:** `u ∈ [0, 1)`; candidatas ordenadas por id de campaña; sale la primera cuya acumulada supera `u` (la
  ultima si el redondeo no llega). Devuelve las probabilidades, los factores y la elegida.

El mes local de B es `localMonthStart(now, b.timezone)` (`welcome-rules.ts`), el mismo del tope mensual.

**Constantes nuevas en `notifications/limits.ts`**, en un bloque «Venta cruzada: la loteria»: `CROSS_LOTTERY_EPSILON =
0.2` (owner, 0117 §13), y — valores del orquestador, salidos de la investigacion y la simulacion — `DECAY_METERS =
1000`, `BEHIND_MIN = 0.5`, `BEHIND_MAX = 2`, `NEW_CUSTOMER_BONUS = 1.5`, y `CROSS_LOTTERY_POLICY = "h4-v1"` (se
registra en cada decision). Cada una con su literal en `limits.test.ts`.

**Segmento** de cada candidata (registro, no pesa en la etapa 1): `new` si el cliente nunca tuvo una orden en B;
`dormant` si su ultima orden en B es anterior a `now − dormantDays` de la campaña; si no, `regular`.

### 4. Modelo de datos — migracion 0063 (aditiva)

`core.cross_decision` — una fila por orden acreditada mientras `cross` este encendida:
`id` uuid pk · `order_id` uuid **not null unique** → `core.order` on delete cascade · `consumer_id` uuid not null →
cuenta del cliente on delete cascade · `business_id` (A) uuid not null · `location_id` uuid null · `origin_kind` text
not null (`last_scan` | `none`) · `policy` text not null · `epsilon` double precision not null · `candidate_count`
integer not null · `draw` double precision null · `chosen_campaign_id` uuid null → `core.campaign` · `coupon_id` uuid
null → `core.campaign_coupon` on delete set null · `queue_id` uuid null → `consumer.wallet_push_queue` on delete set
null · `outcome` text not null, `check in ('issued', 'no_candidates', 'no_origin', 'coupon_conflict')` ·
`decided_at` timestamptz not null default now() · `clicked_at` timestamptz null. Indices: `(chosen_campaign_id,
decided_at)` y `(queue_id)`.

`core.cross_candidate` — una fila por elegible: `decision_id` → `cross_decision` on delete cascade · `campaign_id` ·
`business_id` · `location_id` (local mas cercano de B) · `category_gcid` text · `distance_meters` integer ·
`cap_remaining` integer · `segment` text `check in ('new', 'dormant', 'regular')` · `days_since_last_order` integer
null · `orders_count` integer · `factor_closeness`, `factor_behind`, `factor_bonus`, `probability` double precision
not null. PK `(decision_id, campaign_id)`; indice `(campaign_id)`.

Esquema drizzle en `packages/db/src/schema/cross-sale.ts` (re-exportado por el barrel) y `.sql` con `drizzle-kit
generate`; la spec no dicta su texto (`gotchas-del-repo`). **GRANT al rol del cliente** (como `0060_rol_del_cliente.sql:46-47`
para `campaign_push`): `SELECT (id, clicked_at)` y `UPDATE (clicked_at)` sobre `core.cross_decision`, para el clic.

**Orden con PROD:** aditiva → **migracion antes del deploy** (el codigo nuevo escribe en tablas nuevas). La aplica el
owner o el orquestador con su OK.

### 5. El push en el worker

- **Gate:** `gateCampaignPush` (`push-delivery.ts`) hoy, sin `campaign_push` detras, cae a `gateWelcomeReminder`, y sin
  cupon de bienvenida, a `send` sin `clickId`. Antes de esa caida pregunta a `gateCrossSalePush(queueId)` (archivo
  nuevo `cross-sale-push.ts`; `push-delivery.ts` tiene 252 lineas): si hay una `cross_decision` con ese `queue_id` →
  `{ kind: "send", clickId: decision.id }`. **Sin ventana horaria y sin cancelaciones** (decision del owner). Lo
  demas del worker no cambia: separacion de 3 min (`planConsumerDrain`), presupuesto de 24 h (cuenta como `campaign`)
  y canal (sin Web Push → `suppressed`/`no_channel`; el cupon ya esta en su cuenta, ADR 0117 «Canal»).
- `push.ts` (295 lineas) **no se toca**. Despues de `sent` llama `recordSent(clickId)` → `recordCampaignPushSent`, que
  con un id de decision no actualiza ninguna fila (`where cp.id = …`) y retorna: inocuo, y se fija con un test.
- **Clic:** `recordPushClick` (`push-delivery.ts`, la llama `POST /api/public/push/click` del consumer) tambien hace
  `update core.cross_decision set clicked_at = coalesce(clicked_at, now()) where id = $1`. La ruta sigue respondiendo
  204 para todo uuid.

### 6. Apagar la lista a pedido

`enabled-campaigns.ts` suma `CROSS_ON_DEMAND_ENABLED = false`. Con `false`, `GET /api/public/consumer/cross-offers` y
`POST …/cross-offers/{id}/claim` responden **404** `{ error, code: "not_found" }` sin leer la base (despues de la
sesion: sin sesion sigue siendo 401). `listCrossOffers` y `claimCrossOffer` **quedan** (criterio del 0115: lo
apagado no se borra) y sus tests de ruta se saltean con `describe.skipIf(!CROSS_ON_DEMAND_ENABLED)`, como la 0138.
Las suites que usan `claimCrossOffer` solo para sembrar un cupon cruzado (p. ej. `consumer-cross-counter`) siguen
corriendo.

### 7. Fecha de fin obligatoria

`template-input.ts:220`: `requireEndForCoupon` pasa a aplicarse tambien a `cross` (no a `welcome` ni a `valley`). Un
`enable` de `cross` sin `endsAt` → 400 con `fields.endsAt = "Una campaña con cupón necesita fecha de fin."`.

### 8. El worker: cron-job.org (ADR 0118)

El job lo crea el owner en cron-job.org: URL `https://<dominio del merchant>/api/internal/wallet-push` (el mismo valor
que hoy tiene el secreto `WALLET_PUSH_ENDPOINT` del repo), metodo `GET`, header `Authorization: Bearer <CRON_SECRET>`
(el mismo de Vercel), `minutes` 0,10,20,30,40,50, `hours` 7–17, `timezone` `America/Guayaquil`, email al desactivarse
encendido. **Orden:** (1) el owner crea el job; (2) el orquestador verifica que corrio (historial del job en
cron-job.org con HTTP 200, o una fila `pending` vencida de la cola que pasa a `sent` sin otra intervencion); (3) recien
ahi se borra `.github/workflows/wallet-push-cron.yml` (y los secretos `WALLET_PUSH_ENDPOINT`/`CRON_SECRET` del repo
dejan de usarse: el owner decide si los borra). `docs/notificaciones/README.md` suma una seccion «Quien drena la cola»
con esta configuracion y como cambiar el horario. El codigo del endpoint no cambia.

### Contrato para GPT

- **C1 y C2** (`0136-contratos-de-api.md`) → **404 `not_found`**. La UI de hoy no los llama.
- **M1** (`POST /api/marketing/templates/cross/enable`): `endsAt` pasa de opcional a **obligatorio**; sin el, 400 con
  `fields.endsAt`. La pantalla del merchant tiene que pedirlo.
- **E3** (`GET /api/public/consumer/coupons`): sin cambios; el cupon cruzado llega con `origin: "cross"`.
- **Push:** titulo `🎁 Tenés un regalo`, cuerpo `Por tu compra en {A}. Abrí la app y descubrí qué es.`; abre `/wallet`.

### Arquitectura de referencia

ADR 0117, 0115 §6, 0116 (canales), 0104/0136 (reglas cruzadas), 0037 (cola y separacion), 0103 §9 (clic), 0141
(`limits.ts`), 0114 (zonas: todo lo de aca es zona de Claude).

## Archivos

| Archivo | Accion |
|---|---|
| `packages/domain/src/server/marketing/cross-lottery.ts` | crear (pura) |
| `packages/domain/src/server/marketing/cross-sale.ts`, `cross-sale-store.ts` | crear (decision + lecturas/escrituras) |
| `packages/domain/src/server/marketing/cross-sale-push.ts` | crear (gate) |
| `packages/domain/src/server/marketing/push-delivery.ts` | editar (gate + clic) |
| `packages/domain/src/server/marketing/enabled-campaigns.ts` | editar (`CROSS_ON_DEMAND_ENABLED`) |
| `packages/domain/src/server/consumer/cross-offers.ts` | editar (exportar o mover `insertCrossCoupon`, sin cambiar su SQL) |
| `packages/domain/src/server/notifications/limits.ts` + `apps/merchant/src/server/notifications/limits.test.ts` | editar |
| `packages/db/src/schema/cross-sale.ts` + barrel; `packages/db/drizzle/0063_*` + meta | crear |
| `apps/merchant/src/server/counter/after-grant.ts` | crear; `grant.ts` editar (una llamada) |
| `apps/merchant/src/server/marketing/template-input.ts` | editar (§7) |
| `apps/consumer/src/app/api/public/consumer/cross-offers/route.ts`, `[campaignId]/claim/route.ts` | editar (404) |
| `docs/notificaciones/README.md` | editar (las constantes nuevas en el mapa; «Quien drena la cola», §8) |
| `.github/workflows/wallet-push-cron.yml` | borrar, despues de verificar cron-job.org (§8) |
| tests (abajo) | crear / reescritura declarada |

**Disjunta: si.** La 0142 (GPT, abierta) toca `apps/consumer/public/sw.js` y el `INDEX`; esta spec no toca el service
worker (el `clickId` y el `/wallet` por defecto ya existen, `sw.js:21,29`). Nada mas abierto en el INDEX toca estos.

## Definition of Done

- [ ] Acreditar en A con dos cruzadas elegibles cercanas → exactamente **una** `cross_decision` (`issued`), **un**
      cupon cruzado del cliente de la elegida, **dos** `cross_candidate` cuyas `probability` suman 1 (±1e-9), y **una**
      fila `campaign` en la cola con el titulo y cuerpo de §2.6 y `not_before = decided_at + 3 min`.
- [ ] Reintento del mismo `clientRequestId` → ninguna fila nueva en `cross_decision`, cupones ni cola.
- [ ] Acreditar sin elegibles → una `cross_decision` `no_candidates`, sin cupon ni push.
- [ ] Canjear un premio o un cupon en A → ninguna `cross_decision`.
- [ ] Cliente que ya tiene el cupon de la campaña de B → B no es candidata (una vez por campaña).
- [ ] La loteria reproduce el ejemplo de `venta-cruzada-algoritmo.md` §2 (B 0,3107 · C 0,4099 · D 0,2793).
- [ ] El worker manda el push cruzado fuera de la ventana horaria de B, con `clickId` = id de la decision; el clic
      escribe `cross_decision.clicked_at` bajo el rol del cliente.
- [ ] C1 y C2 → 404 con sesion; `enable` de `cross` sin `endsAt` → 400 `fields.endsAt`.
- [ ] cron-job.org corriendo (verificado como dice §8) y `wallet-push-cron.yml` borrado en el mismo commit que lo
      documenta en `docs/notificaciones/README.md`.
- [ ] Migracion 0063 aplicada en la rama efimera de los tests Neon.
- [ ] `pnpm verify` en verde con Node 24 (ADR 0113), con su tabla final transcripta. Neon relacionado por esquema.

## Plan de pruebas y verificación

**Rutas** (la regla de `protocolo-de-verificacion` §2.0: un test en `packages/` no lo corre nadie): los unitarios del
dominio van en `apps/merchant/src/server/marketing/` (como `cross-rules.test.ts`); los Neon en `apps/merchant/src/server/`
y `apps/consumer/src/server/`.

- [ ] `cross-lottery.test.ts` (unitario): el ejemplo §2 con `toBeCloseTo(x, 3)`: d = 300/900/1800 m, `F` = 20 en las
      tres (19 + 2/3 de decisiones previas mas el 1/3 de esta), `R` = 40/15/5, sin bono. Sorteo: `u = 0.30` → B, `u = 0.32` → C, `u =
      0.99` → D. Bono: el mismo caso con D sin clientes nuevos → `[0.2821, 0.3697, 0.3482]` (con `F` = 20 exactos,
      medido). Una sola candidata → `p = 1`.
- [ ] `cross-sale.neon.integration.test.ts` (merchant, nuevo): los cinco primeros puntos de la DoD por el borde real
      (`grantAccrual`, con `afterGrant` llamado inline), mas el escenario de `coupon_conflict`.
- [ ] `cross-sale-push.neon.integration.test.ts` (merchant, nuevo): `runPushWorker` con el reloj a las 22:00 locales de
      B y la fila vencida → `sent`; el `clickId` de Web Push es el id de la decision; `campaign_push` sin filas nuevas.
- [ ] `consumer-role-offers.neon.integration.test.ts` (consumer): C1/C2 → 404; el clic con un id de decision escribe
      `clicked_at` bajo `checkpass_consumer`.
- [ ] `template-input` (unitario existente o nuevo al lado): `cross` sin `endsAt` → 400; `welcome` y `valley` sin
      `endsAt` siguen pasando.
- [ ] **Reescritura declarada:** `marketing-cross-enable.neon.integration.test.ts:95` siembra `endsAt: null` → pasa a
      una fecha (la regla cambio por decision del owner). Los tests de ruta de C1/C2 (`cross-offers-routes.test.ts`,
      casos de C1/C2 en `consumer-role-offers`) se saltean con la bandera, no se borran. Cualquier otra edicion de un
      test existente se lista en el handoff con su motivo.
- [ ] Comandos: `tools/neon-test.sh <archivo>` por cada suite Neon; `pnpm verify`.

### Mutaciones (presupuesto: 7; clase: errores plausibles de cableado y de formula)

| # | Mecanismo (archivo) | Mutacion | Oraculo que tiene que ponerse rojo | Guard hermano y como se puentea |
|---|---|---|---|---|
| M1 | `afterGrant` (`after-grant.ts`) | borrar la llamada a `decideCrossSale` | Neon: acreditar → una `cross_decision` | ninguno: es el unico disparador |
| M2 | condicion `pushQueueId !== null` (`after-grant.ts`) | quitarla | Neon: reintento → sin `cross_decision` nueva | `unique(order_id)` tambien lo frena: el oraculo cuenta **llamadas** a `decideCrossSale` con un espia, o **M2 no mide nada** — el implementador elige y lo dice |
| M3 | `on conflict (order_id) do nothing` + salida temprana (`cross-sale.ts`) | quitar la salida temprana | Neon: dos `decideCrossSale(orderId)` seguidas → **una** fila de cola | el unico parcial del cupon frena el segundo cupon pero **no** la segunda fila de cola: por eso el oraculo cuenta la cola |
| M4 | clamp de `a_i` (`cross-lottery.ts`) | quitar el clamp | unitario §2 (D pasa a 0,377) | — |
| M5 | `1/k` de la decision actual en `F_i` | no sumarlo | unitario §2 (B 0,3097 ≠ 0,3107 a 3 decimales) | — |
| M6 | gate cruzado (`push-delivery.ts`) | borrar la consulta a `gateCrossSalePush` | Neon: `clickId` = id de la decision | sin el gate igual sale `send` (caida a `gateWelcomeReminder`): el oraculo es el `clickId`, no el `sent` |
| M7 | `requireEndForCoupon` para `cross` (`template-input.ts`) | volver a `!welcome && !offer` | unitario: `cross` sin `endsAt` → 400 | — |

Cada fila se ejecuta con el protocolo (`shasum` limpio, bitacora antes de medir, etiqueta, `diff` al revertir) y se
transcribe el rojo **leyendo la asercion**. Lo que queda afuera, **declarado**: la concurrencia real de dos compras
simultaneas sobre el mismo tope (se razona por el `for update`, no se mide); la carrera de `after()` en Vercel; la
demora real del push (la pone cron-job.org, ADR 0118; no la mide ningun test).

### Verificacion manual (owner, despues del deploy)

Con dos comercios de rubros distintos a < 2 km, cruzada activa en B con fecha de fin, y un cliente con notificaciones
de la PWA, entre las 7:00 y las 17:40: acreditar en A → el cupon de B aparece en «Mis beneficios» al recargar, y el
push «🎁 Tenés un regalo» llega entre 3 y ~13 min despues (para no esperar: «Run now» del job en cron-job.org pasados
los 3 min).

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. Un implementador para toda la spec, un revisor independiente con PASS antes de
`implementada`. El orquestador aplica la 0063 a PROD con el OK del owner, antes del deploy.

## Abierto

Nada que bloquee. Paso del owner antes de cerrar la DoD: crear el job de cron-job.org (§8).
