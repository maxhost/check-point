---
spec: 0102
fecha: 2026-09-26
estado: borrador
resumen: El cupon de campaña pasa del turno de proximidad a una fila propia `core.campaign_coupon` (ADR 0093); la proximidad lo emite al activar un turno no-holdout, el mostrador lo pinta y lo canja por `couponId` sin saber el canal, y `coupon_redemption` referencia al cupon. Prerrequisito de la B1 (push de campaña).
disjunta: si
archivos: apps/merchant/src/server/schema/campaign-turn.ts, apps/merchant/drizzle/0045_*.sql, apps/merchant/src/server/marketing/placement.ts, apps/merchant/src/server/marketing/turn-lifecycle.ts, apps/merchant/src/server/counter/coupon-store.ts, apps/merchant/src/server/counter/coupon-decision.ts, apps/merchant/src/server/counter/coupon.ts, apps/merchant/src/app/backoffice/counter/{types.ts,coupon-panel.tsx,counter-console.tsx}, tests y supports de cupon
---

# 0102 — Cupon de campaña desacoplado del canal (B0)

## Problema

El cupon de una campaña solo existe adentro del turno de proximidad: `campaign_turn` guarda el
snapshot (`coupon_label_snapshot`, `coupon_cost_snapshot`), `coupon_redemption.turn_id` es
`NOT NULL`, y el mostrador busca un turno `active`, no holdout, con ventana abierta
(`server/counter/coupon-store.ts:57-59`) para pintar y canjear. La spec B1 suma el push como canal de
campaña: con el modelo actual, un cliente alcanzado por push no tendria cupon canjeable. El owner lo
rechazo (ADR 0093) y pidio desacoplarlo en una spec propia antes de la B1.

## Alcance

**Entra:**
- Tabla `core.campaign_coupon` y migracion `0045`.
- `coupon_redemption.turn_id` → `coupon_id`.
- Emision del cupon al activar un turno de proximidad (no holdout, campaña con cupon).
- Mostrador: scan (`resolve`) y canje (`coupon-redeem`) sobre el cupon, con el contrato renombrado.
- El resultado del turno (`expireTurns` y el canje) leyendo el canje a traves del cupon.
- Contrato HTTP del mostrador para el cupon, escrito (seccion «Contrato»).

**No entra:**
- Emision por push, y la regla de «ya tiene un cupon vivo de esta campaña» → B1.
- Catalogo de cupones/premios del comercio (spec 0021) y cupones fuera de campaña.
- Que el consumidor vea sus cupones en el portal.
- Quitar `coupon_label_snapshot`/`coupon_cost_snapshot` de `campaign_turn`: los sigue usando el
  texto del pase (`placement-plan.ts:211`). No se tocan.
- Rediseño de la UI del mostrador: solo se renombran los campos que consume (ADR 0070: la UI nueva
  la hace el owner por fuera).

## Diseño

### Especificación técnica

**Modelo de datos (migracion `0045`, generada con `drizzle-kit generate`; la spec no dicta el
`.sql`).** Prod tiene 0 filas en `campaign`, `campaign_turn` y `coupon_redemption` (medido por SQL,
2026-09-26), asi que no hay backfill.

`core.campaign_coupon`:

| Columna | Tipo | Regla |
|---|---|---|
| `id` | uuid pk | `defaultRandom()` |
| `campaign_id` | uuid → `core.campaign` | `NOT NULL` |
| `business_id` | uuid → `core.business` | `NOT NULL`, `on delete cascade` |
| `consumer_id` | uuid → `consumer.consumer_account` | `NOT NULL` |
| `membership_id` | uuid → `consumer.program_membership` | `NOT NULL` |
| `turn_id` | uuid → `core.campaign_turn` | nullable, **unico** (un turno emite a lo sumo un cupon); nullable para la B1 (push sin turno) |
| `label_snapshot` | text | `NOT NULL`, 1..40 (mismo check que `coupon_label`) |
| `cost_snapshot` | numeric(12,2) | `NOT NULL`, `>= 0` |
| `valid_from`, `valid_until` | timestamptz | `NOT NULL`, check `valid_until > valid_from` |
| `created_at` | timestamptz | `defaultNow()` |

Indice `(business_id, consumer_id, valid_until)` para el scan.

`core.coupon_redemption`: se borra `turn_id` y su unico `core_coupon_redemption_turn_unique`; se
agrega `coupon_id uuid NOT NULL → core.campaign_coupon` con unico
`core_coupon_redemption_coupon_unique`. El resto de la tabla no cambia (incluido el unico
`(business_id, client_request_id)`). La fk circular `campaign_turn.outcome_redemption_id →
coupon_redemption.id` se conserva.

**Emision (proximidad).** En `applyPlan` (`server/marketing/placement.ts:65`), dentro de la misma
transaccion del tick, por cada activacion con `holdout = false` y `couponLabelSnapshot !== null`, se
inserta un `campaign_coupon` con `turn_id` = el turno, `valid_from = windowStart`,
`valid_until = windowEnd`, snapshots = los de la activacion (`cost_snapshot` =
`couponCostSnapshot ?? "0.00"`, como hoy en `coupon-store.ts`). `on conflict (turn_id) do nothing`
(unico NO parcial: no aplica el gotcha de `on conflict` sobre parciales). **El holdout no emite**: hoy
`placement-plan.ts:211` copia el label tambien a los holdout, asi que la condicion es obligatoria.
Se exporta una funcion pura `couponToIssue(activation)` → fila o `null`, que es la que decide.

**Scan (`loadActiveCoupon`).** Busca en `campaign_coupon` del `(business, consumer)`:
`valid_from <= now <= valid_until`, campaña `active`, y sin fila en `coupon_redemption`
(`not exists … cr.coupon_id = c.id`). Orden total `valid_until asc, id asc`, `limit 1`. **No mira
el turno** (ADR 0093 §4). Devuelve `{ couponId, label, campaignName, validUntil }`.

**Canje (`persistCouponRedemption`).** Mismo orden normativo que hoy, con el cupon en lugar del turno:
(0) leer `campaign_id` del cupon con scope `business_id` (ajeno → 404 `unknown_coupon`); (1)
`FOR UPDATE` sobre la CAMPAÑA y despues sobre el CUPON; (2) idempotencia por `client_request_id`
bajo el lock, con `assertSameCoupon` (misma regla que `assertSameTurn`, renombrada); (3)
`decideCouponRedemption` puro sobre las filas bloqueadas + `count` bajo el lock; (4) insertar con
`coupon_id` y los snapshots DEL CUPON; si el cupon tiene `turn_id`, marcar el turno
(`outcome = 'coupon_redeemed'`, `outcome_redemption_id`, `outcome_at`) como hoy; (5) push
transaccional en la misma transaccion, sin cambios. El backstop `23505` de `coupon.ts` distingue igual
que hoy (fila con esa clave → reintento; sin fila → el unico que salto es el del cupon →
409 `already_redeemed`).

**Decision (`decideCouponRedemption`).** Hechos: `{ coupon: { validFrom, validUntil,
redeemed }, campaign: { status, couponMaxRedemptions }, redeemedCount, now }`. Orden normativo:
1. `coupon_not_active` (409) — campaña no `active`, o `now` fuera de `valid_from..valid_until`.
2. `already_redeemed` (409).
3. `coupon_cap_reached` (409) — `redeemedCount >= couponMaxRedemptions`; `null` = sin tope.

Desaparecen del canje los casos «turno no `active`» y «holdout»: un holdout no tiene cupon y el estado
del turno ya no cuenta (ADR 0093 §4).

**Resultado del turno (`expireTurns`, `turn-lifecycle.ts:41`).** «Canjeado» pasa a ser
`exists (select 1 from core.coupon_redemption cr join core.campaign_coupon cc on cc.id =
cr.coupon_id where cc.turn_id = t.id)`, y `outcome_redemption_id` se toma por el mismo camino.

**Resultados de campaña.** `results-store.ts` cuenta canjes por `cr.campaign_id` y por
`cr.location_id`: no cambia. Verificar que ningun otro lector use `cr.turn_id`
(`rg -n 'turn_id|turnId' apps/merchant/src/server` sobre lo que toca `coupon_redemption`).

**Autorizacion.** Sin cambios: el scan y el canje los opera cualquier miembro activo del negocio
(spec 0072); todo va con scope `business_id`, y un cupon de otro negocio es 404, nunca 403.

### Contrato HTTP del mostrador (cupon)

`POST /api/counter/resolve` — en la respuesta, `coupon` es `null` o:

```jsonc
{
  "couponId": "uuid",          // antes: turnId
  "label": "2x1 en picadas",
  "campaignName": "Recuperar perdidos",
  "validUntil": "2026-10-01T03:00:00.000Z"  // ISO string; antes: windowEnd
}
```

`POST /api/counter/coupon-redeem` — cuerpo `{ clientRequestId: uuid, couponId: uuid,
locationId?: uuid | null }` (antes `turnId`). 200 → `{ coupon: { label, campaignName } }` (sin
cambios; sin ids). Errores: 400 `invalid_body` (uuid invalido), 404 `unknown_coupon`, 409
`coupon_not_active` | `already_redeemed` | `coupon_cap_reached` | `request_id_reused`, 503 lo inesperado.
Este bloque se copia a `docs/specs/0072-contratos-de-api.md` en la seccion del mostrador.

### Arquitectura de referencia

ADR 0093 (este cambio), 0065 (turnos, holdout), 0054 §3 (unicos como backstop), 0037 (outbox),
0072 (permisos del mostrador), 0070 (API sin UI nueva).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/schema/campaign-turn.ts` | editar: `campaignCoupons`, `couponRedemptions.couponId` |
| `apps/merchant/drizzle/0045_*.sql` + `meta/` | crear (generado) |
| `apps/merchant/src/server/marketing/placement.ts` | editar: emision en `applyPlan` |
| `apps/merchant/src/server/marketing/coupon-issue.ts` | crear: `couponToIssue` puro |
| `apps/merchant/src/server/marketing/turn-lifecycle.ts` | editar: canjeado via cupon |
| `apps/merchant/src/server/counter/coupon-store.ts` | editar: scan y canje sobre el cupon |
| `apps/merchant/src/server/counter/coupon-decision.ts` | editar: hechos del cupon, codigos nuevos |
| `apps/merchant/src/server/counter/coupon.ts` | editar: `couponId`, `assertSameCoupon` |
| `apps/merchant/src/app/backoffice/counter/types.ts`, `coupon-panel.tsx`, `counter-console.tsx` | editar: renombres |
| `apps/merchant/src/server/counter-coupon-support.ts`, `marketing-integration-support.ts`, `marketing-read-support.ts` | editar: sembrar el cupon |
| tests de cupon listados en el plan | editar al contrato nuevo |
| `docs/specs/0072-contratos-de-api.md` | editar: bloque del cupon |

### Disjunta?

**Si.** La 0100 (tours de loyalty, sesion paralela) toca `app/backoffice/loyalty/**`; no hay otra
spec abierta sobre marketing ni el mostrador.

### Archivos compartidos

Ninguno que el orquestador deba dejar listo.

## Definition of Done

- [ ] Migracion `0045` generada; aplicada en la rama de CI por `tools/neon-test.sh`.
- [ ] Un turno activado, no holdout, de campaña con cupon deja UN `campaign_coupon` con la ventana del
  turno; un holdout no deja ninguno; correr el tick dos veces no duplica.
- [ ] El scan pinta el cupon aunque el turno se haya cancelado por `opt_out` o `location_archived`, y
  deja de pintarlo al canjearlo, al pausar la campaña o fuera de su ventana.
- [ ] El canje escribe `coupon_redemption.coupon_id`, marca el turno `coupon_redeemed`, y las carreras
  de `counter-coupon-races` siguen dejando una fila (mismo cupon) y respetando el tope (cupones
  distintos).
- [ ] `expireTurns` marca `coupon_redeemed` a un turno cuyo cupon se canjeo.
- [ ] `rg -n 'turnId|unknown_turn|turn_not_active|windowEnd' apps/merchant/src/server/counter apps/merchant/src/app/backoffice/counter` → vacio.
- [ ] Contrato del cupon copiado a `0072-contratos-de-api.md`.
- [ ] Seis gates verdes: `typecheck`, `lint`, `test`, `format:check`, `build`, `test:e2e` (toca pantalla
  del mostrador) + los `.neon.integration` de cupon y marketing con `tools/neon-test.sh`.

## Plan de pruebas y verificación

- [ ] **Unit `coupon-issue.test.ts`:** `couponToIssue` → fila con ventana y snapshots; `null` para
  holdout; `null` sin label; `cost_snapshot` `"0.00"` si el costo es null.
- [ ] **Unit `coupon-decision.test.ts`** (reescrito al contrato nuevo): ventana no abierta / vencida /
  campaña pausada → `coupon_not_active`; `already_redeemed` gana al tope; tope `>=`; tope `null` = sin
  tope; `coupon_not_active` gana a los otros dos.
- [ ] **Integracion `counter-coupon.neon.integration.test.ts`:** los casos actuales al contrato nuevo, mas:
  (a) turno cancelado por `opt_out` → el scan sigue pintando el cupon y el canje da 200; (b) holdout →
  el scan no pinta nada y no existe fila en `campaign_coupon`; (c) cupon de otro negocio → 404
  `unknown_coupon`.
- [ ] **Integracion del tick** (en `marketing-outcome` o un archivo nuevo `marketing-coupon-issue`):
  tick con campaña con cupon → un `campaign_coupon` por turno activado no holdout; segundo tick → mismo
  conteo; canje + expiracion → `outcome = 'coupon_redeemed'` y `outcome_redemption_id` correcto; y
  DOS turnos vencidos de la misma campaña con uno solo canjeado → solo ese queda `coupon_redeemed`
  (oraculo de M5).
- [ ] **Carreras** `counter-coupon-races`: las tres, sobre cupones.
- [ ] Comandos: `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run format:check`;
  `pnpm run build` (aparte, no en la misma invocacion que typecheck); `pnpm test:e2e`;
  `tools/neon-test.sh apps/merchant/src/server/counter-coupon.neon.integration.test.ts
  apps/merchant/src/server/counter-coupon-races.neon.integration.test.ts
  apps/merchant/src/server/marketing-outcome.neon.integration.test.ts
  apps/merchant/src/server/marketing-merit.neon.integration.test.ts` (+ el archivo nuevo si lo hay).
- [ ] Verificacion manual: el owner, en el mostrador, escanea un pase con cupon y lo canjea
  (requiere una campaña con cupon y un turno activo; QA del owner con la UI actual).

### Mutaciones (presupuesto: 6; clase: errores PLAUSIBLES de un refactor de canje)

Cada fila nombra un mecanismo que la spec crea (o que ya existe, con su linea) y el oraculo que lo
distingue. Protocolo: skill `protocolo-de-verificacion` (shasum, bitacora, etiqueta, `diff`).

| # | Mecanismo | Mutacion | Oraculo que tiene que dar rojo |
|---|---|---|---|
| M1 | emision en `applyPlan` (`placement.ts`) | borrar la llamada que inserta el cupon | integracion del tick: «un `campaign_coupon` por turno activado» (CABLEADO; el unit de `couponToIssue` no lo ve) |
| M2 | `couponToIssue`: condicion `holdout` | quitar la condicion | unit «`null` para holdout» + integracion (b) |
| M3 | `loadActiveCoupon` sin mirar el turno | re-agregar `join campaign_turn … status = 'active'` | integracion (a): turno cancelado por `opt_out` y el cupon se sigue pintando |
| M4 | `FOR UPDATE` de la campaña (hoy `coupon-store.ts:184`) | quitar el `.for("update")` de la campaña | carrera «ONE slot left in the cap, two DIFFERENT coupons leave ONE row» |
| M5 | `expireTurns`: canjeado via `cc.turn_id = t.id` | cambiar el predicado a `cc.campaign_id = t.campaign_id` (join plausible y equivocado) | integracion del tick con DOS turnos vencidos de la MISMA campaña, uno solo canjeado: el otro tiene que quedar `purchase`/`none`, no `coupon_redeemed` (el caso tiene que existir; con un solo turno la mutacion da verde) |
| M6 | marcado del turno en el canje (paso 4) | borrar el `update` del turno | `counter-coupon`: «writes the row and the outcome» |

**Declarado fuera:** que el cupon sobreviva a `location_archived` y `membership_gone` se cubre con
un solo caso (`opt_out`), porque el scan no lee el turno (M3 ataca la unica forma plausible de
volver a leerlo). La UI del mostrador se cubre solo con typecheck + e2e de humo; el QA visual es del
owner.

## Handoff requerido

Un implementador para toda la spec y un revisor independiente al final (`docs/AGENT-WORKFLOW.md`,
ADR 0071). La migracion a prod la aplica el orquestador DESPUES del PASS y **ANTES del deploy**:
el codigo NUEVO sin la migracion rompe TODO escaneo del mostrador (`loadActiveCoupon` corre en cada
`resolve` y leeria una tabla que no existe). El codigo VIEJO con la migracion aplicada pierde solo lo
que lee `turn_id`: el canje (inalcanzable: 0 campañas en prod, el scan no pinta cupones) y el
`update` de `expireTurns` (`turn-lifecycle.ts:41`, `42703` en el tick de marketing hasta el deploy;
sin filas que perder). Por eso: migrar y pushear en seguida, y verificar el deploy `READY`.

## Abierto

Nada bloqueante. A confirmar por el owner al dar el OK: ADR 0093 §4 (el cupon emitido sobrevive a la
cancelacion del turno), que es consecuencia del desacople y no palabra suya.
