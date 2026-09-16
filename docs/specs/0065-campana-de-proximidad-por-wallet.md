---
spec: 0065
fecha: 2026-09-15
estado: cerrada (2026-09-15, segunda vez). Paso por una revision adversarial de 3 revisores (FAIL unanime, 16 bloqueantes) mas un 17.º que salio de correr el SQL contra Postgres real; los 17 estan corregidos aca y **verificados empiricamente**, no por cita. El owner cerro las dos preguntas que quedaban: en una puerta compartida se muestran **las dos cosas fusionadas** (no gana el turno), y el **merito con balanza rige desde el dia uno** (ADR 0066, que supersede la decision 4 del ADR 0065)
resumen: Primera campaña real del motor de marketing (ADR 0064) y primer tipo de campaña con spec propia (ADR 0065): el owner compone «clientes de mis locales que no vienen hace N dias → se les muestra mi local en su Wallet cuando pasen cerca → mensaje → cupon opcional», la cola coloca TURNOS de 5 dias en el campo `locations` del pase (≤5 activos por consumidor, ≥400 m entre si, 1 por negocio, FIFO, cooldown 30 dias, cuota de 50 turnos concurrentes por negocio, holdout 10 %), el pase se refresca en silencio por una clase nueva `pass_refresh`, el cupon se canjea en el mostrador de forma atomica e idempotente, y la pantalla de resultados muestra SOLO metricas observadas (ADR 0021) salvo la diferencia con/sin turno. El consumidor apaga las promociones de un negocio desde una seccion de **Configuracion** de su portal, sin perder lo transaccional ni su saldo en el pase. `free`/`none` no crea ni activa campañas, y **bajar de plan esta BLOQUEADO mientras haya campañas activas** — el owner las desactiva primero, igual que archiva locales (guarda nueva en `decidePlanChange`). Fija el journey de composicion y la pantalla de resultados que heredan los demas tipos de campaña. Reemplaza la demo de la spec 0017.
disjunta: no
archivos: apps/merchant/src/server/schema/{campaign,consumer}.ts, apps/merchant/src/server/marketing/**, apps/merchant/src/server/wallet/{apple,google,passkit,provider,push,push-plan,push-transports,push-worker,push-channel}.ts, apps/merchant/src/app/api/public/wallet/**, apps/merchant/src/app/backoffice/marketing/**, apps/merchant/src/app/backoffice/{page,counter/*}.tsx, apps/merchant/src/app/api/{marketing,internal/marketing-tick,counter/coupon-redeem,public/consumer/marketing-opt-out}/**, apps/merchant/src/app/(consumer)/wallet/page.tsx, apps/merchant/src/server/billing/{webhook-apply,plan-change}.ts, apps/merchant/drizzle/0031_*.sql, .github/workflows/marketing-tick.yml
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
- **Merito por resultado** en la cola (rotacion pura; ADR 0065 §4) — *el owner decidio «merito con
  balanza, piso para debutantes»; quien lo DIFIERE en proximidad es el orquestador, ver «Decisiones
  del ORQUESTADOR» §3 y «Abierto»*. Score de recuperabilidad.
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

Indices: **unico parcial `(business_id, consumer_id) where status in ('queued','active')`** (un
turno vivo por **NEGOCIO** y consumidor — es lo que hace idempotente el encolado **y** lo que
sostiene el invariante del ADR 0065 §2). **No** es por `campaign_id`: nada impide dos campañas
`active` del mismo negocio (la cuota es en turnos, no en campañas), y con el indice por campaña
entraban dos turnos del mismo negocio para el mismo consumidor — el segundo se activaba el dia que
vencia el primero, dandole al negocio dos ventanas seguidas. El `on conflict do nothing` del paso 1
absorbe la segunda campaña del mismo negocio. Los demas: `(consumer_id, status)`,
`(campaign_id, status)`, `(business_id, status)`, `(business_id, consumer_id, window_end)` (cooldown).

`core.coupon_redemption`

| columna | regla |
|---|---|
| `id` uuid pk; `turn_id` fk `campaign_turn` **unique** (un canje por turno); `campaign_id`; `business_id`; `consumer_id`; `membership_id`; `location_id` fk set null (ADR 0042) | |
| `label_snapshot` text; `cost_snapshot` numeric(12,2) | |
| `created_by_user_id` text fk `users` | el staff que canjeo |
| `client_request_id` uuid; **unique `(business_id, client_request_id)`** | idempotencia, mismo patron que `order` y `reward_redemption` |
| `created_at` | |

`core.campaign_tick_audience` — la **foto** de la audiencia de cada campaña en cada tick:
`campaign_id` fk cascade, `ran_at` timestamptz, y los cinco conteos `total`, `reachable`,
`no_location`, `opt_out`, `cooldown`. Pk `(campaign_id, ran_at)`; la escribe el paso 1 del tick.
**Es lo que hace verificable el DoD «el motivo se cuenta en resultados»:** un consumidor excluido no
deja fila en ninguna otra tabla, asi que sin esto los cinco numeros de la pantalla de resultados no
se pueden reconstruir por SQL despues del tick — y recalcularlos al vuelo mentiria, porque el
cooldown y el opt-out de hoy no son los del tick. Sin esta tabla ese item del DoD solo se podia
marcar leyendo el codigo.

`consumer.pass_placement` — lo que **esta** en el pase de cada consumidor (lo escribe el tick, lo lee
el pase): `consumer_id` fk cascade, `location_id` fk cascade, `slot_kind` check
`in ('utility','turn','both')`, `turn_id` uuid null fk, `business_id`, `relevant_text` text
(**≤ 120**, no 60), `computed_at`. Pk `(consumer_id, location_id)`. Check: ≤ 10 filas por consumidor se garantiza en el
aplicador bajo lock (no hay check SQL de conteo; ver plan de pruebas).

**Corregido al implementar A1 (2026-09-15):** esta fila decia `in ('utility','turn')` y `≤ 60` — las
dos eran la foto anterior a la fusion que decidio el owner el mismo dia, y las dos estaban
**refutadas dos secciones mas abajo** por «Una puerta, un texto» (`both` y `cap` 120). El **60 no era
cosmetico**: es el cap de `utilityText` **solo**, y esta columna guarda tambien el texto **compuesto**
— el ejemplo literal del owner («Bar La Esquina: te faltan 2 sellos · 2x1 en picadas hasta el
domingo») mide **68 caracteres**, asi que con el check en 60 **todo** `slot_kind = 'both'` moria con
`23514` en produccion, que es el perfil central de la audiencia y no un borde. Lo cazo el
implementador y lo verifico el orquestador contra la rama: con el check en 120, 68 entra y 121
devuelve `23514`.

**Una puerta, un texto: se FUSIONAN (decision del owner, 2026-09-15).** Las dos bolsas **no son
disjuntas** y la pk lo prohibe. «Dormido» mira solo ordenes; «relacion viva» incluye
`points_balance > 0` / `stamps_count > 0`, asi que el cliente que compro hace 60 dias y quedo con 1
sello esta en **las dos** y con la **misma** puerta atribuible — que es el perfil central de la
audiencia, no un borde. Sin una regla explicita el paso 4 muere con `23505`, o —si el implementador
dedupea de cualquier manera— el turno queda `active` ocupando cupo y cuota **sin estar en el pase**,
y el DoD «el pase lleva el mensaje» falla sin ninguna señal.

El owner decidio **mostrar las dos cosas** («si es del mismo local ¿por que no mostrar ambos? si
tenemos margen de seguridad»). El pase acepta **un** `relevantText` por ubicacion, asi que fusionar
no es apilar dos filas: es **componer un texto**. `slot_kind` pasa a
`in ('utility','turn','both')`, y el texto lo arma la funcion pura
**`composeRelevantText(utility, campaign, cap)`** (`marketing/relevant-text.ts`):

- Formato: **`{negocio}: {saldo} · {mensaje}`** — el nombre del negocio va **una sola vez**.
  Ej.: «Bar La Esquina: te faltan 2 sellos · 2x1 en picadas hasta el domingo».
- **El «margen de seguridad» es la condicion, no un adorno**: si el compuesto supera `cap`, **gana
  el mensaje de campaña** y el saldo se cae (no se trunca a la mitad de una palabra ni se parte el
  texto). Regla determinista, con su caso en la tabla del unit — no «lo que entre».
- `cap`: **120** *(ORQUESTADOR)*. **Apple no documenta ningun limite de `relevantText`** y la
  pantalla bloqueada trunca por ancho, no por caracteres: **no declaro un limite que no medi**. El
  numero real sale del QA en un iPhone de verdad, y **medirlo es un item del DoD** — es uno de los
  datos que ninguna documentacion nos dio, junto con el radio y el *dwell*.
- **Orden del compuesto (saldo antes que oferta): tambien del ORQUESTADOR y tambien a validar en el
  QA.** Si el corte se come la cola, lo que se pierde es la oferta; si el QA muestra que trunca,
  invertir el orden es un cambio de una linea.
- Google no tiene texto por ubicacion: el compuesto va en el modulo del objeto, misma funcion.

`consumer.program_membership.marketing_opt_out_at` timestamptz null — **la escribe solo el portal
del consumidor**. (Discriminante de intencion que solo escribe nuestro codigo del lado consumidor;
`CLAUDE.md`, ADR 0060.)

`consumer.wallet_push_queue`: el check de `class` pasa a `in ('transactional','campaign','pass_refresh')`.
**Sin indice unico**: el coalescing («un refresco pendiente por consumidor») se hace con
`insert … select … where not exists (select 1 from wallet_push_queue where consumer_id = $1 and
class = 'pass_refresh' and status in ('pending','sending'))`, y es seguro porque el tick corre de a
uno (advisory lock, paso 0). **Un unico parcial sobre `status = 'pending'` seria un bug de
produccion:** el worker devuelve una fila fallida a `pending` en el **mismo** `UPDATE` que
incrementa `attempts` (`wallet/push.ts:199-203`), asi que si mientras estaba en `sending` entro un
refresco nuevo, esa vuelta viola el unico → el `UPDATE` entero falla → `attempts` **no** sube, la
fila queda clavada en `sending`, y `claimRow` (`push.ts:118-126`) la re-reclama para siempre
comiendose el cupo de cada corrida. El error ademas cae en el `swallow` de `push.ts:232`.

#### Merito: el orden de la cola (ADR 0066)

`marketing/merit.ts` — SQL que devuelve, por negocio con turnos `done`:
`placed_n`, `placed_purchases`, `holdout_n`, `holdout_purchases`. La funcion **pura**
`businessScore(stats, globalLift, alpha)` calcula
`lift = placed_purchases/placed_n − holdout_purchases/holdout_n` y lo encoge:
`(lift · n + globalLift · α) / (n + α)`, con `n = placed_n` y **α = 20** *(ORQUESTADOR)*.
Un negocio sin historia puntua `globalLift` — **en el medio de la tabla, no ultimo** (el «piso para
debutantes» del owner). `globalLift` sin ningun turno vencido en la plataforma = **0**
*(ORQUESTADOR)*; con todos empatados, manda el desempate FIFO, que es lo que va a regir las primeras
semanas. Divisor cero (`placed_n` o `holdout_n` en 0) → ese termino es 0, no `NaN`: caso de la tabla
del unit.

#### Audiencia «dormidos» (por campaña, en cada tick)

Un consumidor entra en la audiencia de una campaña `active` si:

1. tiene `program_membership` con el programa del negocio (unico operativo por negocio) y
   `marketing_opt_out_at is null`;
2. `greatest(max(order.created_at) del negocio, enrolled_at) <= now() - dormant_days` (cubre «vino y
   no volvio» **y** «se enrolo y nunca volvio»);
3. es **alcanzable**: tiene al menos un `wallet_pass` (cualquier proveedor);
4. tiene **puerta atribuible** dentro de `campaign_location`, **`status = 'active'` y con
   `latitude`/`longitude` no nulos**: en orden, el `location_id` de su ultima `order` con el negocio;
   si no, `membership.origin_location_id`; si no y la campaña tiene **exactamente un** local asignado
   que cumpla esas condiciones, ese; si no, **no elegible** (`sin local atribuible`).
   **Las dos condiciones del local son parte del filtro del paso 1, no solo del paso 3.** Regla
   general: *todo motivo estable de cancelacion del paso 3 tiene que ser tambien filtro del paso 1*.
   Sin esto, un local sin geocodificar (lat/long son **nullable**, `schema/business.ts:174-175`) o
   archivado despues de activar la campaña —la ruta `activate` exige **≥1** local bueno, no todos—
   se encola en el paso 1 y se cancela en el paso 3 **de la misma corrida**; el turno cancelado no
   ocupa el unico parcial, asi que la corrida siguiente lo vuelve a insertar: 4.000 filas/dia con
   1.000 dormidos, la audiencia de resultados los cuenta como elegibles, y el DoD «dos corridas
   seguidas no cambian filas» es **falso**;
5. no esta en **cooldown**: ningun `campaign_turn` del mismo `business_id` **con
   `status in ('active','done')`** y `window_end >= now() - 30 dias`. **El filtro por `status` es
   load-bearing:** un turno `cancelled` conserva su `window_end` (el paso 3 solo escribe `status` y
   `cancel_reason`), asi que sin el, pausar una campaña un dia para corregir una falta de ortografia
   —camino que la propia spec prescribe en «No entra»— cancela sus turnos y deja a **toda** la
   audiencia bloqueada 30 dias, con la campaña activa, sin turnos y sin motivo visible. Identico con
   `plan_downgraded`: volver a pagar a los dos dias no recuperaria la audiencia. Solo quema la
   oportunidad el turno que **la consumio**;
6. no tiene un turno vivo (`queued`/`active`) del mismo negocio.

La decision por consumidor es la funcion pura `decideTurnEligibility(input): Eligibility` con tabla
de casos (los 6 motivos de exclusion son valores del resultado y se cuentan en resultados). Los
conteos 3 y 4 se muestran en el compositor («M alcanzables, K sin local atribuible»).

#### El tick (`GET /api/internal/marketing-tick`, Bearer `CRON_SECRET`)

Disparado por `.github/workflows/marketing-tick.yml` cada 6 horas (`0 */6 * * *`) y a mano
(`workflow_dispatch`), igual que `wallet-push-cron.yml`. **Idempotente**: correrlo dos veces seguidas
deja el mismo estado. Pasos, en una corrida:

0. **Un tick por vez: `pg_try_advisory_lock(<clave fija>)`**; si no lo obtiene, responde 200 con
   `{skipped: 'tick_in_flight'}` y no hace nada. **No es decorativo:** la cuota por negocio se cuenta
   bajo el lock del **consumidor** (paso 4), que no cubre el conjunto contado — dos ticks solapados
   (`workflow_dispatch` mientras corre el cron, o una corrida que se pasa de los 6 h) lockean
   consumidores **distintos**, no se serializan, ambos leen 49 y activan: 51. El advisory lock es
   tambien lo que hace seguro el coalescing por `not exists` del `pass_refresh`. El workflow ademas
   declara `concurrency:` (como `wallet-push-cron.yml`), pero eso **no alcanza**: en este repo la
   exclusion se resuelve en SQL, no en el scheduler (`wallet/push.ts:110-126`, «Race-safe claim»,
   pese a que su cron ya trae grupo de concurrencia).
1. **Encolar.** Para cada campaña `active` cuya `starts_at <= now()` y (`ends_at is null` o
   `> now()`): insertar `queued` para cada consumidor de la audiencia con
   **`on conflict (business_id, consumer_id) where status in ('queued','active') do nothing`** — el
   `do nothing` es tambien lo que absorbe una segunda campaña del mismo negocio sobre el mismo
   consumidor. **El `where` del conflict target NO es opcional y no es estetica:** contra un indice
   **parcial**, un `on conflict (business_id, consumer_id) do nothing` pelado falla con
   `there is no unique or exclusion constraint matching the ON CONFLICT specification`, o sea que el
   tick **reventaba en su primera corrida**. Verificado contra Postgres 18 real (Neon), no leido:
   sin el `where` → ese error; con el `where` → inserta la primera y devuelve 0 filas en la segunda
   campaña del mismo negocio. *(Este no lo cazo ningun revisor: salio de correr el SQL.)* Escribir la fila de
   `core.campaign_tick_audience` con los cinco conteos de exclusion de esa evaluacion.
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
   - Mientras `count(active_turns) < 5`, tomar el siguiente `queued` **por `score(negocio) desc`,
     desempatando por `queued_at asc`** (ADR 0066: merito con balanza desde el dia uno; el score es
     el **lift encogido** hacia el promedio global, calculado en SQL y **inyectado** al planner como
     `businessScores`, que sigue siendo puro) que cumpla:
     su negocio no tiene otro turno `active` para este consumidor; **su negocio no esta en cooldown
     para este consumidor** (regla 5 de la audiencia, **re-evaluada aca bajo el lock**); distancia
     haversine a **cada** local de `active_turns` ≥ 400 m; su negocio tiene < 50 turnos `active`
     no-holdout en total. Activar: `window_start = now()`, `window_end = + 5 dias`, snapshots,
     `holdout = (random() < 0.10)`. Un holdout **no** cuenta para el `< 5` ni para la cuota, y **no**
     entra en `active_turns`.
     **El cooldown se re-verifica al ACTIVAR, no solo al encolar**: un turno puede pasar dias en cola
     y el mundo cambia mientras espera. Sin esta re-evaluacion, el turno que quedo encolado se activa
     el mismo dia en que vence el anterior del mismo negocio, que es exactamente lo que el owner
     prohibio («una oportunidad por comercio por mes»).
     `random` entra **inyectado** al aplicador (igual que a `planConsumerPlacement`), para que la
     integracion pueda forzar y excluir holdouts en vez de rezar.
   - `utility` = hasta 3 membresias con relacion viva (`order` en 30 dias, o `points_balance > 0`, o
     `stamps_count > 0`), **sin filtrar por opt-out** (es su propio saldo), con puerta atribuible por
     la misma regla 4 y con coordenadas, ordenadas por ultima actividad desc; texto por
     `utilityText` (abajo).
   - Conjunto objetivo = `utility ∪ active_turns` (≤ 8), **fusionado por `location_id`**: una puerta
     que cae en las dos bolsas produce **una** fila `slot_kind = 'both'` con
     `composeRelevantText(...)` (ver «Una puerta, un texto» en el modelo de datos). Si difiere de `pass_placement` (por `location_id`,
     `slot_kind` o `relevant_text`): reemplazar filas, `update consumer_account set
     message_updated_at = now()` **sin tocar `latest_message`**, e insertar
     `wallet_push_queue (class='pass_refresh', title='', body='')` **solo si no hay ya una
     `pass_refresh` en `pending` o `sending`** para ese consumidor (`where not exists`, ver modelo de
     datos — **no** `on conflict do nothing`: no hay indice unico y no puede haberlo).
5. Log JSON: `{campaigns, enqueued, activated, holdouts, expired, cancelled, consumers, refreshes}`
   — **aseverado en la integracion**, no solo emitido (`- [ ]` del DoD).

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
- `passkit.ts` (Apple serve) y el **`PATCH` de Google (que hay que CREAR, no existe)** leen
  `pass_placement`; `message_updated_at` ya la subio el tick.
- **El campo no llega al pase editando solo `apple.ts`/`google.ts`**: el input lo define
  `wallet/provider.ts:6` (`PassBuildInput`) y lo llenan **campo por campo** los tres call-sites de
  emision (`api/public/wallet/passkit/v1/passes/[passTypeId]/[serialNumber]/route.ts:63`,
  `api/public/wallet/apple.pkpass/route.ts:31`, `api/public/wallet/google/route.ts`). El campo nuevo
  entra como **requerido** (no opcional como `latestMessage?`, `provider.ts:18`) para que
  `typecheck` obligue a los tres; si entra opcional, el pase se sirve **sin ubicaciones con los 5
  gates en verde**.

#### Clase `pass_refresh`

- **Primero, `push-worker.ts` — que es donde el carril se muere hoy.** El lector de la cola colapsa
  toda clase desconocida a `transactional`:
  `klass: r.klass === "campaign" ? "campaign" : "transactional"` (`wallet/push-worker.ts:60`), sobre
  la union `"transactional" | "campaign"` de `push-plan.ts:10`. Una fila `pass_refresh` entraria al
  planner **como `transactional`**: saltea el cooldown, **avanza el reloj** y **posterga la
  `campaign` siguiente** — los tres invariantes que esta clase existe para sostener — y `typecheck`
  queda **VERDE**, porque el ternario siempre produce un miembro valido de la union. `runPushWorker`
  (`push-worker.ts:86`) es el unico drainer real (`api/internal/wallet-push/route.ts:2`).
  El mapeo pasa a ser **exhaustivo y sin default silencioso**: clase desconocida → error, no
  `transactional`.
- `planConsumerDrain`: una fila `pass_refresh` **siempre** es `send`, **no** avanza `lastPush` y
  **no** reprograma ninguna `campaign` pendiente.
- `deliverTransports`: `pass_refresh` → APNs vacio a cada `wallet_push_device` Apple + **`PATCH` del
  objeto de Google**; **sin** Web Push, **sin** `addMessage`, **sin** escribir `latest_message` ni
  `last_push_at`.
- **El `PATCH` de Google NO EXISTE y hay que crearlo.** Las dos unicas salidas a Google son POST:
  `wallet/google.ts:119` (token exchange) y `:148` (`addMessage`), y la interfaz del canal
  (`wallet/push-channel.ts:19`) solo tiene `sendApple` y `sendGoogle`, que **es** `addMessage`.
  Se agrega `patchGoogleObject` a `PushChannel` y a `FakePushChannel` (`push-channel.ts:35`),
  registrando `{kind: 'google-patch'}` en `calls` — **sin eso ningun test puede distinguir un PATCH
  de un `addMessage`**, que es justo lo que el DoD prohibe: un implementador que mande
  `sendGoogle(serial, {header:'',body:''})` deja el fake registrando `{kind:'google'}` igual que un
  PATCH, el test pasa, y el consumidor recibe un `addMessage` real.
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
- `POST /api/counter/coupon-redeem` `{turnId, locationId, clientRequestId}` — sesion de staff con
  **`requireOperator`** (`app/api/counter/_auth.ts:14`, el guard que ya usan `redeem`, `grant` y
  `resolve`), errores por `counterError`. **No** `requireBackofficeSession`: ese es un guard de
  **pagina** que hace `redirect("/login")` (`server/auth-guards.ts:44-48`) y en un POST devuelve un
  **307 a `/login`**, no 401/403. Ademas `assertLocationInBusiness` (`counter/core.ts:91-110`) ya
  filtra `status = 'active'`.
  Transaccion, **con el orden de guardas declarado en el docblock como normativo** (unit que lo
  asevera, igual que `plan-change.ts`):
  1. `select … from core.campaign where id = $campaign for update` (serializa todos los canjes de la
     campaña), `select … from core.campaign_turn where id = $turn for update`.
  2. **Idempotencia, bajo el lock y ANTES de cualquier guarda de negocio**: leer `coupon_redemption`
     por `(business_id, client_request_id)`; si existe → **200 con esa fila** (aseverando que es del
     mismo `turn_id`). Es el paso (2) de `counter/redemptions.ts:146` y **la spec anterior no lo
     tenia**: sin el, el reintento legitimo del mostrador (timeout de red, mismo `clientRequestId`)
     recorre las guardas, llega al `insert`, choca contra el **unique `turn_id`** y sale **409
     `already_redeemed`** — o sea que la spec prometia dos respuestas contradictorias para la misma
     entrada y el DoD elegia la que el codigo descripto no produce. El unico es **backstop**, no
     mecanismo (`redemptions.ts:77-100`).
  3. Verificar en SQL las condiciones de arriba y
     `count(coupon_redemption where campaign_id) < coupon_max_redemptions`.
  4. Insertar `coupon_redemption`; `update campaign_turn set outcome = 'coupon_redeemed',
     outcome_redemption_id, outcome_at`.
  Errores: 409 `already_redeemed` (unique `turn_id`, solo para un `clientRequestId` **distinto**),
  409 `coupon_cap_reached`, 409 `turn_not_active`, 404 fuera del negocio.
- Encola un aviso **`transactional`** («Canjeaste el cupon «{etiqueta}» 🎁») por el camino de la
  spec 0055. **No toca** `points_balance`/`stamps_count`.
- **`CLAUDE.md`**: el conteo bajo el lock de la campaña es el guard de concurrencia. **Ojo con el
  oraculo**: este NO es el caso del ADR 0054 (no hay `NOT EXISTS` en un CTE; es un lock explicito
  adquirido antes del `count` en una transaccion interactiva, mismo patron que
  `counter/redemptions.ts:110-138`), y por eso **el `EXPLAIN` no prueba lo que la spec anterior le
  pedia probar**: el `FOR UPDATE` y el `count` son **dos statements** y ningun plan muestra el lock.
  Se cierra con **la carrera real** del plan de pruebas + la mutacion que saca el `for update`;
  el `EXPLAIN` se transcribe como dato, no como oraculo.

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
- `activate` exige `plan = 'plus'` con suscripcion viva: la fuente son `subscription.plan` +
  `pending_plan` (como `effectiveLocationLimit`, `locations/core.ts:94`) **mas `hasLiveSubscription`
  (`billing/plan-change.ts:93`)** — `effectiveLocationLimit` por si sola es un `Math.min` de limites
  y **no sabe nada de «viva»** (no mira `status` ni `stripe_subscription_id`). Si no,
  **402 `plan_not_allowed`**. `POST /api/marketing/campaigns` (crear `draft`) tambien lo
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
| `apps/merchant/src/server/schema/campaign.ts` | crear: `campaign`, `campaign_location`, `campaign_turn`, `coupon_redemption`, `campaign_tick_audience`, `pass_placement` |
| `apps/merchant/src/server/schema/consumer.ts` | editar: `marketing_opt_out_at`; check de `class` + unico parcial `pass_refresh` |
| `apps/merchant/src/server/schema.ts` | editar: re-export |
| `apps/merchant/drizzle/0031_*.sql` (+ `meta`) | crear (drizzle-kit) |
| `apps/merchant/src/server/marketing/audience.ts` | crear: SQL de audiencia + `decideTurnEligibility` (puro) |
| `apps/merchant/src/server/marketing/placement-plan.ts` | crear: `planConsumerPlacement` (puro) + haversine |
| `apps/merchant/src/server/marketing/placement.ts` | crear: aplicador SQL del tick (pasos 1-5) |
| `apps/merchant/src/server/marketing/utility-text.ts` | crear: `utilityText` (puro) |
| `apps/merchant/src/server/marketing/relevant-text.ts` | crear: `composeRelevantText` (puro) — fusion saldo + mensaje en una puerta |
| `apps/merchant/src/server/marketing/merit.ts` | crear: SQL de stats por negocio + `businessScore` (puro), ADR 0066 |
| `apps/merchant/src/server/marketing/campaign-store.ts` | crear: CRUD + transiciones |
| `apps/merchant/src/server/marketing/results.ts` | crear: DTO de resultados (**puro**) |
| `apps/merchant/src/server/marketing/results-store.ts` | **crear (no estaba en la tabla)**: el SQL de resultados. Se parte igual que `audience.ts`/`audience-store.ts` — es el idiom del modulo y es lo que deja la compuerta de la estimacion pinneada por un unit en vez de por una base sembrada |
| `apps/merchant/src/server/marketing/audience-preview.ts` | **crear (no estaba en la tabla)**: parseo de la query + `previewAudience`, que reusa `decideTurnEligibility` sobre una campaña que todavia no existe |
| `apps/merchant/src/server/marketing/coupon-redeem.ts` | crear: canje transaccional |
| `apps/merchant/src/server/wallet/apple.ts`, `google.ts`, `passkit.ts` | editar: `locations` / `merchantLocations` + modulos, lectura de `pass_placement`; **crear el `PATCH` del Loyalty Object en `google.ts`** (hoy solo hay POST: token exchange y `addMessage`) |
| `apps/merchant/src/server/wallet/provider.ts` | **editar (faltaba)**: campo nuevo **requerido** en `PassBuildInput` / `ApplePassBuildInput` |
| `apps/merchant/src/app/api/public/wallet/passkit/v1/passes/[passTypeId]/[serialNumber]/route.ts`, `apps/merchant/src/app/api/public/wallet/apple.pkpass/route.ts`, `apps/merchant/src/app/api/public/wallet/google/route.ts` | **editar (faltaban)**: los tres call-sites que arman el input del pase campo por campo |
| `apps/merchant/src/server/wallet/push-worker.ts` | **editar (faltaba)**: `QueueRow.klass` y el mapeo de `selectDue` — hoy colapsa toda clase desconocida a `transactional` (`:60`) |
| `apps/merchant/src/server/wallet/push-channel.ts` | **editar (faltaba)**: `patchGoogleObject` en `PushChannel` y en `FakePushChannel`, con `{kind:'google-patch'}` en `calls` |
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
| tests: `server/marketing/*.test.ts`, `server/marketing-*.neon.integration.test.ts`, `server/wallet-push*.test.ts`, `app/backoffice/marketing/*.test.ts` | crear / editar. **`.test.ts`, NO `.test.tsx`** — corregido al preparar B3: el `include` de `apps/merchant/vitest.config.ts` es `src/**/*.test.ts`, asi que un `.test.tsx` **no se ejecuta ni nombrandolo explicitamente** (medido: vitest contesta «No test files found»). Los 158 tests del repo son `.test.ts`, incluidos todos los que renderizan JSX. Enforced por el hook `invisible-test.sh` |
| `docs/specs/0017-campanas-owner-demo.md` | editar al implementar: «superada por la 0065» |

### Disjunta?

**No.** Toca `wallet/push*.ts` (compartidos con cualquier spec de push), `billing/*` (freno por
plan), `counter/*` (spec 0055) y `backoffice/page.tsx`. Se serializa; no corre en paralelo con
ninguna spec que toque esos archivos.

### Archivos compartidos

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| ~~Migracion `0031` aplicada en `ci-integration`~~ **ANULADO al implementar A1**: `ci.yml` corre `pnpm db:migrate` en cada corrida (spec 0062), y el orden era imposible — la migracion la **genera** la fase A. Lo que si hace falta es aplicarla en la rama efimera local (`spec-0065-marketing`), que es contra la que corren los `.neon.integration` de la maquina | implementador de A1 | al generar la migracion |
| Secrets `MARKETING_TICK_ENDPOINT` / `CRON_SECRET` en GitHub | owner | antes del QA en prod |

### Fases (cada una con PASS de revisor independiente antes de la siguiente)

- **A — Fundacion**: schema + migracion, audiencia, `planConsumerPlacement`, aplicador del tick,
  `utilityText`, `pass_refresh`, `locations` en Apple y Google, endpoint del tick + workflow.
- **B — Backoffice**: listado, compositor, detalle, resultados, tile.
- **C — Cupon**: mostrador + `coupon-redeem` + aviso transaccional.
- **D — Consumidor y plan**: seccion «Configuracion» + opt-out; guarda `downgrade_blocked_campaigns`
  en `decidePlanChange` + modal; pausa defensiva del webhook.

## Definition of Done

Cada item lleva su **fase** entre corchetes: un revisor de fase cierra solo los suyos. Tres items de
la version anterior no se podian cerrar en su fase (los motivos de exclusion son de A pero
«se cuentan en resultados» es de B; el tick es de A pero `opt_out` y `plan_downgraded` nacen en D),
y sin partirlos el revisor de A habria declarado un limite falso («esto no se puede probar hasta la
D»). **Se puede y se declara como se hace: sembrando `marketing_opt_out_at` y `pause_reason` por
SQL crudo en el seed de integracion.**

- [ ] **[B]** Un owner `plus` compone y activa una campaña de proximidad con audiencia «dormidos
      hace N dias» sobre locales elegidos; el compositor muestra los conteos reales
      (`audience-preview`) y el costo maximo antes de activar.
- [ ] **[B]** El ciclo de vida de la campaña responde lo declarado: crear `draft`, editar solo en
      `draft`/`paused` (409 `not_editable`), las cuatro transiciones (409 `invalid_transition` fuera
      de la tabla), y `activate` sin local activo **con coordenadas** → 409.
- [ ] **[A]** El tick encola, activa, vence y cancela turnos y es **idempotente** (dos corridas
      seguidas no cambian filas); **su log JSON se asevera**, no solo se emite.
- [ ] **[A]** Un segundo tick **solapado** no activa de mas: sin el advisory lock, dos corridas
      simultaneas pasan la cuota del negocio.
- [ ] **[A]** En el pase de cada consumidor hay **≤ 10** ubicaciones: ≤ 3 de utilidad con su texto
      de saldo y ≤ 5 turnos no-holdout, **ninguna pareja de turnos a < 400 m**, **≤ 1 turno por
      negocio**, y **ningun** turno `holdout` (con el `random` **forzado**, no al azar) — verificado
      por SQL sobre `pass_placement` y por el JSON del pase.
- [ ] **[A]** Un consumidor que esta en la audiencia **y** tiene relacion viva con ese mismo negocio
      (compro hace 60 dias, le queda 1 sello) produce **una sola** fila de `pass_placement` para esa
      puerta, con `slot_kind = 'both'` y el texto **fusionado** («{negocio}: te faltan 2 sellos ·
      {mensaje}») — ni `23505` ni un turno `active` fuera del pase. Si el compuesto no entra en el
      `cap`, gana el mensaje y el saldo se cae **entero** (nunca truncado a media palabra).
- [ ] **[A]** La cola se ordena por **merito con balanza** (ADR 0066): un negocio con lift alto y
      volumen le gana a uno con `1 de 1`; un negocio **sin historia** queda **en el promedio, no
      ultimo**; empate → `queued_at asc`. Dos corridas con los mismos datos dan el mismo orden.
- [ ] **[A]** El **cableado** llega al pase: el JSON servido por las tres rutas de emision lleva las
      ubicaciones (`locations` en Apple, `merchantLocations` + modulos en Google). *(Es un item
      aparte a proposito: los builders pueden estar bien y el campo no llegar — el input lo llenan
      tres call-sites, `provider.ts`.)*
- [ ] **[A]** Un consumidor en cooldown, sin pase, sin local atribuible (**archivado o sin
      coordenadas incluido**) o con opt-out **no** recibe turno.
- [ ] **[B]** Los cinco motivos de exclusion del ultimo tick se leen en resultados desde
      `campaign_tick_audience` y coinciden con el SQL de la audiencia.
- [ ] **[A]** Pausar y reanudar una campaña **no quema la audiencia**: los turnos cancelados no
      cuentan para el cooldown y la campaña vuelve a colocar en el tick siguiente.
- [ ] **[A]** Un negocio no supera la cuota de turnos activos no-holdout **dentro de una misma
      corrida** (el conteo sube consumidor a consumidor, no se lee una vez al empezar); el
      excedente queda en cola. La cuota es un parametro, para poder bajarla en test.
- [ ] **[A]** `pass_refresh` no modifica `last_push_at` ni `latest_message`, no reprograma una
      `campaign` pendiente, **no envia Web Push ni `addMessage`** (se distingue del `PATCH` por
      `{kind:'google-patch'}` en el fake), y `push-worker.ts` **no** la colapsa a `transactional`.
- [ ] **[A]** Hay a lo sumo un `pass_refresh` vivo por consumidor, y un fallo de envio que devuelve
      la fila a `pending` **no** rompe contra el coalescing.
- [ ] **[A]** Cambiar `pass_placement` sube `message_updated_at` **y el serve de Apple responde el
      pase nuevo a `passesUpdatedSince`** (el oraculo ya existe:
      `wallet-push.neon.integration.test.ts:216`).
- [ ] **[C]** El canje de cupon es **atomico e idempotente**: dos canjes concurrentes del mismo
      turno dejan **una** fila; dos canjes concurrentes de turnos distintos con un solo cupo
      restante dejan **una** fila; el reintento con el mismo `clientRequestId` devuelve **200 con la
      misma fila** (no 409). **No cambia `points_balance` ni `stamps_count`** (aseverado por SQL).
- [ ] **[C]** Al canjear se encola un aviso **`class = 'transactional'`** cuyo texto contiene la
      **etiqueta snapshot** (no la etiqueta actual de la campaña).
- [ ] **[B]** Resultados: los titulos dicen «compraron durante su ventana»; la estimacion esta
      oculta con `B < 30` **y muestra el valor correcto con `B ≥ 30`**; «estas en el pase de K de C»
      coincide con el SQL de `pass_placement`.
- [ ] **[A]** Pausar, **finalizar**, archivar un local, quedarse sin coordenadas y perder la
      membresia retiran los turnos con su `cancel_reason` en el siguiente tick, y el pase deja de
      llevar esa ubicacion en el siguiente refresco. *(Los seis valores de `cancel_reason` tienen
      caso; `opt_out` y `plan_downgraded` se siembran por SQL.)*
- [ ] **[D]** En «Configuracion» del portal el consumidor apaga las promociones de UN negocio: deja
      de recibir turnos de ese negocio, y **siguen** su aviso transaccional y su ubicacion de
      utilidad con el saldo (aseverado, no supuesto). La marca `marketing_opt_out_at` la escribe
      **solo** esa accion — barrido sobre **`marketingOptOutAt`** (la ortografia que usa el codigo)
      y sobre el literal snake, con raiz declarada y prueba de que el barrido se pone **rojo**.
- [ ] **[D]** **Bajar de plan con una campaña activa esta BLOQUEADO**: `decidePlanChange` devuelve
      `downgrade_blocked_campaigns` con `deactivateCount`, **el modal lo dice**, y el downgrade
      recien procede cuando no queda ninguna `active`.
- [ ] **[D]** Un `free`/`none` recibe **402 `plan_not_allowed`** al **crear** y al **activar**.
- [ ] **[D]** Si el plan aterriza en `free`/`none` **sin pasar por nuestra ruta** (webhook), las
      campañas `active` quedan `paused` con `plan_downgraded` **en la misma transaccion** —
      verificado **inyectando un fallo** en ese `update` y aseverando que **el plan tampoco quedo
      escrito**. El tick retira sus turnos.
- [ ] **[B]** Aislamiento: owner de A no **ve** (pagina), edita ni obtiene resultados de campañas de
      B (404); **staff no puede crear ni activar** (403). **[A]** el tick sin `CRON_SECRET` → 401.
      **[D]** opt-out de una membresia ajena → 404; `/wallet/settings` sin sesion → redirect.
- [ ] **[B]** El tile «Campañas» lleva a `/backoffice/marketing` (hoy cae en el mock de demo,
      `backoffice/page.tsx:41-44`); la spec 0017 queda anotada como superada.
- [ ] QA del owner en dispositivos reales (abajo) en verde, con `Vercel: success` verificado para el
      sha exacto antes de pedirlo.
- [ ] Revisor independiente emite PASS por fase (`docs/AGENT-WORKFLOW.md`).

## Plan de pruebas y verificacion

> **Presupuesto (`CLAUDE.md`):** las mutaciones de esta lista y las que salgan de los docblocks
> nuevos que afirmen un invariante. Nada mas. Cada fila «mutacion X → rojo el test Y» se **ejecuta y
> se transcribe**, nunca se predice.

- [ ] Unit `decideTurnEligibility`: tabla de casos con los motivos de exclusion (incluidos **local
      archivado** y **local sin coordenadas**) y el elegible.
- [ ] Unit `planConsumerPlacement`: (a) 7 en cola, 0 activos → activa 5 respetando 400 m y FIFO;
      (b) dos en cola a 200 m **de negocios distintos** → activa una, la otra queda; (c) mismo
      negocio dos veces → una; (d) cuota agotada → queda en cola; (e) `random` < 0.10 → `holdout`,
      no cuenta; (f) utilidad > 3 → las 3 mas recientes; (g) conjunto identico → `refresh: false`;
      (h) **mismo negocio en las dos bolsas → una fila, `slot_kind='turn'`**; (i) **negocio en
      cooldown con turno en cola → no se activa**.
      **Mutaciones a ejecutar y transcribir**: quitar la regla de 400 m → rojo (b); quitar «1 por
      negocio» → rojo (c); contar holdouts en el `< 5` → rojo (e); quitar el cooldown de la
      activacion → rojo (i); dedupear al reves (utilidad gana) → rojo (h).
      *(El caso (b) usa negocios distintos a proposito: con el mismo negocio quedaria rojo tambien
      sin la regla de 400 m, y la fila mentiria sobre que propiedad pinnea — spec 0055.)*
- [ ] Unit `utilityText`: premio canjeable / faltan N / sin premios, puntos y sellos, truncado.
- [ ] Unit `composeRelevantText`: saldo + mensaje entran → compuesto con el negocio **una sola vez**;
      no entran → **solo el mensaje** (el saldo se cae entero); solo saldo; solo mensaje.
      **Mutacion**: truncar el compuesto en vez de descartar el saldo → rojo.
- [ ] Unit `businessScore` (ADR 0066): tabla con (a) `1 de 1` **no** le gana a `40 de 50`;
      (b) negocio sin historia puntua `globalLift` y queda **en el medio**, no ultimo;
      (c) `placed_n` o `holdout_n` en 0 → 0, no `NaN`; (d) el ejemplo del ADR 0065 (A: 33/30 → +3;
      B: 10/2 → +8) → **gana B**. **Mutaciones**: rankear por tasa cruda → rojo (d); quitar el
      encogimiento → rojo (a); mandar al debutante al fondo → rojo (b).
- [ ] Unit del mapeo de clase de `push-worker.ts`: `pass_refresh` llega al planner **como
      `pass_refresh`**. **Mutacion**: restaurar el ternario con default `transactional` → rojo.
- [ ] Unit `planConsumerDrain`: `pass_refresh` con `lastPush` reciente → `send` y **no** avanza el
      reloj; una `campaign` que sigue → no se reprograma. Mutacion: tratarla como `transactional` →
      rojo.
- [ ] Unit del fan-out de transportes: `pass_refresh` → `{apple: true, googlePatch: true,
      googleAddMessage: false, webPush: false}`. **Mutacion**: devolver el fan-out de `campaign` →
      rojo.
- [ ] Unit `buildPassJson` / `buildLoyaltyObject`: ≤ 10 ubicaciones, `relevantText`, sin
      `maxDistance`; `merchantLocations` (no `locations`) + modulos por turno.
- [ ] Integracion (Neon) tick: seed con 1 negocio, 3 locales (dos a 150 m, **uno sin coordenadas**),
      8 consumidores en distintos estados (**uno con turno y relacion viva en el mismo negocio**) →
      correr dos veces → aseverar por SQL turnos, `pass_placement`, `message_updated_at`, **el log
      JSON** y **una** fila `pass_refresh`; segunda corrida sin cambios **y sin encolar de nuevo el
      del local sin coordenadas**. `random` inyectado: un consumidor con holdout forzado, cuyo turno
      queda `active` y **fuera** de `pass_placement`. Y un consumidor con **saldo y turno en el mismo
      local** → **una** fila `slot_kind='both'` con el texto fusionado (por SQL).
- [ ] Integracion del encolado: el `on conflict` lleva el `where` del indice parcial. **Mutacion**:
      sacarle el `where` al conflict target → **rojo de entrada** (`there is no unique or exclusion
      constraint matching the ON CONFLICT specification`). Verificado ya contra Postgres 18 real al
      revisar la spec; el test lo pinnea para que no vuelva.
- [ ] Integracion cuota y solape: negocio con cuota **2** y 3 elegibles → 2 `active` y 1 `queued`
      **en la misma corrida**. **Mutaciones**: leer el conteo una sola vez al inicio → rojo; sacar
      el advisory lock y lanzar dos ticks simultaneos → rojo (se pasa de cuota).
- [ ] Integracion vencimiento/outcome: orden dentro de ventana → `purchase`; canje →
      `coupon_redeemed`; nada → `none`; holdout con orden → `purchase` igual. La `order` elegida se
      toma con `order by created_at asc` explicito (no `.at(-1)` sobre un `select` sin orden —
      `CLAUDE.md`).
- [ ] Integracion cancelacion: pausa, **fin**, opt-out (sembrado por SQL), local archivado, **local
      sin coordenadas**, **membresia perdida** y baja de plan → `cancelled` con su razon, y el
      siguiente tick saca la ubicacion del pase. **Y pausar→reanudar no deja a la audiencia en
      cooldown.** Mutacion: sacar `status in ('active','done')` del predicado de cooldown → rojo.
- [ ] Integracion canje: **carrera** de 2 `coupon-redeem` simultaneos sobre el mismo turno → 1 fila;
      carrera de 2 turnos distintos con `coupon_max_redemptions − count = 1` → 1 fila; mismo
      `clientRequestId` → **200 y la misma fila**; tras el canje, **una fila `wallet_push_queue`
      `class='transactional'` cuyo body contiene el `label_snapshot`**, y `points_balance` /
      `stamps_count` **identicos** antes y despues (por SQL). **Mutaciones**: quitar el `for update`
      de la campaña → rojo **la carrera del cupo** (no la del mismo turno: para esa el unique solo
      ya alcanza — spec 0055); quitar la lectura por `client_request_id` → rojo el reintento;
      encolar `class='campaign'` → rojo el aviso. El `EXPLAIN (VERBOSE)` se transcribe en el handoff
      como **dato**, no como oraculo (son dos statements: ningun plan muestra el lock).
- [ ] Integracion `pass_refresh` end-to-end con **`FakePushChannel`** (`wallet/push-channel.ts:35`;
      **no** existe ningun `FakeWalletProvider`): en `channel.calls` hay `{kind:'apple'}` y
      `{kind:'google-patch'}`, **ningun `{kind:'google'}`** (= `addMessage`) y ningun Web Push;
      `last_push_at` y `latest_message` intactos (por SQL). Ademas: fila devuelta a `pending` tras un
      fallo con otro refresco ya encolado → **no** hay error ni fila clavada en `sending`.
- [ ] Integracion serve de Apple: tras un cambio de `pass_placement`, `passesUpdatedSince` devuelve
      el pase nuevo con las ubicaciones (patron de `wallet-push.neon.integration.test.ts:216`).
- [ ] Integracion rutas de campaña: `free` → **402** en `POST /campaigns` y en `activate`;
      `activate` sin local con coordenadas → 409; `PATCH` sobre `active` → 409 `not_editable`;
      `archive` desde `active` → 409 `invalid_transition`.
- [ ] Unit `decidePlanChange`: tabla con `activeCampaigns` 0/1/3 × `activeLocations` 1/3 ×
      `currentPlan`, aseverando el **orden declarado** (locales → campañas → `already_on_plan`) y
      `deactivateCount`. **Mutaciones**: mover la guarda de campañas antes de la de locales → rojo
      el caso que viola ambas; borrar la guarda → rojo el bloqueo.
- [ ] Integracion webhook: deriva `free`/`none` con 2 campañas `active` → las dos quedan
      `paused`/`plan_downgraded`. **Mutacion (inyeccion de fallo, no movimiento de codigo):** hacer
      que el `update campaign` lance, y aseverar que **el plan tampoco quedo escrito** (rollback).
      *(La mutacion anterior —«sacar el `update` de la transaccion»— **no mordia**: moviendolo
      despues del commit el estado final es identico y el test quedaba verde con la atomicidad
      violada. Probaba «se ejecuta», no «es atomico».)*
- [ ] Barrido estatico del opt-out: **`marketingOptOutAt`** (la ortografia del codigo; drizzle mapea
      camelCase→snake **solo** en `schema/consumer.ts`, asi que el literal `marketing_opt_out_at`
      aparece en el schema y la migracion y **nunca** en el escritor) **y** el literal snake, sobre
      `apps/merchant/src/**` con la raiz declarada y piso de archivos escaneados > 50. Se verifica
      que se pone **rojo** plantando un `.set({ marketingOptOutAt })` en otro archivo.
      *(La version anterior de esta fila era **vacua**: buscaba una cadena que el codigo que escribe
      nunca contiene. Cualquier ruta podia falsificar el discriminante de intencion con el barrido en
      verde — ADR 0060, y la leccion de las dos ortografias del `accept=` de la spec 0040.)*
- [ ] Autorizacion: owner A → campañas de B: 404 en las rutas con `[id]` **y en la pagina
      `/backoffice/marketing/[id]`**; staff → `POST /campaigns` y `activate`: 403; tick sin Bearer:
      401; opt-out de una membresia ajena: 404; `/wallet/settings` sin sesion → redirect.
- [ ] Render (`renderToStaticMarkup` + `node-html-parser`, sin jsdom — gotcha de `CLAUDE.md`):
      compositor con los 5 bloques y conteos; resultados con los titulos exactos, la estimacion
      oculta con `B < 30` y **su valor con `B ≥ 30`**; **el modal de downgrade mostrando
      `downgrade_blocked_campaigns`**; el tile «Campañas» apuntando a `/backoffice/marketing`.
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
      observados: son los datos que faltan. **Y el tercero, nuevo:** con un consumidor que tenga
      saldo **y** turno en el mismo local, leer la pantalla bloqueada y anotar **donde corta** el
      texto fusionado — de ahi sale el `cap` real, que Apple no documenta, y si conviene invertir el
      orden (saldo antes que oferta).

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
la ruta; **un tick por vez (advisory lock)**; **el cooldown lo queman solo los turnos que se
consumieron (`active`/`done`), no los cancelados**.

**Tres que valen aparte, porque el owner decidio el principio pero no el detalle:**

1. **Orden de las guardas del downgrade**: locales primero, campañas despues, y por lo tanto **dos
   bloqueos secuenciales** para quien viola ambas. Preserva el orden normativo y los tests
   existentes; el mensaje combinado queda como mejora posible.
2. **La pausa defensiva del webhook.** El owner pidio bloqueo duro; el bloqueo vive en nuestra ruta
   y el plan puede llegar a `free`/`none` por el dashboard de Stripe o por impago, sin pasar por
   ahi (es literalmente el agujero que costo dos rondas en la spec 0063, ADR 0060). La pausa cubre
   ese camino para sostener el invariante que el owner SI decidio («free no corre campañas»). Si
   prefiere que en ese caso las campañas sigan corriendo hasta que alguien las apague a mano, es un
   cambio de una linea — pero hay que decirlo.
3. ~~Diferir el merito por resultado en proximidad.~~ **RESUELTO POR EL OWNER (2026-09-15): «desde
   dia uno».** El orquestador lo habia diferido (ADR 0065 §4) sin que nadie registrara que el owner
   aceptara ese diferimiento. Ahora es el **ADR 0066**: ranking por **lift** encogido, con FIFO de
   desempate. Lo que sobrevive del argumento viejo, y por eso no se rankea por tasa cruda, esta en
   el ADR 0066 §2.
4. ~~La precedencia turno > utilidad en la misma puerta.~~ **RESUELTO POR EL OWNER (2026-09-15):
   «si es del mismo local ¿por que no mostrar ambos? si tenemos margen de seguridad».** Se
   **fusionan** en un texto (`composeRelevantText`), no se elige. Lo que queda del orquestador es
   solo el **detalle**: el `cap` de 120, el orden (saldo antes que oferta) y la regla de que si no
   entra se cae el saldo entero en vez de truncar — los tres a validar en el QA, que es donde se
   mide el corte real de la pantalla bloqueada.

## Al implementar la fase B2 (2026-09-16) — decisiones del ORQUESTADOR

Las dos son reversibles y ninguna la decidio el owner.

1. **El costo incurrido es `sum(cost_snapshot)`, no `n × coupon_cost`.** La spec escribe «n × costo»
   y no dice cual costo. Los dos numeros coinciden hasta que alguien edita el cupon de una campaña
   **pausada**; a partir de ahi `n × costo_actual` **reescribe plata ya entregada en el mostrador**,
   que es justo lo que un costo «incurrido» no puede hacer. El snapshot es lo que se le prometio al
   consumidor y lo que el mostrador honro. Pinneado con dos canjes a 3.00 y 4.50 contra un cupon que
   hoy vale 3.00: el DTO dice 7.50 y `n × costo` diria 6.00.
2. **La estimacion del efecto va redondeada a UN decimal.** La spec dice «+Z clientes» sin fijar
   precision. No es cosmetica: es una **diferencia de dos tasas** por un conteo, asi que el ruido
   IEEE es el caso normal — `(10/100 − 20/50) × 100` da **−30.000000000000004**, medido, y sin
   redondeo eso viaja tal cual a la pantalla. Un decimal y no entero porque con el piso en 30
   holdouts existe el efecto real pero chico, y `Math.round` lo imprimiria como «+0 clientes», que
   se lee «no sirvio» en vez de «sirvio poco».

## Al implementar la fase A5 (2026-09-16) — decisiones y correcciones del ORQUESTADOR

Todo esto es del orquestador, no del owner, y es reversible. El detalle medido (bitacora de
mutaciones, hallazgos, limites) vive en `docs/TASKS.md`.

1. **El lock del paso 0 es de TRANSACCION, no de sesion → ADR 0067.** `pg_try_advisory_lock` exige
   que toda la corrida viaje por la misma conexion y este repo no lo puede prometer, asi que el tick
   entero corre en una `withDbTransaction` con `pg_try_advisory_xact_lock`. El costo (los locks de
   fila se sostienen hasta el commit) esta declarado ahi. Y como la exclusion es **global**, las
   suites de integracion necesitan un `lockNamespace` propio: es un **costuron de test** que la
   produccion nunca pasa.
2. **La foto de audiencia se escribe con `on conflict … do update`.** Con un insert pelado, dos
   corridas que comparten `ran_at` morian con `23505`: «idempotente salvo que lo corras dos veces con
   el mismo reloj» no es idempotente.
3. **El orden de evaluacion de los seis motivos de exclusion queda fijado** (opt_out → not_reachable
   → not_dormant → no_location → cooldown → live_turn), porque **decide bajo que motivo se cuenta** a
   quien falla varias reglas. `reachable` se cuenta **aparte**, sobre `has_pass`, para que no dependa
   de donde corto la decision.
4. **`cancel_reason = 'membership_gone'` es inalcanzable hoy y se DECLARA** (medido: la fk
   `no action` de `membership_id` devuelve `23503`). Volverlo alcanzable es otra migracion.
5. **`campaign_tick_audience` guarda cinco conteos, no seis**: `not_dormant` y `live_turn` no se
   persisten. Es lo que fija el modelo de datos de esta misma spec; la fase B tiene que saberlo.
6. **Una campaña con `ends_at` vencido pero `status = 'active'` no cancela sus turnos vivos** — el
   paso 3 mira `status`, como dice la spec. Queda escrito porque no era obvio.
7. **`toLatLng` se extrajo de `wallet/pass-locations.ts`**: «una puerta sin coordenadas se descarta»
   ahora la aplican el tick **y** los builders del pase, y una segunda copia seria una segunda regla.

## Abierto

**Nada bloqueante.** Las dos preguntas que la revision adversarial le abrio al owner las cerro el
mismo dia: puerta compartida → **se fusionan los dos textos**; merito → **desde el dia uno**
(ADR 0066).

Registrado, sin bloquear:

- Los parametros numericos del orquestador (cooldown 30 d, holdout 10 %, cuota 50, utilidad ≤3, tick
  cada 6 h, **α = 20 del encogimiento**, **`cap` = 120 del texto fusionado**) se ajustan con el QA en
  la calle. El QA tiene que anotar tres datos que ninguna documentacion nos dio: el **radio**, el
  **tiempo de dwell** y **donde corta** la pantalla bloqueada el texto fusionado.
- El ranking por merito **no se muestra** en el backoffice: un negocio puede quedar sistematicamente
  ultimo y no enterarse (ADR 0066, consecuencias). Deuda declarada.
- La **categoria del negocio** no existe y el ADR 0021 la pide: hara falta para los tipos de campaña
  que segmenten por rubro, no para este.
- Un negocio que viola **las dos** guardas del downgrade (locales y campañas) recibe **dos bloqueos
  secuenciales**. Mostrarlos juntos exigiria que `PlanChangeDecision` llevara los dos contadores;
  queda como mejora, no entra.

## Revision adversarial — vuelta 1 (2026-09-15)

Tres revisores independientes con dimension acotada y presupuesto escrito (`CLAUDE.md`): concurrencia
y SQL, afirmaciones contra el arbol, y DoD/oraculos. **FAIL unanime, 16 bloqueantes**, mas un
**17.º que no cazo ningun revisor** y que salio de **correr el SQL** contra Postgres 18 real: el
`on conflict` del paso 1 contra un indice **parcial** necesita repetir el `where` del indice, y sin
el **el tick reventaba en su primera corrida**. Todos corregidos. Los cuatro que mas duelen, para
que no se repitan:

1. **Un invariante escrito en el indice equivocado**: «un turno vivo por campaña» cuando el ADR dice
   «por negocio». La prosa y el `create index` decian cosas distintas.
2. **Un carril nuevo que moria antes de llegar a su planner**: `push-worker.ts:60` colapsa toda clase
   desconocida a `transactional`, con `typecheck` en verde.
3. **Un `PATCH` de Google citado con articulo definido —«el `PATCH`»— que no existe en el arbol.**
   Toda la clase `pass_refresh` se apoyaba en una llamada que hay que escribir.
4. **Un barrido estatico vacuo**: buscaba `marketing_opt_out_at`, que es la ortografia que el codigo
   que escribe **nunca** contiene (drizzle mapea camelCase→snake solo en el schema).

**Los 17 se verificaron empiricamente antes de bajarlos aca, no por la cita del revisor.** Contra el
arbol: el ternario de `push-worker.ts:60`, la interfaz de `PushChannel`, el `redirect()` de
`requireBackofficeSession`, `requireOperator` devolviendo 401/403 como valor, la ausencia de `PATCH`
en `google.ts` (solo dos POST), `latestMessage?` opcional en `PassBuildInput` + los tres call-sites,
lat/long nullable, la lectura de idempotencia como paso (2) en `redemptions.ts`,
`effectiveLocationLimit` como `min` sin liveness, y el mapeo camelCase→snake de drizzle que hacia
vacuo el barrido. Contra **Postgres 18 real** (rama Neon efimera): el `23505` del retry del worker
—con `attempts` **quedando en 0** y la fila clavada en `sending`, que es lo que lo vuelve un
reintento infinito—, el fallo del `on conflict` sin `where` y su arreglo, `GREATEST` ignorando NULL,
el check «todo o nada» mordiendo, y la vigencia abierta (`ends_at` null) pasando.
**Esto importa porque un hallazgo de subagente es una afirmacion de exito como cualquier otra**
(`CLAUDE.md`): se verifica antes de escribirlo, no despues.

Lo que la revision **confirmo** correcto, para no re-medirlo: el guard del cupon **no** es el caso
del ADR 0054 (es un lock explicito antes del `count`, no un `NOT EXISTS` en CTE); `GREATEST` ignora
NULL, asi que «se enrolo y nunca volvio» funciona; el check «todo o nada» del cupon no propaga NULL;
no hay ciclo de locks entre canje, tick y webhook; la migracion siguiente **es** la `0031`; y
`vercel.json` tiene exactamente 2 crons diarios, asi que el tick por GitHub Actions es coherente con
el limite del plan Hobby.
