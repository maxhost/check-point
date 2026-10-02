---
spec: 0136
fecha: 2026-09-29
estado: implementada
resumen: «Mis beneficios» por API — la plantilla de campaña «Oferta cruzada» (premio, cupo mensual, vigencia, publico no clientes / dormidos / cualquiera), su lista para el cliente filtrada por rubro distinto (ultimo escaneado + local donde esta parado) y ≤ 2 km (GPS o ultimo local escaneado), el reclamo que emite un cupon SIN membresia, su canje en el mostrador y el «solo el cruzado» frente a la Bienvenida. Migracion 0057. Sin UI.
disjunta: si
archivos: apps/merchant/src/server/schema/{campaign.ts,campaign-coupon.ts}, apps/merchant/drizzle/0057_*.sql, apps/merchant/src/server/marketing/{templates.ts,template-input.ts,template-store.ts,cross-input.ts,cross-rules.ts,cross-store.ts,welcome-rules.ts,welcome-issue.ts}, apps/merchant/src/server/consumer/{coupons.ts,cross-offers.ts}, apps/merchant/src/server/counter/coupon-store.ts, apps/merchant/src/app/api/public/consumer/cross-offers/**, docs/specs/0136-contratos-de-api.md
---

# 0136 — «Mis beneficios» y la oferta cruzada

> Implementa el **ADR 0104** (que corrige el §4 del ADR 0103). Plantilla grande: hay migracion y dos dominios
> (marketing + consumidor). **Solo API + contrato** (`0136-contratos-de-api.md`): la UI la hace el owner (ADR 0070,
> ADR 0103 §10).

## Problema

- «Mis beneficios» no existe como API. Los cupones propios ya tienen endpoint (`GET /api/public/consumer/coupons`,
  `server/consumer/coupons.ts`), que **ninguna pantalla consume** (grep en `app/(consumer)/wallet`: el unico `fetch`
  es el de `marketing-opt-out`, `settings-tab.tsx:65`). `/wallet` es server-rendered con programas, QR y ajustes
  (`app/(consumer)/wallet/page.tsx`).
- No hay forma de que un comercio le ofrezca algo a quien **todavia no es su cliente**: todo cupon exige membresia
  (`core.campaign_coupon.membership_id` `NOT NULL`, `schema/campaign-coupon.ts:63-64`) y toda campaña apunta a
  miembros (proximidad/push a dormidos, Bienvenida al que se enrola).
- No hay filtro de rubro ni de distancia en ningun lado. Los datos existen: `core.business.category_gcid`
  (`schema/business.ts:50`, `NOT NULL`), `core.location.latitude/longitude` (nullable, `schema/business.ts:205-206`),
  `location_id` en `order`, `reward_redemption` y `coupon_redemption`. PROD (2026-09-29, SQL): 5 comercios, 2
  rubros, 0 con el rubro por defecto; 7 locales activos, 6 con coordenadas; 0 pedidos.

## Decisiones del owner (2026-09-29, textuales en el ADR 0104)

- «Mis beneficios» = cupones propios **sin filtro** + ofertas cruzadas **filtradas**. El filtro «solo es para un
  unico caso, cuando hay ofertas cruzadas».
- La cruzada es «una campaña que active el merchant como la de bienvenida […] elije el premio o cupon».
- Su cupon «no requiere que el cliente este enrolado».
- Publico: «lo define en la campaña el merchant»: no clientes, dormidos o cualquiera.
- Rubro de referencia con GPS: **ambos** (ultimo escaneado + local donde esta parado). Sin ubicacion: **solo sus
  comercios** (ninguna cruzada). Radio 2 km (ADR 0103).
- Entra por la cruzada y hay Bienvenida: **solo el cruzado**.

## Elecciones del orquestador (reversibles, NO son decisiones del owner — van en el mensaje de cierre)

- **O1 — Reclamo explicito.** La lista NO emite cupones; el cupon se emite con `POST …/claim`. Motivo: el cupo
  mensual cuenta cupones emitidos (como la Bienvenida), y emitir al mirar lo gastaria en gente que solo pasa la
  vista; ademas un `GET` sin efectos no emite por un prefetch.
- **O2 — Vigencia desde el reclamo**, sin «desde mañana» (la cruzada busca que vaya ahora): `validFrom = now`,
  `validUntil = now + crossValidDays` dias. Opciones 7 | 15 | 30, def. 15. Cupo 1..10000, def. 50 (los de la
  Bienvenida, `templates.ts:125-127`).
- **O3 — «Parado en un local»** = a ≤ 100 m de un local activo con coordenadas (el numero de la pregunta que el
  owner contesto).
- **O4 — El GPS no se guarda**: viaja por request (`lat`, `lng`) y se usa para esa respuesta.
- **O5 — «Ultimo escaneo»** = el evento mas reciente del cliente entre `core.order`, `core.reward_redemption` y
  `core.coupon_redemption`. El **rubro** de referencia es el del comercio de ese evento (tenga o no local); el
  **punto** sin GPS es el local con coordenadas del evento mas reciente que tenga uno.
- **O6 — Orden de la lista**: distancia ascendente, despues `campaignId` (el arbitro del ADR 0103 §6 es otra spec).
- **O7 — Opt-out**: si el cliente apago el marketing de X (`program_membership.marketing_opt_out_at`), no ve la
  cruzada de X.
- **O8 — Una por persona y campaña**, para siempre (igual que la Bienvenida por membresia).

## Alcance

**Entra:**
1. Plantilla `cross` («Oferta cruzada») en el catalogo, habilitable/deshabilitable por las rutas existentes de
   plantillas, con premio obligatorio y sus parametros.
2. Migracion `0057`: columnas de la plantilla en `core.campaign`, cupon sin membresia en `core.campaign_coupon`.
3. `GET /api/public/consumer/cross-offers` — las ofertas cruzadas que el cliente puede reclamar, filtradas.
4. `POST /api/public/consumer/cross-offers/{campaignId}/claim` — emite el cupon cruzado.
5. `GET /api/public/consumer/coupons` suma `origin` (el cupon cruzado reclamado aparece ahi, sin filtro).
6. Canje en el mostrador de un cupon sin membresia.
7. La Bienvenida no se emite a quien tiene un cupon cruzado de ese comercio.
8. Contrato HTTP `docs/specs/0136-contratos-de-api.md`.

**No entra:**
- Ninguna pantalla (ni la de Mis beneficios, ni la de la plantilla en Marketing, ni cambiar la pestaña inicial de
  `/wallet`). **Cero archivos en `app/(consumer)/**` ni en `components/**`.**
- Horas valle, el arbitro del orden, «ignorado 3 veces» (ADR 0103 §5, §6, §8).
- Avisos: el reclamo **no encola** ningun push de Wallet ni Web Push (ADR 0103 §2: la Wallet nunca lleva el cupon
  de otro comercio). El recordatorio de la 0111 no se toca.
- Resultados propios de la cruzada en Marketing: sus canjes caen en `coupon_redemption` y ya cuentan en los
  resultados por premio existentes; una vista «vino por la red» es otra spec.
- Proximidad del pase para la cruzada.

## Diseño

### Modelo de datos (migracion `0057`)

`core.campaign`:
- `cross_audience text null`, `cross_valid_days integer null`, `cross_monthly_cap integer null`.
- check: `(template_key = 'cross') = (las tres no nulas)`; `cross_audience in ('non_members','dormant','any')`;
  `cross_valid_days in (7,15,30)`; `cross_monthly_cap between 1 and 10000`.
- `core_campaign_template_key_check` (`schema/campaign.ts:186-187`) suma `'cross'`.
- Los checks que hoy tratan a `welcome` como excepcion se extienden a `cross` con la misma forma: sin canales
  (`:117`), cupon con `label`+`cost` y **sin** `coupon_max_redemptions` (`:155`), `ends_at` no obligatorio (`:175`).
- El indice unico parcial de una corrida viva por plantilla (`:210`) cubre `cross` sin cambios.

`core.campaign_coupon`:
- `membership_id` pasa a **nullable**.
- `cross_claimed_at timestamptz null` — el origen «reclamo cruzado».
- `core_campaign_coupon_single_origin_check` suma `cross_claimed_at` a `num_nonnulls(...) <= 1`.
- check nuevo: `membership_id is not null or cross_claimed_at is not null` (solo el cruzado puede no tener membresia).
- unico parcial `(campaign_id, consumer_id) where cross_claimed_at is not null` — O8. **Gotcha** (skill
  `gotchas-del-repo`): el `on conflict` contra un unico parcial lleva el predicado:
  `on conflict (campaign_id, consumer_id) where cross_claimed_at is not null do nothing`.

`core.coupon_redemption.membership_id` **sigue `NOT NULL`**: al canjear, la membresia existe porque el mostrador
enrola al escanear (`counter/resolve.ts:156`, `resolveMembership`).

### Plantilla `cross` (merchant)

- `templates.ts`: entrada `key: "cross"`, `title: "Oferta cruzada"`, `channels: []`, `group: "cross"` (nuevo valor
  de `TemplateGroup`), `couponRequired: true`, `dormantDays: { options: [30, 60, 90], default: 30 }`, y
  `cross: { audience: { options: ["non_members","dormant","any"], default: "non_members" }, validDays: { options:
  [7,15,30], default: 15 }, monthlyCap: { min: 1, max: 10000, default: 50 } }`. `message` def. «Te esperamos con un
  regalo», maxLength 60.
- `cross-input.ts` (nuevo, puro, espejo de `welcome-input.ts`): `crossAudience`, `crossValidDays`,
  `crossMonthlyCap`; en `cross` sin `channels`, sin `excludedLocationIds` no vacio, sin `couponMaxRedemptions`, sin
  ningun `welcome*`; cualquier `cross*` en otra plantilla → 400 con ese campo. `dormantDays` se valida contra las
  opciones de la plantilla y se guarda siempre; solo se LEE con `crossAudience = "dormant"`.
- DTO `Campaign` suma `cross: { audience, validDays, monthlyCap } | null`.
- **Limite de tamaño:** `template-store.ts` tiene 290 lineas y `template-input.ts` 222 (hook `file-size`, 300):
  lo que la cruzada sume a `template-store.ts` va en `cross-store.ts`; dividir, no extender.

### Elegibilidad (una funcion pura, `cross-rules.ts`)

`decideCrossOffer(facts) → { ok: true, distanceMeters } | { ok: false, reason }`, en este orden (la razon es la
primera que aplica; el endpoint no la expone, la usan los tests):

1. `no_origin` — sin GPS y sin local escaneado con coordenadas (decision «solo sus comercios»).
2. `same_category` — `offer.categoryGcid` igual al rubro del ultimo comercio escaneado, **o** igual al rubro del
   comercio del local donde esta parado (O3; solo con GPS).
3. `too_far` — la distancia minima del punto de origen a los locales **activos con coordenadas** de X es > 2000 m,
   o X no tiene ninguno.
4. `audience` — `non_members`: tiene membresia en X; `dormant`: no tiene membresia, o `dormantSince`
   (`marketing/audience.ts`, max(enrolledAt, lastOrderAt en X)) es posterior a `now - dormantDays`; `any`: nunca.
5. `opt_out` — O7.
6. `claimed` — ya tiene un cupon de esa campaña (O8).
7. `cap_reached` — cupones de esa campaña con `created_at >= localMonthStart(now, business.timezone)`
   (`welcome-rules.ts:79`) ≥ `crossMonthlyCap` (`capAllows`, `welcome-rules.ts:126`).

Distancia: haversine, radio terrestre 6 371 000 m, en TypeScript sobre las filas que trae el store (puro y
testeable; el store solo acota por lo que no depende del cliente). Campaña candidata = `template_key = 'cross'`,
`status = 'active'`, `activated_at` no nulo, `starts_at <= now`, `ends_at` nulo o futuro, comercio `active`,
`campaignsAllowedFor` (`plan-gate.ts:62`) verdadero — las mismas condiciones que `loadWelcomeCampaign`
(`welcome-store.ts`).

### Lectura: `GET /api/public/consumer/cross-offers?lat=&lng=`

- Sesion de consumidor (`resolveSession`, cookie `consumer_session`); sin sesion → `401 unauthenticated`. El
  cliente sale **solo** de la sesion.
- `lat`/`lng`: los dos o ninguno; numeros finitos en [-90, 90] / [-180, 180]; si no → `400 validation` con `fields`.
- Devuelve `{ origin: "gps" | "last_scan" | "none", offers: [...] }` con las que pasan `decideCrossOffer`, O6.
  Campos por oferta: allow-list del contrato (sin costo, sin cupo, sin ids de membresia, sin `*ObjectKey`: el logo
  como `logoPath` publico, igual que `toConsumerProgramSummary`).

### Escritura: `POST /api/public/consumer/cross-offers/{campaignId}/claim`

- Cuerpo `{ lat?, lng? }` con la misma validacion. Sesion obligatoria.
- En **una transaccion**: `select … for update` de la fila de la campaña; si ya tiene el cupon → **200** con ese
  cupon (idempotente, sin re-evaluar); si no, se re-evalua `decideCrossOffer` con los hechos leidos DENTRO de la
  transaccion (el conteo del cupo, bajo el lock); cualquier `ok: false` → **`404 offer_unavailable`** (un solo
  codigo: no se le cuenta al cliente por que); `ok` → insert del cupon con `consumer_id` de la sesion,
  `membership_id` = su membresia en X si existe (publico `dormant`/`any`) o `null`, `cross_claimed_at = now`,
  snapshots del premio iguales a los de la Bienvenida (`welcome-issue.ts`: label, costo, tipo, producto, descuento,
  unidades extra, regla, moneda si es por monto), `valid_from = now`, `valid_until = now + crossValidDays` → **201**.
- `on conflict … do nothing` con el predicado (arriba) + re-lectura → 200: es el respaldo de O8 ante dos reclamos
  simultaneos del MISMO cliente.
- No encola push ni fila en `wallet_push_queue`.

### E3 — `GET /api/public/consumer/coupons`

Suma `origin: "cross" | "campaign"` (`cross` ⇔ `cross_claimed_at` no nulo). Nada mas cambia: el cupon cruzado ya
entra porque la consulta filtra por `consumer_id` (`consumer/coupons.ts`).

### Mostrador

- `loadActiveCoupon` (`counter/coupon-scan.ts`) no cambia: busca por `business_id` + `consumer_id`, y el cupon
  cruzado los tiene.
- `persistCouponRedemption` (`counter/coupon-store.ts:106`): la membresia del canje y de `grantCouponExtras`
  (`:198-203`, `:214`) pasa a ser `coupon.membershipId ?? (membresia del cliente en ese comercio, leida en la
  transaccion)`. Sin ninguna → `409 not_enrolled` («Escaneá el QR del cliente primero»). El cupon no se reescribe.

### Bienvenida — «solo el cruzado»

`decideWelcomeGift` (`welcome-rules.ts:112`) suma el hecho `crossCouponFromBusiness: boolean` y el veredicto
`came_by_cross`, evaluado despues de `enrolled_before`. El hecho lo carga `issueWelcomeGiftsIn`
(`welcome-issue.ts`), que es el camino de los tres disparadores y del barrido del tick (`sweepWelcomeGifts`,
`:183`), asi que se cablea en un solo lugar.

### Arquitectura de referencia

ADR 0104, 0103 §2 y §10, 0099 (Bienvenida), 0098 (premio estructurado), 0094 (vigencia del cupon), 0033
(auto-enrolamiento en el mostrador), 0070 (API sin UI), 0054 (lock del canje).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/0057_oferta_cruzada.sql` (+ `meta`) | crear |
| `server/schema/campaign.ts`, `server/schema/campaign-coupon.ts` | editar |
| `server/marketing/templates.ts`, `template-input.ts`, `template-store.ts` | editar |
| `server/marketing/cross-input.ts`, `cross-rules.ts`, `cross-store.ts` (+ tests) | crear |
| `server/marketing/welcome-rules.ts`, `welcome-issue.ts` | editar |
| `server/consumer/cross-offers.ts` (+ tests), `server/consumer/coupons.ts` | crear / editar |
| `server/counter/coupon-store.ts` | editar |
| `app/api/public/consumer/cross-offers/route.ts`, `…/[campaignId]/claim/route.ts` (+ tests) | crear |
| `docs/specs/0136-contratos-de-api.md` | crear (el orquestador, antes de despachar) |

Rutas relativas a `apps/merchant/src/` salvo las marcadas.

### Disjunta?

**Si.** Specs abiertas: 0110 (borrador, en espera; toca `marketing/` de etapas, no estos archivos). La 0111 esta
implementada.

### Archivos compartidos

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| `0136-contratos-de-api.md` | orquestador | antes de despachar |

## Definition of Done

- [ ] Migracion `0057` generada con drizzle-kit y aplicada a una rama efimera de Neon; `\d` muestra
      `membership_id` nullable, `cross_claimed_at`, los checks y el unico parcial.
- [ ] `enable` de `cross` con cuerpo valido → 201 y `cross` en el DTO; cada campo invalido de la tabla del contrato
      → 400 con ese campo.
- [ ] `GET …/cross-offers` y `POST …/claim` cumplen el contrato, incluidos 401 y 400.
- [ ] Canje en el mostrador de un cupon cruzado de alguien que no era miembro → 201, `coupon_redemption.membership_id`
      = la membresia auto-enrolada.
- [ ] Barrido de la Bienvenida sobre un cliente con cupon cruzado de X → 0 cupones de Bienvenida de X.
- [ ] `rg -n 'ObjectKey|costSnapshot|couponCost|monthlyCap' apps/merchant/src/app/api/public/consumer/cross-offers`
      → vacio (salvo imports de tipos que no se serializan: el revisor lo mira).
- [ ] `git diff --stat` sin archivos en `app/(consumer)/` ni en `components/`.
- [ ] Gates: `typecheck`, `lint`, `test`, `format:check`, `build` (root, Node 24); integraciones nuevas con
      `tools/neon-test.sh`. `test:e2e` no aplica (no toca UI ni CSS).
- [ ] Mutaciones M1–M9 medidas y revertidas (bitacora en `TASKS.md`).
- [ ] PASS de revisor independiente.

## Plan de pruebas y verificación

**Presupuesto de la revision:** hasta **9 mutaciones** (la tabla). Clase de error a cazar: los **plausibles** —
un filtro que se olvida uno de sus dos rubros, el radio o el publico, el cupo sin lock, la membresia nula que llega
al canje, la Bienvenida doble. Queda afuera y se DECLARA: la exactitud geodesica mas alla de haversine, el orden
fino (O6), y cualquier propiedad universal de «no filtra por ningun canal» mas alla del barrido `rg` de la DoD.

**Unidad (puras):** `cross-rules.test.ts` — una tabla con un caso por razon y uno por frontera: 1999 m sale, 2001 m
no; parado a 99 m de un local del mismo rubro no sale, a 101 m si; `dormant` justo en `now - dormantDays`.
`cross-input.test.ts` — cada campo de la tabla del contrato. `welcome-rules` — `came_by_cross`.

**Integracion (`*.neon.integration.test.ts`, siembra real):** coordenadas reales de CABA con distancias medidas por
la misma formula en el test (no numeros escritos a mano).

| # | Mecanismo mutado (archivo) | Oraculo que tiene que ponerse rojo | Guard hermano y como se lo puentea |
|---|---|---|---|
| M1 | la exclusion por rubro del **ultimo escaneado** (`cross-rules.ts`, razon 2) | sin GPS, ultimo escaneo en Cafe A (rubro cafe); cruzada de Cafe B (cafe) a 300 m → no esta en la lista | la exclusion por «parado en» no corre sin GPS |
| M2 | la exclusion por rubro del **local donde esta parado** (`cross-rules.ts`, razon 2) | ultimo escaneo en un Gym; GPS a 50 m del Cafe C; cruzada del Cafe D a 400 m → no esta | el ultimo escaneado es de otro rubro (Gym), asi que M1 no la tapa |
| M3 | el radio de 2000 m (`cross-rules.ts`, razon 3) | cruzada a ~2,5 km → no esta; a ~1,9 km → esta | ninguno |
| M4 | publico `non_members` (`cross-rules.ts`, razon 4) | miembro activo de X no ve la cruzada `non_members` de X | X de rubro distinto y a 300 m, sin opt-out |
| M5 | publico `dormant` (`cross-rules.ts`, razon 4) | miembro con pedido hace 5 dias y `dormantDays` 30 no la ve; con pedido hace 40 dias si | idem M4 |
| M6 | el `for update` de la campaña en el claim (`cross-store.ts`) | cupo 1, dos clientes distintos reclaman en paralelo → exactamente 1 cupon y un `404 offer_unavailable` | el unico parcial es por (campaña, cliente): con dos clientes distintos no actua |
| M7 | la lectura previa «ya lo tiene → 200» del claim (`cross-store.ts`) | el mismo cliente reclama dos veces → 200 con el MISMO `id`, 1 fila | el unico parcial + `on conflict` es el hermano: la mutacion saca la lectura previa; si sigue verde, M7 se declara cubierta por el respaldo y se muta el `on conflict` (→ 500 por `23505`) |
| M8 | la membresia del canje `coupon.membershipId ?? …` (`counter/coupon-store.ts`) | resolve + canje de un cupon cruzado de no-miembro → 201 y `membership_id` = la auto-enrolada | ninguno: con `null` el insert viola el `NOT NULL` de `coupon_redemption` |
| M9 | el cableado de `crossCouponFromBusiness` en `issueWelcomeGiftsIn` (`welcome-issue.ts`) | cliente con cupon cruzado de X, auto-enrolado en X, con pase Google guardado; `sweepWelcomeGifts` → 0 cupones de Bienvenida de X | la regla pura tiene su propio test; esta fila borra la LLAMADA (§2.0-quater) |

**Aislamiento:** la sesion de A no ve ni reclama con el id de cliente de B (el id no viaja); sin sesion → 401 en
las dos rutas; un `campaignId` de una plantilla que no es `cross` → 404 `offer_unavailable`.

**Wallet:** tras un claim, 0 filas nuevas en `consumer.wallet_push_queue` (`schema/wallet-push.ts:63`) y en
`core.campaign_push` para ese cliente.

**Comandos:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use`; `pnpm run typecheck && pnpm run lint &&
pnpm run test && pnpm run format:check && pnpm run build`; `tools/neon-test.sh <archivo>` por cada integracion
nueva y por `counter/coupon-*.neon.integration.test.ts` y `marketing/welcome-*.neon.integration.test.ts`.

**QA del owner (despues del deploy, con la migracion en PROD y su OK):** activar una cruzada en un comercio de otro
rubro; desde el telefono con la cuenta de un cliente, `GET /api/public/consumer/cross-offers?lat=…&lng=…` la
muestra; `POST …/claim` devuelve el cupon; en el mostrador de ese comercio el escaneo lo ofrece y se canjea.

## Handoff requerido

`docs/AGENT-WORKFLOW.md`: un implementador para toda la spec y un revisor independiente. La migracion a PROD
lleva OK explicito del owner.

## Abierto

Nada que bloquee. Las elecciones O1–O8 son reversibles y se informan al owner al cerrar; si cambia alguna, se
cambia aca antes de despachar.
