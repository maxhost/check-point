---
adr: 0130
fecha: 2026-10-08
estado: aceptada
resumen: El POS guarda la orden abierta de una mesa en una tabla propia (`core.pos_order` + `core.pos_order_item`, precio fijo al agregar) y NO en `core.order`, que sigue siendo el registro inmutable de cada acreditacion; cerrar con pase ejecuta la MISMA acreditacion del mostrador (con cupon) dentro de una transaccion que bloquea primero la orden del POS y la enlaza a la `core.order` creada; cerrar sin pase no acredita. Modulo por comercio (`business.pos_enabled`, apagado por defecto, no se apaga con ordenes abiertas) y permiso nuevo `pos`.
---

# 0130 — POS: la orden abierta vive aparte de la acreditacion

## Contexto

El owner, 2026-10-08, pide un modulo **POS** separado del mostrador: abrir una orden para una mesa (nombre libre),
cargar productos del catalogo, guardarla abierta, editarla, imprimirla y, al cobrar, escanear (o no) el pase del
cliente para aplicar su cupon y acreditar «como se hace en mostrador». Sus respuestas, textuales o resumidas en la
spec 0169 §Decisiones del owner.

`core.order` (spec 0030) no sirve para eso: es **append-only** (una fila = una acreditacion, nunca se muta), exige
`membership_id`/`consumer_id`/`program_id` `NOT NULL` y nace en el mismo `INSERT` que sube el saldo
(`counter/orders.ts`, `persistGrant`). Una orden abierta no tiene cliente, cambia y puede no acreditar nunca.

## Decision

1. **Tabla propia.** `core.pos_order` (estado `open | closed | voided`, local, nombre de mesa, `version`, quien la
   abrio/cerro, `order_id` → `core.order` cuando se cerro con pase) y `core.pos_order_item` (snapshot de nombre y
   precio). `core.order` y su semantica **no se tocan**.
2. **Precio fijo al agregar** (owner: «si, correcto queda fijo»). La linea copia nombre y precio del catalogo al
   entrar a la orden; editar la orden conserva el snapshot de las lineas existentes. Lo impreso es lo cobrado.
3. **Cerrar con pase = la acreditacion del mostrador**, no una copia: la misma decision de cupon (`grant-coupon.ts`:
   veredicto, descuento, unidades sobre el neto, extras, `coupon_redemption`), el mismo `persistGrant` y el mismo
   `afterGrant`. Lo unico distinto es de donde salen las lineas: de los snapshots de la orden del POS, no de
   `buildDetailed`. Corre en **una** transaccion que bloquea primero la `pos_order` (`FOR UPDATE`) y despues, en el
   orden ya declarado de `coupon-locks.ts`, campaña → cupon → `business_customer`. Orden de bloqueo nuevo y unico:
   **pos_order → campaign → campaign_coupon → business_customer**.
4. **Cerrar sin pase** marca la orden `closed` sin `order_id`: no hay cliente, no hay saldo, no hay visita.
5. **Modulo por comercio**: `core.business.pos_enabled boolean not null default false`. Apagado = las rutas del POS
   contestan 403 `pos_disabled` y el permiso `pos` no se puede dar. **No se apaga con ordenes abiertas** (owner):
   409 `pos_has_open_orders`. Encender/apagar y crear una orden se serializan sobre la fila de `core.business`.
6. **Permiso `pos`** en el catalogo de `permissions-catalog.ts` (pasan a ocho) y en el `CHECK` de contencion. El owner
   no lo necesita (ADR 0079 §4) pero si necesita el modulo encendido.

## Consecuencias

- Una venta del POS cerrada con pase es una `core.order` mas: aparece en «Movimientos de hoy» del mostrador, en el
  cliente, en sus atajos de compra y en la venta cruzada, sin codigo nuevo (owner: «me parece perfecto»).
- Las ventas cerradas sin pase existen solo en `core.pos_order`: ninguna estadistica actual las ve.
- `grant-coupon.ts` deja de abrir su propia transaccion para poder correr dentro de la del cierre (refactor sin
  cambio de comportamiento del mostrador; sus suites lo pinnean).
- El mostrador queda igual.
