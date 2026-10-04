---
spec: 0153
fecha: 2026-10-04
estado: implementada
resumen: Implementa el ADR 0120 en el servidor. El escaneo trae el cupon elegido con su veredicto (valido / invalido + motivo); se borran «Validar» (M2) y el estado «validado»; la venta consume el cupon elegido y acredita los sellos/puntos extra; «Quitar» solo borra la eleccion. Contrato `0153-contratos-de-api.md`; las pantallas son de GPT.
disjunta: no
archivos: apps/merchant/src/server/counter/{coupon-state,coupon-decision,grant-coupon,coupon-discount,coupon-remove,coupon-extras,coupon-locks,coupon-store,resolve,history}.ts, borra coupon-validate.ts y app/api/counter/coupon-validate/, tests de cupones del mostrador
---

# 0153 — El sistema valida el cupon (servidor)

Nivel **N2** (dinero en la venta, saldo de sellos/puntos). Decisiones: ADR 0120 (owner, 2026-10-04). Contrato HTTP para
GPT: `docs/specs/0153-contratos-de-api.md`.

## Problema

Con la 0148 en PROD, un cupon `free_product` / `two_for_one` / `custom` / `extra_*` elegido por el cliente bloquea la
venta hasta que el comercio toca «Validar» o «Quitar» (`counter-console.tsx:160-166`, `canConfirm`). Validar crea una
fila de canje sin venta (`coupon-validate.ts`) que despues hay que atar. El owner lo declaro erroneo: el sistema tiene
que decir si el cupon vale y la venta aplicarlo sola. Ademas, hoy un cupon elegido que se vuelve invalido (vencio, ya
uso uno hoy) **desaparece en silencio** del mostrador (`coupon-state.ts:84-97`: solo `selection.status === "valid"`
llega a `selected`), cuando el owner quiere verlo en rojo con el motivo.

## Alcance

**Entra (servidor, Claude):**
- `couponState` nuevo (contrato M0/M1): `selected` con `verdict` para la eleccion de este comercio, valida o no.
- Borrar M2 (`coupon-validate.ts` y su ruta) y todo camino de «validado» (fila `order_id null`).
- M3 solo borra la eleccion.
- M4: cupon = eleccion actual; `extra_*` acredita en la venta; `coupon_not_active` se parte en
  `coupon_not_yet_valid` / `coupon_expired`.
- Migrar los tests que usaban `validateCoupon` como forma de canjear (ver Archivos).

**No entra:**
- Pantallas (GPT, spec de UI aparte sobre el contrato 0153): veredicto verde/rojo, borrar «Validar», `canConfirm`,
  agregar el producto al carrito.
- PWA (P0–P2 sin cambios). Migraciones: ninguna (no hay columna nueva; las filas de canje sin venta no existen en PROD).
- Cambiar el limite diario, el orden de locks o el calculo del descuento.

## Diseño

### Veredicto (puro)

`decideCouponVerdict(facts)` en `coupon-decision.ts`, PURO, con el orden del contrato:
`coupon_not_yet_valid` (`now < valid_from`) → `coupon_expired` (`now > valid_until`) → `already_redeemed` →
`coupon_daily_limit` (hay fila de canje de hoy de este cliente en este comercio) → `coupon_cap_reached` →
`program_changed` (solo `extra_*`, con `decideExtraGrant` de `coupon-extras.ts`). Devuelve
`{ valid: true } | { valid: false, code, message }`. Los mensajes con fecha usan `business.timezone`.

**Una sola regla para mostrar y para cobrar:** `decideCouponRedemption` pasa a ser un envoltorio de
`decideCouponVerdict` (o se reemplaza), y la venta (M4) lo usa bajo los locks. Lo que el mostrador pinta en verde es lo
que la venta acepta, salvo el carrito y la moneda.

### `couponState`

`readCounterCouponFacts` agrega: el `business.timezone`, el tope y el conteo de la campaña del cupon elegido, y (si es
`extra_*`) los hechos de `decideExtraGrant` (programa operacional, membresia). `decideCounterCouponState`:
1. la eleccion es un cupon de ESTE comercio → `selected` + `verdict` (cualquier estado E3);
2. hay fila de canje de hoy → `used_today`;
3. `hint` / `none` como hoy.

Una eleccion de OTRO comercio no se muestra (sigue a `hint` / `none`).

### M3 — Quitar

Bajo los mismos locks: si `selected_coupon_id = couponId` → limpiarla, `{ removed: "selected" }`; si no →
`409 coupon_not_removable`. Se borra la rama de la fila sin venta (y el `update` de `campaign_turn` que la acompaña).

### M4 — La venta

En `grantWithCoupon`: se borra la rama `validatedId`. Orden: locks → idempotencia → `selectedCouponOf ≠ couponId` →
`409 coupon_not_selected` → veredicto (si invalido → `409` con su `code`) → descuento (`extra_*` → 0, deja de ser
`409`) → `persistGrant` → **`grantCouponExtras`** con la membresia del cupon (como hacia validar, en la misma
transaccion, DESPUES de `persistGrant`: la tarjeta ya esta tomada por la venta; despues el programa) →
`insertCounterRedemption` con `grant` (`units_granted` / `balance_after` del extra) y `order_id` → limpiar la eleccion.
Respuesta: `order.balanceAfter` = el saldo final (el del extra si hubo), `order.coupon.extraUnits`.

`assertDailyLimit` pierde el parametro `exceptId` (era el validado propio).

### Push

Igual que hoy en la venta: `insertCounterRedemption(..., push: false)`; la orden manda el suyo. Desaparece el push de
«cupon validado».

### Arquitectura de referencia

ADR 0119 (eleccion, locks, limite diario), ADR 0120 (esta decision), ADR 0098 §6 (extras), spec 0148.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/counter/coupon-decision.ts` (+ `.test.ts`) | `decideCouponVerdict`; partir `coupon_not_active` |
| `apps/merchant/src/server/counter/coupon-state.ts` (+ `coupon-state.test.ts`) | `selected` + `verdict`, sin `validated` |
| `apps/merchant/src/server/counter/grant-coupon.ts` | sin validado; veredicto; extras |
| `apps/merchant/src/server/counter/coupon-discount.ts` (+ test) | `extra_*` → 0 |
| `apps/merchant/src/server/counter/coupon-remove.ts` | solo eleccion |
| `apps/merchant/src/server/counter/coupon-locks.ts`, `coupon-store.ts`, `coupon-extras.ts`, `resolve.ts`, `history.ts` | docblocks y firmas que nombran «validado» |
| `apps/merchant/src/server/counter/coupon-validate.ts`, `apps/merchant/src/app/api/counter/coupon-validate/` | **borrar** |
| `apps/merchant/src/app/backoffice/counter/*` | **solo borrado mecanico** de lo que deje de compilar (tipo `validated`, llamada a M2), sin UI nueva (§6 de `TRABAJO-EN-PARALELO.md`) |
| tests de integracion que llaman `validateCoupon` (`rg -l validateCoupon apps --glob '*.test.ts'`) | los que lo usan **para canjear** pasan a canjear por la venta (`grantWithCoupon`), misma propiedad; los que prueban **propiedades de validar** (validado sin venta, quitar validado, validado de ayer) se borran con la feature y se listan en el handoff |

### Disjunta?

No: comparte `counter-console.tsx` / `types.ts` con la UI de GPT (0149). Serializar: este cambio de servidor primero,
la UI de GPT encima. **No se deploya sin la UI de GPT** (sin ella, la consola no puede mostrar el veredicto).

## Definition of Done

- [ ] `rg -n 'coupon-validate|validateCoupon|"validated"' apps/merchant/src --glob '!*.test.ts'` → vacio.
- [ ] Un cupon elegido de este comercio, vencido, sale como `selected` con `verdict.code = coupon_expired` (antes:
      `hint`/`none`).
- [ ] Una venta detallada con el `free_product` elegido (producto en el carrito) responde 200 con el descuento de 1
      unidad, sin llamada previa a ningun «validar».
- [ ] Una venta con un `extra_stamps` elegido: `balanceAfter` = antes + sellos de la venta + extra; fila de canje con
      `order_id` y `units_granted` = extra.
- [ ] Venta con `couponId` que ya no es la eleccion → `409 coupon_not_selected`, sin orden ni canje.
- [ ] M3 sobre un cupon elegido vencido → 200 `removed: "selected"`.
- [ ] `pnpm verify` en verde con Node 24, con su tabla final transcripta; suites Neon de cupones con
      `tools/neon-test.sh`.

## Plan de pruebas y verificación

- Unidad `coupon-decision.test.ts`: cada `code` del veredicto y su orden (un cupon vencido y ya usado hoy → `coupon_expired`).
- Unidad `coupon-state.test.ts`: eleccion valida → verde; eleccion vencida → rojo; eleccion de otro comercio → `hint`;
  sin eleccion y canje de hoy → `used_today`.
- Integracion (`coupon-cycle.neon.integration.test.ts`, `counter-coupon-extras.neon...`): los casos de la DoD.
- Mutaciones (revisor, presupuesto 3, clase: el veredicto que se pinta y lo que la venta acepta divergen, o el extra no
  se acredita):

| Id | Mutacion | Oraculo esperado rojo |
|---|---|---|
| M1 | en `grant-coupon.ts`, borrar la guarda `selectedCouponOf(tx, consumerId) !== locked.coupon.id` (hoy `:122`) | venta con un cupon del cliente que no es su eleccion → 409 `coupon_not_selected`. Guarda hermana: ninguna (el cupon es del cliente y valido; `lockCounterCoupon` solo mira comercio + cliente) |
| M2 | en `grant-coupon.ts`, borrar la llamada nueva a `grantCouponExtras` | venta con `extra_stamps`: `balanceAfter` y `units_granted` del canje |
| M3 | en `decideCouponVerdict`, borrar el chequeo de limite diario | `coupon-state.test.ts` (rojo `coupon_daily_limit`) **y** venta: segundo cupon el mismo dia → 409. Guarda hermana en la venta: `assertDailyLimit` (`coupon-locks.ts:143`) — si sigue cableada, el rojo de la venta no mide M3: el oraculo de M3 es el de `couponState` |

## QA del owner (con la UI de GPT)

Panaderia, cupon «Cafe americano gratis» elegido: escanear → verde sin «Validar» → salir (no se consume, sigue elegido)
→ escanear de nuevo → venta detallada con el cafe agregado solo → confirmar → total con el cafe bonificado. Repetir con
el cupon vencido (`/qa-cupones-prueba`) → rojo «venció el …» → «Quitar».

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. PASS del revisor antes de `implementada`.

## Abierto

Nada que bloquee. Consecuencia de diseño, a confirmar por el owner en el QA (no la dijo): un cupon en rojo no se aplica
y la venta sale sin el; la eleccion queda hasta que el comercio la quite.

## Implementacion (2026-10-04)

`3af2aac` (rama `motor`, sin push: va junto con la UI de GPT, spec 0154). **PASS del revisor independiente.**
- `pnpm verify` verde con Node 24 (implementador y revisor); Neon de cupones con `tools/neon-test.sh`. `coupon-verdict.neon` 4/4 re-corrida por el orquestador.
- Mutaciones: M1, M2/M2b, M3 rojas (implementador); R1 (=M3) y R2 (reintento con `balanceAfter` final) rojas; **R3 sobrevive** (orden lock → `usedToday` sin oraculo de carrera; hoy correcto; pendiente en `TASKS.md`). Bitacoras en `TASKS.md`.
- **Desvio aceptado por el revisor:** `assertDailyLimit` se borro; el limite diario vive solo en el veredicto (`coupon-verdict.ts`, misma consulta para pintar y para cobrar).
- DoD: el barrido `rg` deja 2 hits de `catalog-import` (`"validated"` es el estado de una importacion, otro dominio).
- `marketing-coupon-issue.neon` sigue salteado por flags de producto: su migracion (validar → venta de 0.00) solo la cubre el typecheck.
- Hallazgos a decidir: `buildCouponBody` (`push-text.ts`) quedo sin uso en produccion; `recordRedemptionVisit` en `insertCounterRedemption` es redundante (la orden mueve el mismo `last_visit_at`); el push de la orden no menciona las unidades extra del cupon.
- Hasta la UI de GPT, un cupon no-descuento elegido bloquea la venta salvo «Quitar» (`canConfirm` es de GPT): no se deploya solo.
