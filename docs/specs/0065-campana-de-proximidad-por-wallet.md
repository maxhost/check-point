---
spec: 0065
fecha: 2026-09-15
estado: cerrada (2026-09-15) — el owner confirmo los dos items que quedaban: opt-out desde una seccion de configuracion del portal, y freno por plan como BLOQUEO DURO al bajar (no pausa automatica), calcado del de locales
resumen: Primera campaña real del motor de marketing (ADR 0064) y primer tipo de campaña con spec propia (ADR 0065): el owner compone «clientes de mis locales que no vienen hace N dias → se les muestra mi local en su Wallet cuando pasen cerca → mensaje → cupon opcional», la cola coloca TURNOS de 5 dias en el campo `locations` del pase (≤5 activos por consumidor, ≥400 m entre si, 1 por negocio, FIFO, cooldown 30 dias, cuota de 50 turnos concurrentes por negocio, holdout 10 %), el pase se refresca en silencio por una clase nueva `pass_refresh`, el cupon se canjea en el mostrador de forma atomica e idempotente, y la pantalla de resultados muestra SOLO metricas observadas (ADR 0021) salvo la diferencia con/sin turno. El consumidor apaga las promociones de un negocio desde una seccion de **Configuracion** de su portal, sin perder lo transaccional ni su saldo en el pase. `free`/`none` no crea ni activa campañas, y **bajar de plan esta BLOQUEADO mientras haya campañas activas** — el owner las desactiva primero, igual que archiva locales (guarda nueva en `decidePlanChange`). Fija el journey de composicion y la pantalla de resultados que heredan los demas tipos de campaña. Reemplaza la demo de la spec 0017.
disjunta: no
archivos: apps/merchant/src/server/schema/{campaign,consumer}.ts, apps/merchant/src/server/marketing/**, apps/merchant/src/server/wallet/{apple,google,passkit,push,push-plan,push-transports}.ts, apps/merchant/src/app/backoffice/marketing/**, apps/merchant/src/app/backoffice/{page,counter/*}.tsx, apps/merchant/src/app/api/{marketing,internal/marketing-tick,counter/coupon-redeem,public/consumer/marketing-opt-out}/**, apps/merchant/src/app/(consumer)/wallet/page.tsx, apps/merchant/src/server/billing/{webhook-apply,plan-change}.ts, apps/merchant/drizzle/0031_*.sql, .github/workflows/marketing-tick.yml
---

# 0065 — Campaña de proximidad por wallet

> **Nada de codigo empieza sin esta spec en `cerrada`.** Ver `TEMPLATE.md` para el porque.

## Problema

Un negocio tiene clientes que se enrolaron y no volvieron, y no tiene ninguna forma de recordarles
que existe en el unico momento en que pueden actuar: cuando pasan por la puerta. El pase de Wallet
que ya tienen instalado puede hacer exactamente eso (campo `locations`), y hoy no lo usamos. Al
mismo tiempo, no existe ninguna entidad de campaña, ninguna audiencia, ningun opt-out de marketing,
ningun cupon, y el unico camino para actualizar el pase le comeria el turno a las campañas por push.

## Alcance

**Entra:**

- Modelo de campaña (`kind = 'proximity'`), locales asignados (ADR 0006), estados y transiciones.
- La audiencia **«dormidos»**: ultima actividad (orden o alta) hace `dormant_days` o mas.
- El **tick** (scheduler) que encola, activa, vence, cancela turnos y decide la colocacion por
  consumidor con las reglas del ADR 0065 (≤3 utilidad, ≤5 turnos, ≥400 m, 1 por negocio, cuota,
  holdout), como funcion pura + aplicador SQL.
- La **bolsa de utilidad** (relacion viva → el propio saldo del consumidor como texto).
- `locations`/`relevantText` en el pase de Apple y `merchantLocations` + modulos de texto en el
  objeto de Google; la clase **`pass_refresh`** de la cola, silenciosa.
- **Backoffice**: listado, **compositor** de campaña (audiencia → canal → mensaje → beneficio →
  limites/revision) y **detalle con resultados**. Es el journey base de todos los tipos de campaña.
- **Cupon** como efecto de la campaña: definicion (etiqueta, costo estimado por canje, tope de
  canjes, producto opcional), instancia implicita en el turno, **canje atomico e idempotente en el
  mostrador**, aviso transaccional al canjear.
- **Seccion «Configuracion» en el portal del consumidor** con el opt-out de promociones por negocio.
- **Freno por plan**: `free`/`none` no crea ni activa, y **bajar de plan queda bloqueado** mientras haya campañas activas (guarda nueva en `decidePlanChange`, misma forma que la de locales).
- Migracion `0031`, workflow de GitHub Actions para el tick, observabilidad.

**No entra:**

- Cualquier otro tipo de campaña (push de reactivacion, franja, evento, cumpleaños, local nuevo…):
  cada uno tiene su spec (ADR 0064 §2). El **Web Push** no se toca (ni el `sw.js`).
- El motor reactivo (fase 2, ADR 0018/spec 0003): reglas, versiones inmutables, `incentive_evaluation`.
- **Merito por resultado** en la cola (rotacion pura; ADR 0065 §4). Score de recuperabilidad.
- Red cruzada / consumidores fuera del programa (ADR 0064 §3). Cobro por campaña.
- Calculo de margen contra el catalogo (ADR 0002 completo): solo costo declarado + tope. El cupon
  **no** modifica saldos de puntos/sellos ni interactua con premios del programa.
- `maxDistance`, `relevantDate`, `addMessage` de Google, geofencing propio, check-in.
- Editar el mensaje de una campaña **activa** (se pausa, se edita, se reanuda): sin versionado.
- Categoria del negocio, fecha de nacimiento, email.

## Diseño

### Lo que ve el owner (journey base de todos los tipos)

`/backoffice/marketing` lista las campañas del negocio con estado, audiencia del ultimo tick,
turnos activos y un resumen de resultados. «Nueva campaña» abre el **compositor**, una sola pagina
que se lee como una frase con bloques cerrados (estilo Talon.One / spec 0017), sin texto libre fuera
del nombre, el mensaje y la etiqueta del cupon:

1. **Audiencia** — «Clientes de **[todos mis locales | seleccion]** que no vienen hace **[N] dias**».
   Debajo, en vivo: «Hoy son **N personas** (M alcanzables por Wallet, K sin local atribuible)».
2. **Canal** — fijo: «Se les muestra tu local en su Wallet cuando pasen a ~100 m, en turnos de 5
   dias. No hay envio: la cola decide cuando le toca a cada uno. Cada cliente tiene como maximo 5
   comercios activos y nunca dos en la misma cuadra.»
3. **Mensaje** — texto ≤ 60 caracteres con vista previa estatica de la linea de pantalla bloqueada
   de iOS, y la nota «En Android el aviso es generico y tu mensaje se ve al abrir el pase».
4. **Beneficio** — «**Sin cupon**» | «**Cupon**: [etiqueta ≤ 40], costo estimado por canje [$],
   tope de canjes [N], producto (opcional)».
5. **Limites y revision** — vigencia (desde / hasta opcional); resumen: audiencia, **turnos que va a
   ocupar** = min(audiencia alcanzable, cuota libre del negocio), **costo maximo** = costo × tope,
   y el aviso «Un 10 % al azar no lo va a ver: asi medimos si funciona». Botones **Guardar
   borrador** y **Activar** (confirmacion + respuesta del servidor; sin exito optimista).

`/backoffice/marketing/[id]` muestra la definicion, las acciones (pausar / reanudar / finalizar /
archivar; editar solo en `draft` o `paused`) y los **resultados** (seccion «Resultados» abajo).

El tile «Campañas» de `/backoffice` pasa a apuntar a `/backoffice/marketing`.

### Lo que ve Marcos

- Pasa por un local con relacion viva → su pase aparece en la pantalla bloqueada (iOS: tarjeta
  pasiva) con **su propio estado**: «Panaderia Luis: te faltan 2 sellos».
- Pasa por un local dormido **con turno activo** → misma tarjeta, con el mensaje de la campaña:
  «Bar La Esquina — 2x1 en picadas hasta el domingo». Si trae cupon, en el mostrador lo escanean y
  ven el cupon para canjear.
- Pasa por un local dormido **sin turno** (en cola, en cooldown, retenido, opt-out) → **nada**.
- Android: notificacion generica de Google «tu pase esta cerca»; al abrir el pase ve un modulo
  «Cerca tuyo: Bar La Esquina — 2x1 en picadas».
- En `/wallet` hay una entrada **«Configuracion»**; adentro, un interruptor por negocio: «Promociones de {negocio}».

### Especificacion tecnica

#### Limites de responsabilidad

- **`server/marketing/`** (dominio): audiencia (SQL), planificador de colocacion (**puro**, sin DB),
  aplicador SQL del tick, texto de utilidad (**puro**), resultados (SQL), canje de cupon (SQL
  transaccional). No conoce React ni proveedores de wallet.
- **`server/wallet/`**: agrega `locations` al pase y la clase `pass_refresh`. Lee `pass_placement`;
  **no decide** que colocar.
- **Backoffice**: captura y muestra; nunca decide elegibilidad ni escribe turnos.
- **Mostrador**: produce el canje de cupon como evento autorizado del staff; el servidor lo valida.
- **Portal del consumidor**: escribe unicamente `marketing_opt_out_at`.

#### Modelo de datos (migracion `0031`, aditiva)

`core.campaign`

| columna | tipo | regla |
|---|---|---|
| `id` | uuid pk | |
| `business_id` | uuid fk `business` cascade | |
| `kind` | text | check `in ('proximity')` — extensible por spec |
| `name` | text not null | ≤ 80 |
| `status` | text | check `in ('draft','active','paused','ended','archived')` |
| `pause_reason` | text null | check `in ('owner','plan_downgraded','no_active_locations')` |
| `dormant_days` | integer not null default 30 | check `between 7 and 365` |
| `message` | text not null | check `char_length(message) between 1 and 60` |
| `coupon_label` | text null | ≤ 40 |
| `coupon_cost` | numeric(12,2) null | check `>= 0` |
| `coupon_max_redemptions` | integer null | check `>= 1` |
| `coupon_product_id` | uuid null fk `product` set null | solo informativo en fase 1 |
| `starts_at` / `ends_at` | timestamptz not null / null | `ends_at > starts_at` |
| `activated_at` / `ended_at` | timestamptz null | |
| `created_by_user_id` | text fk `users` | |
| `created_at` / `updated_at` | timestamptz | |

Check: `(coupon_label is null) = (coupon_cost is null) and (coupon_label is null) =
(coupon_max_redemptions is null)` — el cupon es todo o nada. Indice `(business_id, status)`.

`core.campaign_location` — `(campaign_id fk cascade, location_id fk cascade)` pk compuesta.

`core.campaign_turn`

| columna | regla |
|---|---|
| `id` uuid pk; `campaign_id` fk cascade; `business_id` uuid (denorm.); `consumer_id` fk; `membership_id` fk; `location_id` fk `location` **set null** | |
| `status` | check `in ('queued','active','done','cancelled')` |
| `holdout` boolean not null default false | |
| `queued_at` timestamptz not null default now() | |
| `window_start` / `window_end` timestamptz null | ambos al activar; `window_end = window_start + 5 dias` |
| `message_snapshot` text null; `coupon_label_snapshot` text null; `coupon_cost_snapshot` numeric null | copiados al activar |
| `outcome` | null o check `in ('purchase','coupon_redeemed','none')` |
| `outcome_order_id` uuid null fk `order`; `outcome_redemption_id` uuid null fk `coupon_redemption`; `outcome_at` timestamptz null | |
| `cancel_reason` | null o check `in ('opt_out','campaign_paused','campaign_ended','plan_downgraded','location_archived','location_without_coordinates','membership_gone')` |

Indices: **unico parcial `(campaign_id, consumer_id) where status in ('queued','active')`** (un
turno vivo por campaña y consumidor — es lo que hace idempotente el encolado), `(consumer_id,
status)`, `(campaign_id, status)`, `(business_id, status)`, `(business_id, consumer_id, window_end)`
(cooldown).

`core.coupon_redemption`

| columna | regla |
|---|---|
| `id` uuid pk; `turn_id` fk `campaign_turn` **unique** (un canje por turno); `campaign_id`; `business_id`; `consumer_id`; `membership_id`; `location_id` fk set null (ADR 0042) | |
| `label_snapshot` text; `cost_snapshot` numeric(12,2) | |
| `created_by_user_id` text fk `users` | el staff que canjeo |
| `client_request_id` uuid; **unique `(business_id, client_request_id)`** | idempotencia, mismo patron que `order` y `reward_redemption` |
| `created_at` | |

`consumer.pass_placement` — lo que **esta** en el pase de cada consumidor (lo escribe el tick, lo lee
el pase): `consumer_id` fk cascade, `location_id` fk cascade, `slot_kind` check
`in ('utility','turn')`, `turn_id` uuid null fk, `business_id`, `relevant_text` text (≤ 60),
`computed_at`. Pk `(consumer_id, location_id)`. Check: ≤ 10 filas por consumidor se garantiza en el
aplicador bajo lock (no hay check SQL de conteo; ver plan de pruebas).

`consumer.program_membership.marketing_opt_out_at` timestamptz null — **la escribe solo el portal
del consumidor**. (Discriminante de intencion que solo escribe nuestro codigo del lado consumidor;
`CLAUDE.md`, ADR 0060.)

`consumer.wallet_push_queue`: el check de `class` pasa a `in ('transactional','campaign','pass_refresh')`;
indice unico parcial `(consumer_id) where class = 'pass_refresh' and status = 'pending'` (coalesce:
un refresco pendiente por consumidor).

#### Audiencia «dormidos» (por campaña, en cada tick)

Un consumidor entra en la audiencia de una campaña `active` si:

1. tiene `program_membership` con el programa del negocio (unico operativo por negocio) y
   `marketing_opt_out_at is null`;
2. `greatest(max(order.created_at) del negocio, enrolled_at) <= now() - dormant_days` (cubre «vino y
   no volvio» **y** «se enrolo y nunca volvio»);
3. es **alcanzable**: tiene al menos un `wallet_pass` (cualquier proveedor);
4. tiene **puerta atribuible** dentro de `campaign_location`: en orden, el `location_id` de su ultima
   `order` con el negocio; si no, `membership.origin_location_id`; si no y la campaña tiene
   **exactamente un** local asignado activo, ese; si no, **no elegible** (`sin local atribuible`);
5. no esta en **cooldown**: ningun `campaign_turn` del mismo `business_id` con `window_end >= now()
   - 30 dias`;
6. no tiene un turno vivo (`queued`/`active`) del mismo negocio.

La decision por consumidor es la funcion pura `decideTurnEligibility(input): Eligibility` con tabla
de casos (los 6 motivos de exclusion son valores del resultado y se cuentan en resultados). Los
conteos 3 y 4 se muestran en el compositor («M alcanzables, K sin local atribuible»).

#### El tick (`GET /api/internal/marketing-tick`, Bearer `CRON_SECRET`)

Disparado por `.github/workflows/marketing-tick.yml` cada 6 horas (`0 */6 * * *`) y a mano
(`workflow_dispatch`), igual que `wallet-push-cron.yml`. **Idempotente**: correrlo dos veces seguidas
deja el mismo estado. Pasos, en una corrida:

1. **Encolar.** Para cada campaña `active` cuya `starts_at <= now()` y (`ends_at is null` o
   `> now()`): insertar `queued` para cada consumidor de la audiencia, `on conflict do nothing`
   sobre el unico parcial.
2. **Vencer.** `active` con `window_end < now()` → `done`, con `outcome`: si existe
   `coupon_redemption` del turno → `coupon_redeemed`; si no, la primera `order` `(business_id,
   consumer_id)` con `created_at between window_start and window_end` → `purchase` +
   `outcome_order_id`; si no → `none`. Vale igual para `holdout = true`.
3. **Cancelar.** `queued`/`active` cuya campaña no este `active` (→ `campaign_paused` /
   `campaign_ended` / `plan_downgraded` segun `status`/`pause_reason`), cuya membresia tenga
   `marketing_opt_out_at not null` (→ `opt_out`), cuyo `location_id` sea null o el local no este
   `active` (→ `location_archived`), o cuyo local no tenga coordenadas (→
   `location_without_coordinates`).
4. **Colocar, por consumidor** (todos los que tengan algun turno vivo o `pass_placement`), bajo
   `select … from consumer.consumer_account where id = $1 for update`:
   - `active_turns` = turnos `active` con `holdout = false`, con lat/long del local.
   - Mientras `count(active_turns) < 5`, tomar el siguiente `queued` por `queued_at asc` que cumpla:
     su negocio no tiene otro turno `active` para este consumidor; distancia haversine a **cada**
     local de `active_turns` ≥ 400 m; su negocio tiene < 50 turnos `active` no-holdout en total.
     Activar: `window_start = now()`, `window_end = + 5 dias`, snapshots, `holdout = (random() <
     0.10)`. Un holdout **no** cuenta para el `< 5` ni para la cuota, y **no** entra en
     `active_turns`.
   - `utility` = hasta 3 membresias con relacion viva (`order` en 30 dias, o `points_balance > 0`, o
     `stamps_count > 0`), **sin filtrar por opt-out** (es su propio saldo), con puerta atribuible por
     la misma regla 4 y con coordenadas, ordenadas por ultima actividad desc; texto por
     `utilityText` (abajo).
   - Conjunto objetivo = `utility ∪ active_turns` (≤ 8). Si difiere de `pass_placement` (por
     `location_id` o `relevant_text`): reemplazar filas, `update consumer_account set
     message_updated_at = now()` **sin tocar `latest_message`**, e insertar
     `wallet_push_queue (class='pass_refresh', title='', body='')` con `on conflict do nothing`.
5. Log JSON: `{campaigns, enqueued, activated, holdouts, expired, cancelled, consumers, refreshes}`.

La planificacion del paso 4 es la funcion pura **`planConsumerPlacement(input): PlacementPlan`**
(`server/marketing/placement-plan.ts`, sin DB, con `now` y `random` inyectados), misma factura que
`wallet/push-plan.ts`. El aplicador (`placement.ts`) solo ejecuta el plan.

`utilityText(membership, program, rewards)` (puro): si hay un premio canjeable con el saldo actual
→ `«{negocio}: tenes un premio para canjear»`; si el premio mas barato cuesta C y saldo B < C →
`«{negocio}: te faltan {C−B} {sellos|puntos}»`; si no hay premios → `«{negocio}: {B} {sellos|puntos}»`.
La lectura del costo/objetivo reusa lo que ya sabe `counter/redeem-plan.ts` (`pointsCost` para
puntos, el objetivo del programa para sellos). Truncado a 60.

#### Pase

- **Apple** (`buildPassJson`): `locations: pass_placement.map(({lat, lng, text}) => ({latitude,
  longitude, relevantText: text}))`, ≤ 10. **No** se escribe `maxDistance`.
- **Google** (`buildLoyaltyObject`): `merchantLocations: [{latitude, longitude}]` ≤ 10 (**no**
  `locations`, deprecado) y un `textModulesData` adicional por turno activo (`id: turn-<id>`,
  `header: 'Cerca tuyo'`, `body: '{negocio} — {mensaje}'`), ademas del de «Ultima novedad».
- `passkit.ts` (Apple serve) y el `PATCH` de Google leen `pass_placement`; `message_updated_at`
  ya la subio el tick.

#### Clase `pass_refresh`

- `planConsumerDrain`: una fila `pass_refresh` **siempre** es `send`, **no** avanza `lastPush` y
  **no** reprograma ninguna `campaign` pendiente.
- `deliverTransports`: `pass_refresh` → APNs vacio a cada `wallet_push_device` Apple + `PATCH` del
  objeto de Google; **sin** Web Push, **sin** `addMessage`, **sin** escribir `latest_message` ni
  `last_push_at`.
- El resto (claim, reintentos, `failed`) es el de la cola existente.

#### Backoffice — rutas y API (todas `requireOwner`, scope por `business_id`; id ajeno → 404)

| Ruta | Accion |
|---|---|
| `GET /backoffice/marketing` | listado |
| `GET /backoffice/marketing/new`, `GET /backoffice/marketing/[id]` | compositor / detalle |
| `POST /api/marketing/campaigns` | crea `draft`; 400 `validation` por campo |
| `PATCH /api/marketing/campaigns/[id]` | edita solo `draft`/`paused`; 409 `not_editable` |
| `POST …/[id]/activate` | exige ≥ 1 local activo asignado con coordenadas, plan `plus` (402 `plan_not_allowed`), fechas validas; `draft|paused → active` (`pause_reason = null`, `activated_at`); 409 `invalid_transition` |
| `POST …/[id]/pause` | `active → paused` (`owner`) |
| `POST …/[id]/end` | `active|paused → ended` (`ended_at`) |
| `POST …/[id]/archive` | `ended|paused → archived` |
| `GET /api/marketing/audience-preview?dormantDays=&locationIds=` | los conteos del compositor |
| `GET /api/marketing/campaigns/[id]/results` | DTO de resultados |

Transiciones fuera de la tabla → 409. Cancelar turnos por pausa/fin lo hace el **tick** (paso 3),
no la ruta — y la ruta lo dice en la respuesta («los turnos activos se retiran en el proximo
refresco»).

#### Resultados (DTO; cada campo con su calidad, ADR 0021)

- **Audiencia** (ultimo tick): total, alcanzables, sin local atribuible, opt-out, en cooldown —
  *observada*.
- **Turnos**: en cola / activos / terminados / **retenidos** — *observada*.
- **Compraron durante su ventana**: con turno `x / A` y retenidos `y / B` — *observada*. La linea
  **«Estimacion del efecto: +Z clientes»** = `(x/A − y/B) × A` se muestra **solo si `B ≥ 30`**;
  antes dice «todavia sin señal» — *estimada*. El titulo dice literalmente «compraron durante su
  ventana», nunca «generados por la campaña».
- **Cupones canjeados** `n / tope` y **costo estimado incurrido** `n × costo` — *estimado configurado*.
- **Por local**: turnos, compras en ventana y canjes `group by location_id` (ADR 0042).
- **«Estas en el pase de K de tus C clientes»** — `count(pass_placement where business_id)` /
  membresias — *observada*.

#### Cupon — mostrador

- En el flujo de escaneo existente (`counter/resolve.ts` → `counter-console.tsx`), si el consumidor
  tiene un turno `active`, `holdout = false`, con `coupon_label_snapshot`, `window_start <= now() <=
  window_end`, de este negocio y con la campaña `active`, el panel muestra **«Cupon: {etiqueta} ·
  {campaña} · valido hasta {window_end}»** y el boton **Canjear cupon**.
- `POST /api/counter/coupon-redeem` `{turnId, locationId, clientRequestId}` — sesion de staff
  (`requireBackofficeSession`, local del negocio y `active`, `assertLocationInBusiness`). Transaccion:
  `select … from core.campaign where id = $campaign for update` (serializa todos los canjes de la
  campaña), `select … from core.campaign_turn where id = $turn for update`; verificar en SQL las
  condiciones de arriba y `count(coupon_redemption where campaign_id) < coupon_max_redemptions`;
  insertar `coupon_redemption`; `update campaign_turn set outcome = 'coupon_redeemed',
  outcome_redemption_id, outcome_at`. Errores: 409 `already_redeemed` (unique `turn_id`), 409
  `coupon_cap_reached`, 409 `turn_not_active`, 404 fuera del negocio. Reintento con el mismo
  `clientRequestId` → 200 con la misma fila.
- Encola un aviso **`transactional`** («Canjeaste el cupon «{etiqueta}» 🎁») por el camino de la
  spec 0055. **No toca** `points_balance`/`stamps_count`.
- **`CLAUDE.md`**: el conteo bajo el lock de la campaña es el guard de concurrencia; se cierra con
  `EXPLAIN` del statement real y la carrera del plan de pruebas — nunca por lectura del codigo.

#### Portal del consumidor — seccion «Configuracion»

- `(consumer)/wallet/page.tsx` gana una entrada **«Configuracion»** →
  `(consumer)/wallet/settings/page.tsx` (misma sesion de consumidor que el portal; sin sesion →
  redirect al portal). Lista **una fila por membresia**: nombre del negocio + interruptor
  **«Promociones de {negocio}»**, **encendido por defecto** (escanear = alta + consentimiento,
  ADR 0033 §2). Debajo, texto fijo: «Si lo apagas dejas de recibir promociones de ese comercio.
  Los avisos de tus puntos y sellos, y tu saldo en el pase, siguen igual.»
- `POST /api/public/consumer/marketing-opt-out` `{programId, optOut}` con sesion de consumidor;
  escribe/borra `marketing_opt_out_at` de **su** membresia (404 si no es suya). Efecto: sale de la
  audiencia, sus turnos vivos se cancelan en el proximo tick (`opt_out`) y salen del pase en el
  proximo refresco. **Lo transaccional y la bolsa de utilidad no cambian** — el saldo propio no es
  publicidad (ADR 0065 §1).

#### Freno por plan — BLOQUEO DURO, como locales

Decision del owner: «Free no puede crear ni activar campañas; para bajar de plan debe desactivar las
campañas activas como sucede con los locales». Se calca el mecanismo existente, que es una **funcion
pura con orden de guardas declarado** (`billing/plan-change.ts`), no una pausa automatica.

- `PlanChangeInput` suma `activeCampaigns: number`. En `decideDowngrade` se agrega una guarda con
  codigo **`downgrade_blocked_campaigns`** y `deactivateCount`, **despues** de la de locales y
  **antes** de `already_on_plan`. El orden declarado en el docblock es normativo y el unit lo
  asevera (igual que hoy). Mensaje: «Para volver a Free no puedes tener campañas activas; hoy
  tienes {N}. Desactiva {N}.»
  - **Consecuencia aceptada y declarada:** un negocio que viola las **dos** condiciones recibe
    primero el bloqueo de locales y, tras archivar, el de campañas. Son dos vueltas. Mostrar ambas
    juntas exigiria que `PlanChangeDecision` llevara los dos contadores; se deja como posible
    mejora, no entra. *(Orquestador.)*
- `activate` exige `plan = 'plus'` con suscripcion viva (misma fuente que `effectiveLocationLimit`);
  si no, **402 `plan_not_allowed`**. `POST /api/marketing/campaigns` (crear `draft`) tambien lo
  exige: un `free` no compone campañas.
- **Residual que la regla del owner no cubre, y que hay que cubrir igual** *(decision del
  ORQUESTADOR, no del owner — ver «Decisiones del ORQUESTADOR»)*: el bloqueo vive en **nuestra**
  ruta, y el plan puede aterrizar en `free`/`none` **sin pasar por ella** — cancelacion desde el
  dashboard de Stripe o impago (ADR 0060/0063, que ya pagaron esta leccion). Para que el invariante
  «un negocio free no corre campañas» no dependa de un camino que no controlamos: cuando
  `billing/webhook-apply.ts` escribe un plan derivado `free`/`none`, en la **misma transaccion**
  hace `update campaign set status='paused', pause_reason='plan_downgraded' where business_id and
  status='active'`. El tick cancela los turnos (`plan_downgraded`). Reanudar exige volver a `plus`.
  Esto **no** reemplaza el bloqueo duro: es la red para el camino que el bloqueo no ve.

#### Autorizacion y aislamiento

Owner: campañas y resultados. Staff: solo el canje de cupon, con local activo del negocio.
Consumidor: solo su opt-out. `CRON_SECRET`: solo el tick. Ningun DTO al navegador lleva
`*ObjectKey`, tokens ni `client_request_id` de terceros.

#### Observabilidad

Log estructurado del tick (arriba), de cada canje (`campaign_id`, `turn_id`, `location_id`,
resultado) y de cada opt-out (`program_id`, on/off). Errores de `pass_refresh` quedan en
`wallet_push_queue.last_error` como hoy.

### Arquitectura de referencia

ADR 0064 (encuadre), **0065** (este canal), 0018/0022/0023 (composicion cerrada), 0002 (costo
declarado), 0006 (locales asignados), 0021 (calidad de metricas), 0033 (pase unico), 0037/0040
(cola y ruteo por clase), 0042 (`location_id` en todo evento de valor), 0054 (concurrencia: el guard
va en el `WHERE`/lock, no en un `NOT EXISTS`), 0060 (discriminante que solo escribimos nosotros),
0044/0056 (owner vs staff).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/schema/campaign.ts` | crear: `campaign`, `campaign_location`, `campaign_turn`, `coupon_redemption`, `pass_placement` |
| `apps/merchant/src/server/schema/consumer.ts` | editar: `marketing_opt_out_at`; check de `class` + unico parcial `pass_refresh` |
| `apps/merchant/src/server/schema.ts` | editar: re-export |
| `apps/merchant/drizzle/0031_*.sql` (+ `meta`) | crear (drizzle-kit) |
| `apps/merchant/src/server/marketing/audience.ts` | crear: SQL de audiencia + `decideTurnEligibility` (puro) |
| `apps/merchant/src/server/marketing/placement-plan.ts` | crear: `planConsumerPlacement` (puro) + haversine |
| `apps/merchant/src/server/marketing/placement.ts` | crear: aplicador SQL del tick (pasos 1-5) |
| `apps/merchant/src/server/marketing/utility-text.ts` | crear: `utilityText` (puro) |
| `apps/merchant/src/server/marketing/campaign-store.ts` | crear: CRUD + transiciones |
| `apps/merchant/src/server/marketing/results.ts` | crear: DTO de resultados |
| `apps/merchant/src/server/marketing/coupon-redeem.ts` | crear: canje transaccional |
| `apps/merchant/src/server/wallet/apple.ts`, `google.ts`, `passkit.ts` | editar: `locations` / `merchantLocations` + modulos, lectura de `pass_placement` |
| `apps/merchant/src/server/wallet/push-plan.ts`, `push.ts`, `push-transports.ts` | editar: clase `pass_refresh` |
| `apps/merchant/src/app/api/internal/marketing-tick/route.ts` | crear |
| `.github/workflows/marketing-tick.yml` | crear (secrets `MARKETING_TICK_ENDPOINT`, `CRON_SECRET`) |
| `apps/merchant/src/app/api/marketing/**` | crear: rutas de la tabla |
| `apps/merchant/src/app/backoffice/marketing/page.tsx`, `new/page.tsx`, `[id]/page.tsx` (+ componentes) | crear |
| `apps/merchant/src/app/backoffice/page.tsx` | editar: tile «Campañas» |
| `apps/merchant/src/server/counter/resolve.ts`, `app/backoffice/counter/{counter-console,redeem-panel}.tsx` | editar: panel de cupon |
| `apps/merchant/src/app/api/counter/coupon-redeem/route.ts` | crear |
| `apps/merchant/src/app/(consumer)/wallet/page.tsx` | editar: entrada «Configuracion» |
| `apps/merchant/src/app/(consumer)/wallet/settings/page.tsx` | crear: seccion de configuracion (opt-out por negocio) |
| `apps/merchant/src/app/api/public/consumer/marketing-opt-out/route.ts` | crear |
| `apps/merchant/src/server/billing/plan-change.ts` | editar: guarda `downgrade_blocked_campaigns` + `activeCampaigns` en el input |
| `apps/merchant/src/app/backoffice/subscription/**`, `apps/merchant/src/app/api/billing/**` | editar: pasar `activeCampaigns` y mostrar el bloqueo en el modal |
| `apps/merchant/src/server/billing/webhook-apply.ts` | editar: pausa defensiva `plan_downgraded` |
| tests: `server/marketing/*.test.ts`, `server/marketing-*.neon.integration.test.ts`, `server/wallet-push*.test.ts`, `app/backoffice/marketing/*.test.tsx` | crear / editar |
| `docs/specs/0017-campanas-owner-demo.md` | editar al implementar: «superada por la 0065» |

### Disjunta?

**No.** Toca `wallet/push*.ts` (compartidos con cualquier spec de push), `billing/*` (freno por
plan), `counter/*` (spec 0055) y `backoffice/page.tsx`. Se serializa; no corre en paralelo con
ninguna spec que toque esos archivos.

### Archivos compartidos

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| Migracion `0031` aplicada en la rama de integracion (`ci-integration`) | orquestador | antes de la fase A |
| Secrets `MARKETING_TICK_ENDPOINT` / `CRON_SECRET` en GitHub | owner | antes del QA en prod |

### Fases (cada una con PASS de revisor independiente antes de la siguiente)

- **A — Fundacion**: schema + migracion, audiencia, `planConsumerPlacement`, aplicador del tick,
  `utilityText`, `pass_refresh`, `locations` en Apple y Google, endpoint del tick + workflow.
- **B — Backoffice**: listado, compositor, detalle, resultados, tile.
- **C — Cupon**: mostrador + `coupon-redeem` + aviso transaccional.
- **D — Consumidor y plan**: seccion «Configuracion» + opt-out; guarda `downgrade_blocked_campaigns`
  en `decidePlanChange` + modal; pausa defensiva del webhook.

## Definition of Done

- [ ] Un owner `plus` compone y activa una campaña de proximidad con audiencia «dormidos hace N
      dias» sobre locales elegidos; el compositor muestra los conteos reales (`audience-preview`)
      y el costo maximo antes de activar; `free` recibe 402 `plan_not_allowed`.
- [ ] El tick encola, activa, vence y cancela turnos y es **idempotente** (dos corridas seguidas
      no cambian filas); su log JSON refleja los conteos.
- [ ] En el pase de cada consumidor hay **≤ 10** ubicaciones: ≤ 3 de utilidad con su texto de
      saldo y ≤ 5 turnos no-holdout, **ninguna pareja de turnos a < 400 m**, **≤ 1 turno por
      negocio**, y **ningun** turno `holdout` — verificado por SQL sobre `pass_placement` y por el
      JSON del pase (`locations` en Apple, `merchantLocations` + modulos en Google).
- [ ] Un consumidor en cooldown, sin pase, sin local atribuible o con opt-out **no** recibe turno,
      y el motivo se cuenta en resultados.
- [ ] Un negocio no supera 50 turnos activos no-holdout; el 51.º queda en cola.
- [ ] `pass_refresh` no modifica `last_push_at` ni `latest_message`, no reprograma una `campaign`
      pendiente, no envia Web Push ni `addMessage`; hay a lo sumo una pendiente por consumidor.
- [ ] Cambiar `pass_placement` sube `message_updated_at`; el serve de Apple responde el pase nuevo a
      `passesUpdatedSince`.
- [ ] El canje de cupon es **atomico e idempotente**: dos canjes concurrentes del mismo turno dejan
      **una** fila (verificado por SQL); dos canjes concurrentes de turnos distintos con un solo
      cupo restante dejan **una** fila; el reintento con el mismo `clientRequestId` devuelve la
      misma fila; el `EXPLAIN` del statement muestra el guard **despues** del lock. No cambia
      saldos.
- [ ] Al canjear se encola un aviso `transactional` con la etiqueta snapshot.
- [ ] Resultados: los titulos dicen «compraron durante su ventana»; la estimacion aparece solo con
      `B ≥ 30` retenidos; «estas en el pase de K de C» coincide con `pass_placement`.
- [ ] Pausar/finalizar/opt-out/bajar de plan/archivar local retiran los turnos en el siguiente
      tick y el pase deja de llevar esa ubicacion en el siguiente refresco.
- [ ] En «Configuracion» del portal el consumidor apaga las promociones de UN negocio: deja de
      recibir turnos de ese negocio, y **siguen** su aviso transaccional y su ubicacion de utilidad
      con el saldo. La marca `marketing_opt_out_at` la escribe **solo** esa accion (ningun otro
      camino del arbol la escribe — verificado por barrido).
- [ ] **Bajar de plan con una campaña activa esta BLOQUEADO**: `decidePlanChange` devuelve
      `downgrade_blocked_campaigns` con `deactivateCount`, el modal lo dice, y el downgrade recien
      procede cuando no queda ninguna `active`. Un `free`/`none` recibe 402 `plan_not_allowed` al
      crear y al activar.
- [ ] Si el plan aterriza en `free`/`none` **sin pasar por nuestra ruta** (webhook), las campañas
      `active` quedan `paused` con `plan_downgraded` en la misma transaccion, y el tick retira sus
      turnos.
- [ ] Owner de A no ve, edita ni obtiene resultados de campañas de B (404); staff no puede crear
      ni activar; el tick sin `CRON_SECRET` → 401.
- [ ] El tile «Campañas» lleva a `/backoffice/marketing`; la spec 0017 queda anotada como superada.
- [ ] QA del owner en dispositivos reales (abajo) en verde, con `Vercel: success` verificado para el
      sha exacto antes de pedirlo.
- [ ] Revisor independiente emite PASS por fase (`docs/AGENT-WORKFLOW.md`).

## Plan de pruebas y verificacion

- [ ] Unit `decideTurnEligibility`: tabla de casos con los 6 motivos de exclusion y el elegible.
- [ ] Unit `planConsumerPlacement`: (a) 7 en cola, 0 activos → activa 5 respetando 400 m y FIFO;
      (b) dos en cola a 200 m → activa una, la otra queda; (c) mismo negocio dos veces → una;
      (d) cuota del negocio agotada → queda en cola; (e) `random` < 0.10 → `holdout`, no cuenta;
      (f) utilidad > 3 → las 3 mas recientes; (g) conjunto identico → `refresh: false`.
      **Mutaciones a ejecutar y transcribir**: quitar la regla de 400 m → rojo (b); quitar «1 por
      negocio» → rojo (c); contar holdouts en el `< 5` → rojo (e).
- [ ] Unit `utilityText`: premio canjeable / faltan N / sin premios, puntos y sellos, truncado.
- [ ] Unit `planConsumerDrain`: `pass_refresh` con `lastPush` reciente → `send` y **no** avanza el
      reloj; una `campaign` que sigue → no se reprograma. Mutacion: tratar `pass_refresh` como
      `transactional` → rojo.
- [ ] Unit `buildPassJson` / `buildLoyaltyObject`: ≤ 10 ubicaciones, `relevantText`, sin
      `maxDistance`; `merchantLocations` (no `locations`) + modulos por turno.
- [ ] Integracion (Neon) tick: seed con 1 negocio, 3 locales (dos a 150 m), 8 consumidores en
      distintos estados → correr dos veces → aseverar por SQL turnos, `pass_placement`,
      `message_updated_at` y **una** fila `pass_refresh`; segunda corrida sin cambios.
- [ ] Integracion vencimiento/outcome: orden dentro de ventana → `purchase`; canje → `coupon_redeemed`;
      nada → `none`; holdout con orden → `purchase` igual.
- [ ] Integracion cancelacion: pausa, opt-out, local archivado, baja de plan → `cancelled` con su
      razon, y el siguiente tick saca la ubicacion del pase.
- [ ] Integracion canje: **carrera** de 2 `coupon-redeem` simultaneos sobre el mismo turno → 1 fila;
      carrera de 2 turnos distintos con `coupon_max_redemptions − count = 1` → 1 fila; mismo
      `clientRequestId` → misma fila; `EXPLAIN (VERBOSE)` transcripto en el handoff con el guard en el
      nodo post-lock. **Mutacion**: quitar el `for update` de la campaña → rojo la carrera del cupo.
- [ ] Integracion `pass_refresh` end-to-end con el `FakeWalletProvider`: se llama APNs y `PATCH`,
      no Web Push; `last_push_at` y `latest_message` intactos (por SQL).
- [ ] Unit `decidePlanChange`: tabla con `activeCampaigns` 0/1/3 × `activeLocations` 1/3 ×
      `currentPlan`, aseverando el **orden declarado** (locales → campañas → `already_on_plan`) y
      `deactivateCount`. **Mutaciones**: mover la guarda de campañas antes de la de locales → rojo
      el caso que viola ambas; borrar la guarda → rojo el bloqueo.
- [ ] Integracion: webhook que deriva `free`/`none` con 2 campañas `active` → las dos quedan
      `paused`/`plan_downgraded` en la misma transaccion que el plan (por SQL); el tick siguiente
      cancela sus turnos y el pase los suelta. **Mutacion**: sacar el `update` de la transaccion →
      rojo.
- [ ] Barrido estatico: `marketing_opt_out_at` se escribe en **un solo** archivo
      (`api/public/consumer/marketing-opt-out/route.ts`); piso de archivos escaneados > 50.
- [ ] Autorizacion: owner A → campañas de B: 404 en las 8 rutas; staff → `activate`: 403; tick sin
      Bearer: 401; opt-out de una membresia ajena: 404; `/wallet/settings` sin sesion → redirect.
- [ ] Render (`renderToStaticMarkup` + `node-html-parser`, sin jsdom — gotcha de `CLAUDE.md`):
      compositor con los 5 bloques y conteos; resultados con los titulos exactos y la estimacion
      oculta con `B < 30`.
- [ ] Barrido estatico: ningun DTO de `api/marketing/**` serializa `client_request_id` ajeno ni
      `*ObjectKey` (piso de archivos escaneados > 0).
- [ ] Comandos exactos: `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`,
      `pnpm run test`, `pnpm run build`; integracion con las env de `ci-integration` como en la
      spec 0062 (**nunca** con `DATABASE_URL` pelado: skipea en silencio).
- [ ] Verificacion manual del owner (**es el oraculo que define**, `CLAUDE.md`): iPhone real con el
      pase instalado + consumidor de prueba dormido + campaña activa → caminar hasta la puerta del
      local → la tarjeta aparece con el mensaje; pasar por el local de utilidad → aparece el saldo;
      pasar por un local dormido **sin** turno → nada; canjear el cupon en el mostrador → cupon
      visible, canje, aviso en el pase; segundo intento → «ya canjeado». Android real: notificacion
      generica al quedarse cerca, mensaje dentro del pase. Anotar el radio y el tiempo de *dwell*
      observados: son los datos que faltan.

## Handoff requerido

Implementador y revisor usan `docs/AGENT-WORKFLOW.md`. Cada fase cierra con PASS independiente.
Toda mutacion se etiqueta `MUTATION`, se registra con `shasum` **antes** de mutar y se revierte
con `diff` contra la copia limpia. El encargo a cada revisor lleva **presupuesto**: las mutaciones
listadas arriba y las que salgan de los docblocks nuevos que afirmen un invariante; nada mas.

## Decisiones del ORQUESTADOR (etiquetadas, no del owner)

Todas configurables y a ajustar con el QA real: utilidad ≤ 3 y su formato de texto; cooldown 30
dias (derivado del «una oportunidad por mes» del owner); holdout 10 %; cuota 50; mensaje ≤ 60 y
etiqueta ≤ 40; `dormant_days` 7–365 con default 30; tick cada 6 h; la separacion de 400 m rige
solo entre turnos (no contra utilidad); el opt-out no apaga la utilidad; en Android el mensaje va
en un modulo del pase; el cupon no se liga al catalogo mas alla de un `product_id` informativo;
umbral `B ≥ 30` para mostrar la estimacion; la cancelacion por pausa/plan la ejecuta el tick y no
la ruta.

**Dos que valen aparte, porque el owner decidio el principio pero no el detalle:**

1. **Orden de las guardas del downgrade**: locales primero, campañas despues, y por lo tanto **dos
   bloqueos secuenciales** para quien viola ambas. Preserva el orden normativo y los tests
   existentes; el mensaje combinado queda como mejora posible.
2. **La pausa defensiva del webhook.** El owner pidio bloqueo duro; el bloqueo vive en nuestra ruta
   y el plan puede llegar a `free`/`none` por el dashboard de Stripe o por impago, sin pasar por
   ahi (es literalmente el agujero que costo dos rondas en la spec 0063, ADR 0060). La pausa cubre
   ese camino para sostener el invariante que el owner SI decidio («free no corre campañas»). Si
   prefiere que en ese caso las campañas sigan corriendo hasta que alguien las apague a mano, es un
   cambio de una linea — pero hay que decirlo.

## Abierto

**Nada bloqueante.** Los dos items que faltaban los cerro el owner el 2026-09-15: el opt-out vive en
una **seccion de Configuracion** del portal del consumidor, y el freno por plan es **bloqueo duro al
bajar** (desactivar las campañas activas primero), no una pausa automatica — con la pausa defensiva
del webhook cubriendo el camino que el bloqueo no ve, etiquetada como decision del orquestador.

Queda registrado, sin bloquear, para cuando se retome el arco:

- Los parametros numericos del orquestador (cooldown 30 d, holdout 10 %, cuota 50, utilidad ≤3, tick
  cada 6 h) se ajustan con el QA en la calle; el QA tiene que anotar el **radio** y el **tiempo de
  dwell** observados, que son los dos datos que ninguna documentacion nos dio.
- El **merito por resultado** se enciende cuando el holdout de una diferencia legible (ADR 0065 §4).
- La **categoria del negocio** no existe y el ADR 0021 la pide: hara falta para los tipos de campaña
  que segmenten por rubro, no para este.
