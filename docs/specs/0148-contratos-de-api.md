# 0148 — Contrato de API: cupon elegido por el cliente y atado a la venta

> Para quien hace la UI (GPT). Implementa la spec 0148 / ADR 0119. Errores: `{ error, code }` y, en
> `400 validation`, `fields: { campo: mensaje }` (como `0136-contratos-de-api.md`). Montos: strings decimales
> (`"10.00"`), como en el resto del mostrador.

## El flujo, en una linea por pantalla

- **PWA (my.checkpass.club):** lista con «aca» arriba → el cliente toca un cupon → «Usar este cupon» (`P1`) → se muestra
  el QR del pase (el mismo de siempre). Tocar otro reemplaza la eleccion; «No usar» la borra (`P2`).
- **Mostrador:** escanear → `resolve` trae `couponState` → si `selected` y es descuento, la venta lo aplica; si es
  2x1/gratis/texto/extra, «Validar» (`M2`) → exito con **«Continuar con el cliente» / «Escanear otro»** → venta (`M4`)
  con el cupon atado. Mientras la pantalla del cliente esta abierta, sondear `M1` cada ~4 s (el cliente puede elegir
  despues del escaneo). «Quitar» (`M3`) en cualquier momento antes de vender.

## P0 — Lista de cupones del cliente (cambia)

`GET /api/public/consumer/coupons?lat=-2.19&lng=-79.88` — `lat`/`lng` opcionales, pero juntos (mismas reglas que C1 de
la 0136). No se guardan.

```json
{ "here": { "businessId": "…", "businessName": "Café Norte", "source": "gps" },
  "coupons": [ { "id": "…", "businessId": "…", "businessName": "Café Norte", "label": "2x1 en medialunas",
    "kind": "two_for_one", "rule": "Solo de manteca", "discountUnit": null, "discountValue": null,
    "currencyCode": "USD", "extraUnits": null, "validFrom": "…", "validUntil": "…", "status": "valid",
    "reason": null, "redeemedAt": null, "origin": "campaign", "selected": true } ] }
```

| `here.source` | Significa |
|---|---|
| `gps` | hay un local a ≤ 200 m de `lat`/`lng` |
| `last_scan` | sin GPS (o nada cerca): el ultimo comercio que escaneo al cliente |
| `here: null` | ninguno de los dos |

Orden: los `valid` del comercio de `here` primero; despues `valid`, `scheduled`, `unavailable` e historial, como hoy.
**Solo un cupon puede tener `selected: true`.** La UI agrupa por `businessId`. Solo se puede elegir un `valid`.

## P1 — Elegir un cupon

`PUT /api/public/consumer/coupon-selection` — cuerpo `{ "couponId": "…" }`

- **200** `{ "selectedCouponId": "…" }` — la eleccion anterior (si habia) queda libre. Idempotente.
- **404 `coupon_not_found`** — no es un cupon de este cliente.
- **409 `coupon_not_selectable`** — no esta `valid` (vencido, todavia no vale — p. ej. la Bienvenida «desde mañana» —,
  canjeado o comercio no disponible).
- `401 unauthenticated`, `400 validation` (`fields.couponId`).

Un cupon que el comercio ya **valido** no se toca desde aca: queda trabado hasta que el comercio lo use o lo quite.

## P2 — Dejar de usar

`DELETE /api/public/consumer/coupon-selection` → **200** `{ "selectedCouponId": null }`. Idempotente. `401`.

## M0 — `POST /api/counter/resolve` (cambia)

El campo `coupon` desaparece. En su lugar `couponState`:

```json
{ "couponState": { "status": "selected",
  "coupon": { "couponId": "…", "label": "10% en tu compra", "kind": "discount", "rule": null,
    "productId": null, "productName": null, "discountUnit": "percent", "discountValue": "10",
    "currencyCode": "USD", "extraUnits": null, "validUntil": "…" } } }
```

| `status` | Que mostrar | Trae |
|---|---|---|
| `validated` | «Cupon validado: [label]» — se aplica al vender | `coupon` |
| `used_today` | «Ya uso un cupon hoy en este comercio» | `label` |
| `selected` | el cupon que eligio el cliente | `coupon` |
| `hint` | «Este cliente tiene cupones para tu comercio, recomendale seleccionar alguno en el app de checkpass.club» | `count` |
| `none` | nada | — |

El comercio **no** puede activar cupones: no hay lista ni boton en `hint`.

## M1 — Sondeo del estado

`GET /api/counter/coupon-state?membershipId=…` → **200** `{ "couponState": … }` (la misma forma de M0).
`404 not_found` si la membresia no es de este comercio. Sondear solo mientras la pantalla del cliente esta abierta.

## M2 — Validar (2x1, producto gratis, texto, sellos/puntos extra)

`POST /api/counter/coupon-validate` — `{ "clientRequestId": "<uuid por escaneo>", "membershipId": "…",
"couponId": "…", "locationId": "…" | null }`

- **200** `{ "coupon": { "label": "2x1 en medialunas", "kind": "two_for_one", "rule": "Solo de manteca",
  "productName": "Medialuna", "unitsGranted": null, "balanceAfter": null } }` — «Oferta valida». Queda en el historial
  del dia. Para `extra_stamps`/`extra_points`, `unitsGranted`/`balanceAfter` dicen lo acreditado (y ya no se puede
  quitar). El mismo `clientRequestId` otra vez → el mismo 200.
- **409** `coupon_applies_in_sale` (es un descuento: va en la venta) · `coupon_not_selected` (el cliente no lo eligio)
  · `coupon_daily_limit` (ya uso un cupon hoy aca) · `coupon_not_active` · `already_redeemed` · `coupon_cap_reached` ·
  `not_enrolled` · `request_id_reused`.
- `404 unknown_coupon`, `401`/`403` como el resto del mostrador.

Despues del 200: **«Continuar con el cliente»** (vuelve a la pantalla del cliente; `couponState` = `validated`) o
**«Escanear otro»**.

## M3 — Quitar

`POST /api/counter/coupon-remove` — `{ "membershipId": "…", "couponId": "…" }`

- **200** `{ "removed": "validated" }` — se deshace la validacion; el cupon vuelve a estar disponible para el cliente
  (no elegido). `{ "removed": "selected" }` — se borra la eleccion del cliente.
- **409 `coupon_not_removable`** — ya se uso en una venta, es de otro dia, o es de sellos/puntos extra.

Para sacar un descuento de una venta en curso: llamar M3 y no mandar `coupon` en M4.

## M4 — La venta con cupon

`POST /api/counter/grant` — el cuerpo de hoy + `"coupon": { "couponId": "…", "productId": "…" | null }` (opcional).

- `couponId`: el de `couponState` (`selected` o `validated`).
- `productId`: **solo** si el cupon es `free_product`/`two_for_one` **sin** producto propio (`coupon.productId` null) y la
  venta es `detailed`: el producto del carrito al que se aplica.

Como calcula el servidor (la UI puede previsualizar con la misma regla; el servidor manda):

| Cupon | `detailed` | `quick` |
|---|---|---|
| `discount` `percent` | `total × valor / 100`, redondeo a centavos half-up | igual sobre el monto |
| `discount` `amount` | `min(valor, total)` → nunca negativo | igual |
| `free_product` | precio de **1** unidad de la linea | 0 (el comercio pone el monto; la UI pone el label como nota) |
| `two_for_one` | precio de **1** unidad; la linea necesita cantidad ≥ 2 | 0 (idem) |
| `custom` | 0 | 0 |

Puntos/sellos sobre el **neto**.

- **200** `{ "order": { "unitsGranted": 1, "balanceAfter": 7, "kind": "stamps", "total": "10.00",
  "grossTotal": "20.00", "coupon": { "label": "50% en tu compra", "discountAmount": "10.00" } } }` — sin `coupon`,
  `order.coupon` es `null` y `total = grossTotal`.
- **409** `coupon_not_selected` · `coupon_daily_limit` · `coupon_product_missing` (el producto no esta en el carrito) ·
  `coupon_quantity` (2x1 con 1 unidad) · `coupon_currency_mismatch` · `coupon_not_active` · `coupon_cap_reached`.

## Historial del dia

Cada entrada suma `entryKind: "coupon"` (ademas de `accrual` y `redemption`), con `rewardLabel` = el label del cupon.

## Lo que se borra

`POST /api/counter/coupon-redeem` deja de existir, junto con el banner «Cupón» / «Canjear cupón» y la pantalla
«Entrega» de la consola.
