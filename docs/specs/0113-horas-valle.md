---
spec: 0113
fecha: 2026-09-29
estado: implementada
resumen: Horas valle por API — horario de apertura por local (por dia, hasta 2 rangos), deteccion de la franja floja por la red (bloque de 1 h < 40 % de la mediana en ≥ 5 de 8 semanas, minimo 150 escaneos) con franjas editables por el comercio, plantilla «Horas valle» (premio incl. texto libre, cupo mensual, no clientes + dormidos), visible en «Mis beneficios» solo con la franja abierta y con el filtro de la cruzada, cupon valido hasta el cierre de la franja del dia, una vez por persona y por local. Migracion 0058. Sin UI. Despues de la 0136.
disjunta: no
archivos: apps/merchant/drizzle/0058_*.sql, apps/merchant/src/server/schema/{business.ts,valley.ts,campaign.ts,campaign-coupon.ts,reward-checks.ts,_barrel si aplica}, apps/merchant/src/server/locations/hours*.ts, apps/merchant/src/app/api/locations/[locationId]/hours/route.ts, apps/merchant/src/server/marketing/{valley-detect.ts,valley-rules.ts,valley-store.ts,valley-input.ts,templates.ts,template-input.ts,reward-input.ts,tick.ts,cross-rules.ts,cross-store.ts}, apps/merchant/src/app/api/marketing/valley/**, apps/merchant/src/server/consumer/{cross-offers.ts,cross-facts.ts,valley-offers.ts}, apps/merchant/src/server/marketing/{campaign-store.ts,campaign-row.ts,cross-input.ts}, apps/merchant/src/app/api/public/consumer/cross-offers/**, docs/specs/0113-contratos-de-api.md
---

# 0113 — Horas valle

> Implementa el **ADR 0105** (sobre el ADR 0103 §5 y §10 y el ADR 0104). Plantilla grande: migracion y tres dominios
> (locales, marketing, consumidor). **Solo API + contrato** (`0113-contratos-de-api.md`); la UI la hace el owner.
> **Se despacha despues del PASS de la 0136** (PASS 2026-09-29, `bd4f833` + `c234b3d`; esta spec ya esta re-medida
> contra ese arbol): reusa su filtro (`cross-rules.ts`), su lista y su reclamo
> (`cross-offers`), y su cupon sin membresia (`cross_claimed_at`). Si al despachar la 0136 cambio de forma, se
> re-mide esta spec contra el arbol antes.

## Problema

- El comercio no puede llenar sus horas flojas con clientes nuevos: no hay forma de ofrecer algo **solo en una
  franja** ni **solo a quien no es cliente activo**.
- La red no puede distinguir «franja floja» de «cerrado»: **no existe horario de apertura** (grep de
  `opening_hours|openingHours|businessHours` vacio; `docs/red-horas-valle-y-modelo.md` §2.2).
- El dato para detectar la franja existe: `core.order` con `created_at`, `location_id` (nullable,
  `schema/order.ts:38`), indice `(business_id, created_at)` (`schema/order.ts:79`), y `core.business.timezone`
  (`schema/business.ts:84`). PROD: 0 pedidos → al principio ningun local tiene datos.

## Decisiones del owner que implementa

- ADR 0103 §5 y §10 (textual resumido): la franja la propone la red, **editable por el comercio**; publico **no
  clientes y dormidos**; beneficio: **sellos/puntos extra** segun el programa, **un producto** del menu, o **texto
  libre** («2x1 en cerveza»); deteccion = §2.3 del doc (bloque de 1 h < 40 % de la mediana del local en ≥ 5 de 8
  semanas; con < ~150 escaneos se le pregunta al comercio); tope **una vez por persona y por local**; horario de
  apertura lo carga el comercio **en Marca** (la pantalla es del owner; la API vive con los locales).
- ADR 0105: plantilla propia; filtro **igual que la cruzada**; cupon vale **solo la franja de ese dia**; horario
  **por local, con cortado** (hasta 2 rangos por dia).

## Elecciones del orquestador (reversibles, se informan al owner)

- **V1 — Rango que cruza la medianoche**: se admite (`closes <= opens` = cierra al dia siguiente, ej. 20:00–02:00);
  la hora 00–02 cuenta como parte del dia en que abrio. Sin esto un bar no puede cargar su horario.
- **V2 — Minutos**: los rangos del horario van en pasos de 30 min; las franjas valle en horas enteras (el bloque de
  la deteccion es de 1 h).
- **V3 — Sin horario cargado**: la deteccion usa como «abiertas» las horas con al menos un escaneo en ≥ 3 de las 8
  semanas (§2.3 punto 2). Las franjas del comercio no exigen horario cargado.
- **V4 — Recalculo**: el tick de marketing (cada 6 h, `.github/workflows/marketing-tick.yml`) recalcula la propuesta
  de un local si tiene mas de 7 dias o si su horario cambio. Nunca toca las franjas del comercio.
- **V5 — Cupo mensual** como la cruzada (1..10000, def. 50), por campaña.
- **V6 — `dormantDays`** 30 | 60 | 90, def. 30 (dormido = `dormantSince` de `marketing/audience.ts`).
- **V7 — El local no se exige en el mostrador**: el cupon dice en que local es, pero el canje no rechaza otro local
  del mismo comercio (el vencimiento al cierre de la franja ya acota el uso). Declarado.
- **V8 — El texto libre (`custom`)** solo se acepta en esta plantilla.
- **V9 — Mapa de calor** en la API del comercio (§2.6 del doc): conteo de escaneos por dia × hora de las ultimas 8
  semanas, para que la UI muestre por que se propuso la franja.

## Alcance

**Entra:**
1. Horario de apertura por local: modelo, `GET`/`PUT /api/locations/{locationId}/hours`.
2. Deteccion (funcion pura) + su persistencia por local + el paso del tick.
3. Franjas por local: las propuestas (`network`) y las del comercio (`merchant`); API de marketing para verlas,
   reemplazarlas y volver a las de la red.
4. Plantilla `valley` y el tipo de premio `custom`.
5. En `GET /api/public/consumer/cross-offers`: ofertas de horas valle con `type: "valley"`; en el `claim`, la
   emision del cupon valle.
6. Contrato `docs/specs/0113-contratos-de-api.md`.

**No entra:** ninguna pantalla (**corregido 2026-09-30:** la afirmacion original «`CouponKind` de la UI es un union propio y no rompe» era FALSA —
`composer.tsx:29` asigna el `Campaign` del servidor al de la UI—; el orquestador autorizo SOLO sumar `"custom"` al union
de `marketing-types.ts` y su etiqueta en `reward-labels.ts`, para que compile); aviso/push de la franja (lo decide el arbitro, ADR 0103 §6);
el informe «volvio a precio completo» (§2.6 punto 3 del doc, otra spec); el grupo de control; el recibo del
escaneo; enforcement del local en el mostrador (V7).

## Diseño

### Modelo de datos (migracion `0058`)

- `core.location_hours` — `location_id` (fk, cascade), `weekday smallint` (1 = lunes … 7 = domingo, ISO),
  `position smallint` (1 | 2), `opens time`, `closes time`; pk `(location_id, weekday, position)`; checks: weekday
  1..7, position 1..2, minutos multiplo de 30, `opens <> closes`. Un dia sin filas = cerrado.
  El «hasta 2 rangos» y que no se pisen lo valida la ruta (dos filas no se pueden comparar en un check).
- `core.valley_window` — `id`, `location_id` (fk, cascade), `weekday`, `start_hour smallint` (0..23), `end_hour
  smallint` (1..24, `> start_hour`), `source text` (`'network' | 'merchant'`), `created_at`. Indice
  `(location_id, weekday)`. Una franja no cruza la medianoche (V2: horas del mismo dia local).
- `core.valley_detection` — `location_id` pk, `computed_at`, `status` (`'proposed' | 'none' | 'insufficient_data'`),
  `scans` integer (escaneos en la ventana), `hours_version` integer. `core.location` suma `hours_version integer not
  null default 0`, que el `PUT` de horario incrementa (asi el tick sabe que cambio).
- `core.campaign`: `valley_monthly_cap integer null`; checks: `(template_key = 'valley') = (valley_monthly_cap is
  not null)`, rango 1..10000; `template_key` suma `'valley'`; los checks que exceptuan `welcome`/`cross` (canales,
  cupon sin tope, `ends_at`) suman `valley`.
- `core.campaign_coupon`: `valley_location_id uuid null` (fk `set null`); unico parcial `(valley_location_id,
  consumer_id) where valley_location_id is not null` (tope por local, ADR 0105 §4; `on conflict` con predicado);
  check `valley_location_id is null or cross_claimed_at is not null` (el valle SIEMPRE es un reclamo).
- `reward-checks.ts`: `COUPON_KIND_VALUES` suma `custom`; shape: `custom` sin producto, sin descuento, sin unidades
  (sale de los checks existentes: ninguno lo admite), con `label` como texto. Aplica a campaña, cupon y canje.

### Horario — `GET`/`PUT /api/locations/{locationId}/hours`

Con `requireLocationsOwner` (`app/api/locations/_auth.ts`, el mismo guard de las rutas de locales) y el local del
negocio del caller (otro → 404). `PUT` reemplaza la semana entera en una transaccion (delete + insert) e incrementa
`hours_version`. Validacion en `server/locations/hours-input.ts` (pura): 7 dias, 0–2 rangos, `HH:MM` en pasos de 30,
los dos rangos de un dia no se pisan (con V1 incluido). Errores `400 validation` con `fields["days.N.ranges.M"]`.

### Deteccion — `valley-detect.ts` (pura)

Entrada: los escaneos del local (hora local ya convertida con la `timezone` del comercio) de las 8 semanas
completas anteriores al dia local de hoy, y el horario (o nada).

1. Grilla 7 dias × 24 horas × 8 semanas de conteos.
2. Bloques abiertos: los que caen enteros dentro de un rango del horario (V1: la hora de madrugada va al dia de
   apertura); sin horario, V3.
3. `scans < 150` → `insufficient_data`, sin franjas.
4. Por semana `w`: `median_w` = mediana de los conteos de los bloques abiertos en `w`. Un bloque es flojo en `w` si
   `median_w > 0` y `count_w < 0.4 × median_w`. **Valle** = flojo en **≥ 5 de las 8** semanas.
5. Bloques valle contiguos del mismo dia se juntan en una franja. Ninguno → `none`.

Persistencia (`valley-store.ts`): reemplaza SOLO las filas `source = 'network'` del local y escribe
`valley_detection`. Paso del tick: una llamada en `runMarketingTick` (`marketing/tick.ts:195`, 269 lineas: la
logica va en `valley-store.ts`, en `tick.ts` solo la llamada) para los locales activos cuyo `computed_at` tiene > 7
dias o cuyo `hours_version` difiere.

### Franjas vigentes

Las de un local = sus filas `merchant` si tiene alguna; si no, sus filas `network`. Una franja esta **abierta** si
el dia y la hora local actuales del comercio caen en `[start_hour, end_hour)`.

API de marketing (owner de marketing, `app/api/marketing/_auth.ts`), en `app/api/marketing/valley/`:
- `GET locations` → por local activo: `detection` (status, computedAt, scans), `networkWindows`, `merchantWindows`,
  `effective` (`"merchant" | "network"`), `hoursSet` (bool), `heatmap` (7×24 conteos, V9).
- `PUT locations/{locationId}/windows` — reemplaza las `merchant` (lista de `{ weekday, startHour, endHour }`, sin
  pisarse); `[]` → `400` (para volver a la red se usa `DELETE`).
- `DELETE locations/{locationId}/windows` — borra las `merchant`: vuelven a mandar las de la red.

### Plantilla `valley`

`VALLEY_TEMPLATE` en `valley-rules.ts` (como `CROSS_TEMPLATE` en `cross-rules.ts:30`: `templates.ts` tiene 276
lineas; en `templates.ts` solo se suma al catalogo), `key: "valley"`, `title: "Horas valle"`, `channels: []`, `group: "valley"`, `couponRequired: true`,
`dormantDays` (V6), `valley: { monthlyCap: { min: 1, max: 10000, default: 50 } }`, mensaje def. «Ahora hay lugar:
te esperamos con un regalo», max 60. `valley-input.ts` (espejo de `cross-input.ts`): `valleyMonthlyCap`; prohibidos
`channels`, `excludedLocationIds` no vacio, `couponMaxRedemptions`, `welcome*`, `cross*`; `couponKind: "custom"`
solo aca (V8: en otra plantilla → 400 `couponKind`). DTO `Campaign` suma `valley: { monthlyCap } | null`.

### Consumidor

`GET /api/public/consumer/cross-offers` (0136) suma las ofertas valle. Por cada campaña valle elegible (mismas
condiciones de campaña que la cruzada) y cada local suyo con una franja **abierta ahora**:
se llama a **`decideCrossOffer`** (`cross-rules.ts:178`, la misma funcion de la cruzada, sin copiarla) con
`offer.locations = [ese local]` (asi `too_far` se mide contra el local de la franja), `offer.audience =
"not_active"`, `claimed` = ya tiene un cupon valle **de ese local** (de cualquier campaña) y el cupo valle del mes.
`"not_active"` es un valor NUEVO de `CrossAudience` que `inAudience` (`cross-rules.ts:163`) resuelve como «no
miembro, o miembro dormido» (el miembro activo nunca). Es interno: `cross-input.ts` NO lo acepta en una cruzada
(`crossAudience: "not_active"` → 400) y el check `cross_audience` de la base no cambia.
Una oferta por (campaña, local), con `type: "valley"`, `locationId`, `window: { startHour, endHour, endsAt }`. Las
cruzadas suman `type: "cross"`. Orden: las valle primero (vencen hoy), despues por distancia.

La lista y el reclamo valle viven en `server/consumer/valley-offers.ts` (nuevo): `consumer/cross-offers.ts` tiene
255 lineas y solo suma las llamadas. `POST …/{campaignId}/claim` con `{ lat?, lng?, locationId }` (`locationId` obligatorio para valle; en cruzada
prohibido → 400): mismo lock y re-evaluacion que la 0136; cupon con `valley_location_id`, `cross_claimed_at = now`,
`valid_from = now`, `valid_until` = fin de la franja abierta de hoy (hora local → UTC). El `on conflict` del unico
por local → re-lectura → 200 si es de esta campaña, 404 `offer_unavailable` si es de otra.

El mostrador no cambia: `loadActiveCoupon` ya respeta `valid_until`.

### Arquitectura de referencia

ADR 0105, 0104, 0103 §5/§10, 0098 (premio), 0094 (vigencia), 0061 (locales), 0092 (plantillas).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/0058_horas_valle.sql` (+ `meta`) | crear |
| `server/schema/valley.ts` (hours, window, detection) + barrel | crear / editar |
| `server/schema/business.ts` (`hours_version`), `campaign.ts`, `campaign-coupon.ts`, `reward-checks.ts` | editar |
| `server/locations/hours-input.ts`, `hours-store.ts` (+ tests) | crear |
| `app/api/locations/[locationId]/hours/route.ts` (+ test) | crear |
| `server/marketing/valley-detect.ts`, `valley-rules.ts`, `valley-store.ts`, `valley-input.ts` (+ tests) | crear |
| `server/marketing/templates.ts`, `template-input.ts`, `reward-input.ts`, `tick.ts`, `campaign-store.ts`, `campaign-row.ts` (DTO `valley`) | editar |
| `server/marketing/cross-rules.ts`, `cross-store.ts` (0136) | editar |
| `app/api/marketing/valley/locations/route.ts`, `…/[locationId]/windows/route.ts` (+ tests) | crear |
| `server/consumer/valley-offers.ts` (+ tests) | crear |
| `server/consumer/cross-offers.ts`, `cross-facts.ts`, `app/api/public/consumer/cross-offers/**`, `server/marketing/cross-input.ts` (0136) | editar |
| `docs/specs/0113-contratos-de-api.md` | crear (orquestador, antes de despachar) |

Rutas relativas a `apps/merchant/src/` salvo las marcadas. Limite de 300 lineas: dividir, no extender.

### Disjunta?

**No: se serializa detras de la 0136** (comparte `cross-rules.ts`, `cross-store.ts`, `cross-offers.ts`, las rutas de
`cross-offers`, `campaign.ts`, `campaign-coupon.ts`, `templates.ts`, `template-input.ts`).

### Archivos compartidos

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| `0113-contratos-de-api.md` | orquestador | antes de despachar |
| re-medicion de esta spec contra la 0136 implementada | orquestador | antes de despachar |

## Definition of Done

- [ ] Migracion `0058` aplicada a una rama efimera; `\d` muestra las tres tablas, `hours_version`, los checks y los
      dos unicos parciales.
- [ ] `PUT`/`GET` de horario cumplen el contrato (incluye cortado, cruce de medianoche, 400 por rango pisado, 404
      por local ajeno).
- [ ] Deteccion: la tabla de casos de abajo en verde.
- [ ] API de franjas y plantilla `valley` cumplen el contrato; `custom` en otra plantilla → 400.
- [ ] `cross-offers` lista la oferta valle solo con la franja abierta; `claim` emite el cupon con `valid_until` = fin
      de la franja de hoy.
- [ ] `git diff --stat` sin archivos en `app/(consumer)/`, `app/backoffice/` ni `components/`.
- [ ] Gates: `typecheck`, `lint`, `test`, `format:check`, `build` (root, Node 24); integraciones con
      `tools/neon-test.sh`, incluidas las de la 0136 (regresion). `test:e2e` no aplica.
- [ ] Mutaciones M1–M9 medidas y revertidas (bitacora en `TASKS.md`). PASS de revisor independiente.

## Plan de pruebas y verificación

**Presupuesto:** hasta **9 mutaciones**. Clase de error a cazar: los plausibles — umbral o regla de semanas mal
cableados, franja cerrada que se muestra, miembro activo que la ve, tope por local ausente, `valid_until` que no es
el cierre de la franja, el tick que pisa la franja del comercio, el filtro de la cruzada que no se aplica al valle.
Queda afuera y se DECLARA: horarios de verano (se usa `Intl` con la `timezone` del comercio y un caso con una zona
con DST, sin perseguir mas), locales con > 2 rangos, y la calidad estadistica de la deteccion (la regla es la del
owner; se prueba que se cumple, no que sea buena).

**Unidad:** `valley-detect.test.ts` con grillas sinteticas: 150 vs 149 escaneos; 35 % vs 45 % de la mediana; flojo
5 vs 4 de 8 semanas; mediana 0; contiguos que se juntan; cruce de medianoche (V1); sin horario (V3).
`hours-input.test.ts`: cada error. `valley-rules.test.ts`: abierta en `start_hour`, cerrada en `end_hour`; activo /
dormido / no miembro; `valid_until` en una zona UTC-3 y en una con DST.

| # | Mecanismo mutado (archivo) | Oraculo que tiene que ponerse rojo | Guard hermano y como se lo puentea |
|---|---|---|---|
| M1 | umbral 0.4 (`valley-detect.ts`) | bloque al 35 % → valle; al 45 % → no | ninguno |
| M2 | la regla ≥ 5 de 8 (`valley-detect.ts`) | flojo en 4 semanas → no es valle | el umbral (M1): el caso usa 20 % para que solo decida el conteo de semanas |
| M3 | el minimo de 150 (`valley-detect.ts`) | 149 escaneos con un hueco obvio → `insufficient_data` | con 149 la mediana sigue > 0: nada mas lo corta |
| M4 | «franja abierta ahora» (`valley-rules.ts`) | integracion: franja 15–17, reloj 17:00 hora local → la oferta no esta; 16:59 → esta | ninguno |
| M5 | la rama `"not_active"` de `inAudience` (`cross-rules.ts`) | miembro con pedido hace 3 dias no la ve; no miembro si | filtro de rubro/distancia: local de otro rubro a 300 m |
| M6 | la llamada a `decideCrossOffer` en el camino valle (`consumer/valley-offers.ts`) | ultimo escaneo en un cafe; valle de otro cafe a 300 m → no esta | la regla pura de la 0136 tiene su test: esta fila borra la LLAMADA en el camino valle |
| M7 | `valid_until` = fin de la franja (`valley-rules.ts`, usado por `consumer/valley-offers.ts`) | claim 15:10 en franja 15–17 (UTC-3) → `validUntil` = 20:00Z; el resolve del mostrador a las 17:05 local → `coupon: null` | ninguno |
| M8 | el tope por local: lectura previa (`consumer/valley-offers.ts`) | dos campañas valle del mismo comercio, mismo local: la 2.ª no se lista y su claim → 404 | el unico parcial `(valley_location_id, consumer_id)`: si la mutacion da verde en la lista, se mide el claim y se declara el respaldo |
| M9 | el tick respeta `source = 'merchant'` (`valley-store.ts`) | local con franja del comercio; tick con datos que proponen otra → la del comercio sigue y es la efectiva | ninguno |

**Aislamiento:** horario y franjas de un local de otro negocio → 404; el rol sin permiso de locales/marketing → el
error de su `_auth`; el cliente sale solo de la sesion.

**Comandos:** los de la 0136, mas `tools/neon-test.sh` sobre los tests nuevos y los de `cross-offers`.

**QA del owner:** cargar horario con cortado a un local; cargar una franja propia que incluya la hora actual; activar
«Horas valle»; desde el telefono de un no cliente cerca, `cross-offers` la muestra con `type: "valley"`; reclamar;
en el mostrador se ofrece y se canjea; pasada la franja, no se ofrece.

## Handoff requerido

`docs/AGENT-WORKFLOW.md`: un implementador y un revisor independiente, despues del PASS de la 0136. Migracion a PROD
con OK del owner.

## Abierto

Nada que bloquee. V1–V9 son reversibles y se informan al owner.
