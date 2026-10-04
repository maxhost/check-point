---
spec: 0148
fecha: 2026-10-03
estado: cerrada
resumen: Implementa el ADR 0119 (servidor + contrato; pantallas = GPT). El cliente elige UN cupon en la PWA (`consumer_account.selected_coupon_id`), la lista viene con «aca» por GPS ≤ 200 m o por el ultimo comercio que lo escaneo (`business_customer.last_scan_at`); el mostrador lee el estado del cupon (`selected`/`validated`/`used_today`/`hint`/`none`) al escanear y por sondeo; valida 2x1/gratis/texto/extra (fila de canje SIN venta), lo quita (borra la fila, vuelve a disponible), y la venta lo ata (`coupon_redemption.order_id`, `discount_amount`) con total y puntos sobre el NETO. Un cupon por cliente + comercio + dia local, bajo lock. Validado sin venta de un dia anterior = consumido, sin cron. Migracion 0064.
disjunta: no
archivos: packages/db/src/schema/{consumer,business-customer,campaign-turn}.ts, packages/db/drizzle/0064_*.sql, packages/domain/src/server/consumer/{coupons,coupon-selection,coupon-here}.ts, apps/consumer/src/app/api/public/consumer/{coupons,coupon-selection}/route.ts, apps/merchant/src/server/counter/{coupon-*,grant,orders,resolve,history}.ts, apps/merchant/src/app/api/counter/{coupon-validate,coupon-remove,coupon-state,coupon-redeem,grant}/route.ts, apps/merchant/src/app/backoffice/counter/* (solo borrado mecanico)
---

# 0148 — Cupon elegido por el cliente y atado a la venta

> Implementa el **ADR 0119** (leerlo primero: ahi estan las 16 decisiones del owner con sus palabras). Contrato HTTP:
> `specs/0148-contratos-de-api.md`. Pantallas: zona de GPT (ADR 0114) — esta spec entrega servidor, API y contrato.

## Problema

Medido en el arbol el 2026-10-03:

- `apps/merchant/src/server/counter/coupon-scan.ts` `loadActiveCoupon` devuelve **un** cupon, `order by valid_until asc
  limit 1`: el que vence primero, no el que el cliente quiere.
- `coupon-store.ts` `persistCouponRedemption` canjea en una transaccion propia, **sin monto ni venta**; `coupon_redemption`
  no tiene ninguna columna que apunte a `core.order`.
- `counter-console.tsx` `confirmCoupon` → `setStage("done")`: el canje **termina la atencion**.
- `history.ts` (historial del dia) une `order` y `reward_redemption`; **los canjes de cupon no aparecen**.
- `grant.ts` calcula `computeAccrual(accrual, Number(total))` sobre el total cargado: no existe descuento.
- La PWA (`listConsumerCoupons`) lista los cupones de **todos** los comercios, sin «donde estoy», y no hay forma de
  elegir uno: el boton «Mostrar mi pase para canjear» solo cambia de pestaña.
- El escaneo (`resolveScan`) **no escribe nada** salvo la auto-inscripcion: no hay registro de «donde lo escanearon».

## Alcance

**Entra:**
1. Eleccion del cliente: `PUT`/`DELETE /api/public/consumer/coupon-selection` y `selected` + `here` en la lista.
2. Registro del escaneo (`business_customer.last_scan_at`) y calculo de «aca» (GPS ≤ 200 m, si no ultimo escaneo).
3. Estado del cupon en el mostrador: en `resolve` y en `GET /api/counter/coupon-state` (sondeo).
4. Validar (`POST /api/counter/coupon-validate`) y quitar (`POST /api/counter/coupon-remove`).
5. La venta (`POST /api/counter/grant`) con `coupon`: descuento, total neto, puntos/sellos sobre el neto, canje atado.
6. Limite: un cupon por cliente + comercio + dia local del comercio.
7. Historial del dia del mostrador con los cupones.
8. Borrado del canje viejo: `coupon-redeem` (ruta + `server/counter/coupon.ts`) y su uso en la consola (mecanico).

**No entra:**
- Las pantallas nuevas (mostrador y PWA): GPT, contra el contrato. Hasta que lleguen, **el mostrador no muestra cupones**
  (aceptado implicitamente por «no sirve»; se informa al owner).
- Marca «combinable» por cupon (ADR 0119 §14: no se construye ahora).
- Push nuevo al quitar un cupon o al consumirlo en la venta (la venta ya manda su push transaccional).
- Cambiar la Wallet: el QR del pase sigue siendo el mismo.
- Cron de cierre del dia: **no hace falta** (ver «Cierre del dia»). Declarado contra la expectativa del owner (ADR §11).

## Diseño

### Modelo de datos (migracion `0064_cupon_elegido_y_atado_a_la_venta.sql`, a mano como la 0060–0063)

| Tabla | Cambio | Por que |
|---|---|---|
| `consumer.consumer_account` | `selected_coupon_id uuid null references core.campaign_coupon(id) on delete set null`, `coupon_selected_at timestamptz null`; check: los dos nulos o los dos no nulos | UNA eleccion global por cliente (ADR §1, §4) |
| `core.business_customer` | `last_scan_at timestamptz null` | «el comercio donde lo escanearon» (ADR §2) |
| `core.coupon_redemption` | `order_id uuid null references core."order"(id)`, `discount_amount numeric(12,2) null` con check `discount_amount is null or discount_amount >= 0`, check `discount_amount is null or order_id is not null`; unique parcial `(order_id) where order_id is not null` | el canje atado a la venta y cuanto bonifico (ADR §7) |
| `core.coupon_redemption` | indice `(business_id, consumer_id, created_at)` | el limite diario se lee por cliente + comercio |

Grants: ninguno nuevo. `checkpass_consumer` ya tiene `UPDATE` sobre `consumer.consumer_account` y `SELECT` sobre
`core.business_customer`, `core.location`, `core.coupon_redemption` (`0060_*.sql` lineas 24, 38, 49, 50).

### Estados (derivados, ninguno guardado como enum)

Sobre un cupon `c` de un cliente en el comercio `B`, con `hoy` = dia local de `B` (`business.timezone`, la misma nocion
que `onBusinessDay` en `history.ts:79`):

| Estado | Condicion |
|---|---|
| disponible | sin fila de canje y no es la eleccion del cliente |
| elegido | `consumer_account.selected_coupon_id = c.id` y sin fila de canje |
| validado | fila de canje con `order_id is null`, creada `hoy`, `kind` no `extra_*` |
| consumido | fila de canje con `order_id` no nulo, **o** `kind` `extra_*`, **o** creada antes de `hoy` |

**Cierre del dia sin cron:** un validado de ayer cae solo en «consumido» porque la condicion mira el dia; la fila ya
existe (es el «canjeado sin venta registrada» del ADR §11: `order_id is null` y dia anterior). Nadie la borra ni la
mueve. Por eso no hay barrido.

### Limite diario y locks

Un cupon por cliente + comercio + dia: **existe una fila de `coupon_redemption` de `(business_id, consumer_id)` creada
`hoy`** → `409 coupon_daily_limit`. Los canjes de premio del programa (`reward_redemption`) **no cuentan** (ADR §15).

Toda escritura del mostrador sobre cupones toma los locks en ESTE orden, siempre: `campaign` `FOR UPDATE` →
`campaign_coupon` `FOR UPDATE` → `core.business_customer (business_id, consumer_id)` `FOR UPDATE`. El tercero es el que
serializa dos cupones **distintos** del mismo cliente el mismo dia (el par campaign/coupon no los ve). Sin fila de
`business_customer` → `409 not_enrolled` (el escaneo la crea al auto-inscribir).

### Eleccion del cliente (PWA)

`packages/domain/src/server/consumer/coupon-selection.ts`:
- `selectCoupon(consumerId, couponId, now)`: el cupon es **del cliente** (`consumer_id`, si no `404 coupon_not_found`,
  nunca 403) y su estado E3 es `valid` (si no `409 coupon_not_selectable`). Escribe `selected_coupon_id` y
  `coupon_selected_at = now` (reemplaza la anterior: la anterior vuelve a disponible, ADR §4). Idempotente.
- `clearCouponSelection(consumerId)`: pone los dos en `null`. Idempotente.
- Un cupon ya **validado** no se ve afectado por nada de esto: su estado vive en la fila de canje (ADR §9, trabado).

`listConsumerCoupons(consumerId, gps, now)` suma a cada cupon `selected: boolean` y a la respuesta
`here: { businessId, businessName, source: "gps" | "last_scan" } | null` (`coupon-here.ts`):
1. con GPS: el local `active` con coordenadas mas cercano a ≤ **200 m** (`HERE_RADIUS_METERS`, constante exportada),
   de cualquier comercio; distancia haversine como en las cruzadas;
2. sin GPS o sin local a ≤ 200 m: el comercio con `business_customer.last_scan_at` mas reciente del cliente (sin tope de
   antiguedad: solo ordena);
3. ninguno → `null`.
Orden de `coupons`: los `valid` de `here` primero; despues el orden de hoy (`valid`, `scheduled`, `unavailable`,
historial). La forma de cada cupon no cambia salvo `selected`.

### Mostrador

`resolveScan` escribe `last_scan_at = now()` en la fila de `business_customer` (despues de `resolveMembership`, que la
garantiza) y reemplaza `coupon: ActiveCoupon | null` por `couponState` (`counter/coupon-state.ts`):

| `couponState.status` | Cuando (primero que aplique) | Trae |
|---|---|---|
| `validated` | hay fila de canje de hoy en `B` con `order_id null` y kind no `extra_*` | `coupon` |
| `used_today` | hay cualquier otra fila de canje de hoy en `B` | `label` |
| `selected` | `selected_coupon_id` es un cupon de `B` en estado E3 `valid` | `coupon` |
| `hint` | el cliente tiene ≥ 1 cupon `valid` de `B` | `count` |
| `none` | nada de lo anterior | — |

La decision es **pura** (`decideCounterCouponState(facts)`), la lectura de hechos va aparte. `coupon` = `{ couponId,
label, kind, rule, productId, productName, discountUnit, discountValue, currencyCode, extraUnits, validUntil }`.
`GET /api/counter/coupon-state?membershipId=` devuelve lo mismo (el sondeo del ADR §2).

**Validar** — `POST /api/counter/coupon-validate` `{ clientRequestId, membershipId, couponId, locationId }`
(`counter/coupon-validate.ts`, reemplaza a `coupon.ts`/`persistCouponRedemption`):
1. cupon del comercio (si no `404 unknown_coupon`) y de ese cliente (`membership.consumer_id`, si no `404`);
2. locks en el orden declarado; idempotencia por `(business_id, client_request_id)` **bajo el lock y antes de toda guarda**
   (como hoy, `coupon-store.ts` paso 2);
3. `kind = 'discount'` → `409 coupon_applies_in_sale` (se aplica en la venta, ADR §6);
4. tiene que estar **elegido** por el cliente (`selected_coupon_id = couponId`) → si no `409 coupon_not_selected`
   (el comercio no activa cupones, ADR §3);
5. `decideCouponRedemption` actual (vigencia, ya canjeado, tope) + limite diario;
6. inserta la fila (`order_id null`), `recordRedemptionVisit`, outcome del turno, push transaccional — como hoy; si es
   `extra_*`, `grantCouponExtras` como hoy (y queda consumido: no se puede quitar);
7. limpia `selected_coupon_id` del cliente si apunta a este cupon.
Respuesta: `{ coupon: { label, kind, rule, productName, unitsGranted, balanceAfter } }`.

**Quitar** — `POST /api/counter/coupon-remove` `{ membershipId, couponId }` (`counter/coupon-remove.ts`):
- si esta **validado** (fila de hoy, `order_id null`, kind no `extra_*`): bajo los mismos locks, pone `null` el
  `outcome_redemption_id`/`outcome`/`outcome_at` del turno que la apunte y **borra la fila** (vuelve a disponible; libera
  el tope de la campaña y el limite del dia);
- si esta **elegido**: limpia la eleccion;
- en los dos casos, limpia la eleccion si apunta a el. Respuesta `200 { removed: "validated" | "selected" }`.
- cualquier otro estado (consumido, de otro dia, `extra_*`, atado a una venta, no elegido) → `409 coupon_not_removable`.

**La venta** — `POST /api/counter/grant` acepta `coupon?: { couponId, productId? }`:
1. sin `coupon`: **exactamente como hoy** (un solo statement, `persistGrant`).
2. con `coupon`: transaccion interactiva. Locks en orden; idempotencia: si ya hay `order` con ese `clientRequestId` →
   devolverla (sin re-decidir). El cupon tiene que estar **elegido** o **validado hoy en `B`** (si no `409
   coupon_not_selected`); limite diario salvo que sea el propio validado; vigencia/tope via `decideCouponRedemption` si
   no estaba validado.
3. descuento — pura, `decideCouponDiscount({ kind, discountUnit, discountValue, currencyCode, businessCurrency, mode,
   items, totalCents, productId })` en centavos:
   - `discount` `percent`: `round(totalCents * value / 100)` (half-up). `amount`: `min(valueCents, totalCents)` (ADR §13:
     se cobra 0, el resto se pierde); moneda distinta a la del comercio → `409 coupon_currency_mismatch`.
   - `free_product` / `two_for_one`, `mode = detailed`: la linea es la del `productId` del cupon si lo tiene, si no la
     del `productId` del pedido (`coupon.productId`, ADR §7). Sin linea → `409 coupon_product_missing`; `two_for_one`
     con `quantity < 2` → `409 coupon_quantity`. Descuento = `unitPrice` de **una** unidad.
   - `free_product` / `two_for_one` en `quick`, y `custom` en cualquier modo: descuento **0** (el valor lo pone el
     comercio, ADR §8; el texto como nota lo pone la UI).
   - `extra_*`: no entra a la venta (ya consumido al validar) → `409 coupon_not_selected`.
4. `total` de la orden = **neto** (`total − descuento`); `units = computeAccrual(accrual, neto)` (ADR §12).
5. `persistGrant(input, executor)` corre **dentro** de la transaccion (se le agrega el ejecutor; sin `coupon` sigue con
   `getDb()`); despues: si estaba validado, `UPDATE coupon_redemption set order_id, discount_amount`; si estaba elegido,
   `INSERT` con `order_id`, `discount_amount`, visita y outcome; limpia la eleccion.
6. respuesta: la de hoy + `order.total` (neto), `order.grossTotal`, `order.coupon: { label, discountAmount } | null`.

**Historial del dia** (`history.ts`): suma las filas de `coupon_redemption` del dia con `entryKind: "coupon"`,
`rewardLabel` = `label_snapshot`, `unitsGranted` = `units_granted ?? 0`.

**Borrado:** `apps/merchant/src/app/api/counter/coupon-redeem/route.ts`, `server/counter/coupon.ts`,
`coupon-scan.ts` (`loadActiveCoupon`) y `persistCouponRedemption` (lo que no reuse `coupon-validate.ts`). En la consola,
borrado **mecanico** de lo que dejaria de compilar (`confirmCoupon`, `CouponBanner`, `CouponDone`, `postCouponRedeem`,
`CounterCoupon`, `CouponRedeemResponse`, el campo `coupon` del tipo de `resolve`): sin UI nueva (§6 de
`TRABAJO-EN-PARALELO.md`).

### Arquitectura de referencia

ADR 0119 (decisiones), 0094 (vigencia hasta fin de campaña), 0098/0106 (premio estructurado, `coupon-extras.ts`), 0104
(cupon cruzado sin membresia), 0054/0056 (idempotencia de la venta), 0037 (push transaccional), 0110 (rol del cliente),
0114 (zonas), 0070 §17 (borrar UI vieja).

## Archivos

| Archivo | Accion |
|---|---|
| `packages/db/src/schema/consumer.ts`, `business-customer.ts`, `campaign-turn.ts` (coupon_redemption) | editar |
| `packages/db/drizzle/0064_cupon_elegido_y_atado_a_la_venta.sql` + `meta/_journal.json` | crear / editar |
| `packages/domain/src/server/consumer/coupon-selection.ts`, `coupon-here.ts` | crear |
| `packages/domain/src/server/consumer/coupons.ts` | editar (`selected`, `here`, orden) |
| `apps/consumer/src/app/api/public/consumer/coupon-selection/route.ts` | crear |
| `apps/consumer/src/app/api/public/consumer/coupons/route.ts` | editar (`lat`/`lng`) |
| `apps/merchant/src/server/counter/coupon-state.ts`, `coupon-validate.ts`, `coupon-remove.ts`, `coupon-discount.ts` | crear |
| `apps/merchant/src/server/counter/coupon-store.ts`, `coupon-decision.ts`, `grant.ts`, `orders.ts`, `resolve.ts`, `history.ts` | editar |
| `apps/merchant/src/server/counter/coupon.ts`, `coupon-scan.ts`, `apps/merchant/src/app/api/counter/coupon-redeem/route.ts` | borrar |
| `apps/merchant/src/app/api/counter/coupon-validate/route.ts`, `coupon-remove/route.ts`, `coupon-state/route.ts` | crear |
| `apps/merchant/src/server/counter.ts` (barrel) | editar |
| `apps/merchant/src/app/backoffice/counter/{counter-console,stages,coupon-panel,types}.tsx/ts` | borrado mecanico |
| tests nuevos (ver plan) | crear |

### Disjunta?

**No.** Toca `grant.ts`/`orders.ts` (0143 ya en `main`, cerrada) y la consola del mostrador (zona GPT: solo borrado
mecanico). Serializar con cualquier spec abierta de mostrador; hoy no hay otra abierta de Claude.

### Archivos compartidos

Ninguno a preparar: el implementador hace la migracion primero y todo lo demas la consume.

## Definition of Done

- [ ] Migracion 0064 aplicada en una rama Neon efimera con `tools/neon-test.sh` (NUNCA contra `DATABASE_URL`); a PROD
      solo con OK del owner, despues del PASS.
- [ ] Cliente elige → el mostrador al escanear ve `selected` con ese cupon; elige otro → el anterior vuelve a disponible.
- [ ] Cliente elige DESPUES del escaneo → `coupon-state` pasa de `hint` a `selected` sin re-escanear.
- [ ] 2x1 elegido → validar → `validated`; venta detallada con 2 del producto → orden con `total` neto, la
      fila de canje con `order_id` y `discount_amount` = precio de una unidad, units sobre el neto.
- [ ] Descuento 50 % sobre 20 → `order.total = 10`, units = `computeAccrual(accrual, 10)` (ADR §12, el ejemplo del owner).
- [ ] Monto fijo 15 sobre 10 → `order.total = 0`.
- [ ] Segundo cupon del mismo cliente en el mismo comercio y dia local → `409 coupon_daily_limit`; al dia local
      siguiente, permitido. Un canje de premio del programa no lo bloquea.
- [ ] Quitar un validado → la fila desaparece, el turno sin outcome, el cupon vuelve a `valid` en E3 y no elegido.
- [ ] Quitar uno atado a venta, de ayer o `extra_*` → `409 coupon_not_removable`.
- [ ] Validado ayer sin venta → hoy `couponState` no lo muestra como validado, el cupon figura `redeemed` en E3, sin cron.
- [ ] El comercio no puede validar ni vender con un cupon que el cliente no eligio (`409 coupon_not_selected`).
- [ ] Ruta de seleccion: otro cliente no puede elegir mi cupon (404); sin sesion 401.
- [ ] Historial del dia con los cupones.
- [ ] `rg -n "coupon-redeem|loadActiveCoupon|persistCouponRedemption|postCouponRedeem" apps packages` → vacio.
- [ ] `pnpm verify` en verde con Node 24 (ADR 0113), tabla final transcripta; Neon de las suites tocadas.

## Plan de pruebas y verificación

**Presupuesto (ADR 0062): 10 mutaciones, clase de error = los PLAUSIBLES** (un guard que un refactor borra, el total
bruto en vez del neto, UTC en vez del dia local, un `min` olvidado, un scope de cliente que se cae). Fuera y declarado:
carreras de mas de dos escritores, el sondeo bajo carga, la precision del GPS. **Y el `FOR UPDATE` de
`business_customer` queda SIN mutacion, declarado:** la unica carrera que protege (dos cupones distintos del mismo
cliente el mismo dia) exige que el cliente cambie su eleccion entre dos validaciones concurrentes, y la guarda de
eleccion es un hermano que corta igual en cualquier carrera deterministica que se pueda armar. Se verifica por lectura
(el revisor señala la linea) y no por un rojo.

**Unidad** (`apps/merchant/src/server/counter/*.test.ts`, `packages/domain` no: los tests de dominio van bajo
`apps/*` o `tools` porque `vitest.config.ts` solo corre esos proyectos):
- `coupon-discount.test.ts`: percent half-up; amount con tope (15 sobre 10 → 10); moneda distinta → 409; 2x1 sin linea /
  con 1 unidad → 409; 2x1 con producto del cupon vs del pedido; quick → 0; custom → 0.
- `coupon-state.test.ts`: tabla de la decision pura, un caso por fila + el orden (validated gana a selected; seleccion de
  otro comercio → hint/none).

**Integracion Neon** (`*.neon.integration.test.ts` bajo `apps/merchant/src/server/counter/` y
`apps/consumer/src/server/`), seed con la forma de PRODUCCION (cliente con membresia, `business_customer` creada por
el escaneo, cupon emitido por la Bienvenida):
- ciclo completo elegir → escanear → validar → vender (detailed) → orden y canje atados;
- descuento en quick y detailed; limite diario con `business.timezone = 'America/Guayaquil'` y un canje a las 23:30 local
  de ayer (04:30 UTC de hoy) → hoy permitido;
- quitar validado / elegido / no quitable;
- idempotencia: el mismo `clientRequestId` de una venta con cupon dos veces → una orden, un canje, sin doble puntos;
- seleccion de un cupon de Bienvenida `scheduled` («desde mañana») → `409 coupon_not_selectable`;
- aislamiento: `coupon-selection` con un cupon de otro cliente → 404; `coupon-state`/`validate` con `membershipId` de
  otro comercio → 404.

**Tabla de mutaciones** (cada una etiquetada `MUTATION`, `shasum` limpio antes, revertir con `diff`; la fila se EJECUTA
y se transcribe):

| Id | Mutacion | Oraculo que debe ponerse rojo | Guard hermano a puentear |
|---|---|---|---|
| M1 | `computeAccrual(accrual, bruto)` en vez del neto (`grant.ts`) | integracion «50 % sobre 20 → units sobre 10» | ninguno |
| M2 | borrar el chequeo del limite diario en `coupon-validate.ts` | integracion «segundo cupon mismo dia → 409» | el `unique (coupon_id)`: el caso usa DOS cupones distintos |
| M3 | el dia del limite en UTC (sin `AT TIME ZONE business.timezone`) | integracion Guayaquil 23:30 local de ayer | ninguno |
| M4 | `amount` sin `min` contra el total (`coupon-discount.ts`) | unidad «15 sobre 10 → 10» | `core_order_total_check`: el test es de la funcion pura, no llega a la base |
| M5 | quitar sin exigir `order_id is null` | integracion «quitar despues de vender → 409» | ninguno |
| M6 | `decideCounterCouponState` sin filtrar el comercio de la seleccion | unidad «seleccion de otro comercio → hint/none» | ninguno |
| M7 | `selectCoupon` sin el scope `consumer_id` | integracion de ruta «cupon de otro cliente → 404» | ninguno |
| M8 | la venta acepta un cupon no elegido (borrar el paso 2 de «La venta») | integracion «cupon no elegido → 409» | ninguno |
| M9 | `selectCoupon` acepta `scheduled` (mira solo `valid_until`) | integracion «Bienvenida desde mañana → 409 coupon_not_selectable» | la vigencia de `decideCouponRedemption`: el caso es de la ruta de seleccion, no llega a validar |
| M10 | cableado: `grant` ignora `raw.coupon` (borrar la llamada) | integracion ciclo completo (`order_id` atado) | ninguno |

Verificacion manual (QA del owner, despues del deploy y de la UI de GPT): ver «QA» abajo.

**Comandos:** `pnpm verify`; `tools/neon-test.sh <archivo>` por cada suite Neon nueva o tocada; mutaciones con
`pnpm --filter @mi-pasaporte/merchant exec vitest run <path>`.

## QA del owner (cuando este la UI)

1. En la PWA, parado en el comercio A (o despues de que A te escanee): «aca» es A; elegir un 2x1.
2. En el mostrador de A: escanear → «Oferta valida» → continuar con el cliente → cargar 2 del producto → el ticket
   muestra 1 bonificada y el total con descuento; puntos/sellos sobre ese total.
3. Elegir un 10 % y en el mismo dia intentar usarlo en A → «ya uso un cupon hoy».
4. Quitar un cupon validado → vuelve a aparecer en la PWA como disponible.

## Handoff requerido

Implementador y revisor con el formato de `docs/AGENT-WORKFLOW.md`. PASS del revisor antes de marcar `implementada`.
Al cerrar: avisar a GPT (contrato 0148) y al owner que el mostrador queda sin cupones hasta la UI nueva.

## Abierto

Nada que bloquee. Declarado para el owner (no son decisiones suyas, son consecuencias de diseño):
- Sin cron: el validado sin venta se consume por fecha, no por un barrido.
- `extra_*` se consume al validar y no se puede quitar (el credito ya se hizo).
- Sellos «por compra» (`per_purchase`) dan su sello aunque el neto sea 0.
- Quitar un cupon no manda push; el push de la validacion ya salio.
