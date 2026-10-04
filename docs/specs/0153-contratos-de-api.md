# 0153 — Contrato de API: el sistema valida el cupon (delta sobre `0148-contratos-de-api.md`)

> Lo que no se nombra aca queda como en `0148-contratos-de-api.md` (P0–P2 de la PWA sin cambios). Errores y montos con
> las mismas convenciones: las rutas del mostrador responden la entrada invalida con `422 invalid_input`.

## El flujo, en una linea por pantalla

- **Mostrador:** escanear → `resolve` trae `couponState` → si `selected`, la pantalla de venta (detallada o rapida)
  muestra el cupon con ✓ verde (`verdict.valid: true`) o ✗ rojo con `verdict.message`. «Quitar» (`M3`) siempre visible
  sobre el cupon elegido. Confirmar la venta con un cupon verde lo manda en `M4` y lo consume; con uno rojo la venta sale
  sin `coupon`. Escanear y salir no consume nada. **No hay boton «Validar».** Sondeo `M1` cada ~4 s como hoy.
- **Venta detallada con `free_product` / `two_for_one` que traen `productId`:** al pintar un cupon verde, la UI agrega
  la linea de ese producto al carrito (1 unidad para `free_product`, 2 para `two_for_one`), una sola vez por escaneo;
  el comercio puede cambiar la cantidad o borrar la linea (si la borra, `M4` responde `409 coupon_product_missing`).
  Sin `productId` en el cupon: el comercio elige el producto, como hoy.

## M0 / M1 — `couponState` (cambia)

| `status` | Cuando (el primero que aplique) | Trae |
|---|---|---|
| `selected` | la eleccion del cliente es un cupon de ESTE comercio, **valido o no** | `coupon`, `verdict` |
| `used_today` | sin eleccion de este comercio, y ya hay un canje de hoy aca | `label` |
| `hint` | el cliente tiene ≥ 1 cupon valido de este comercio | `count` |
| `none` | nada de lo anterior | — |

**`validated` desaparece.**

```json
{ "couponState": { "status": "selected",
  "coupon": { "couponId": "…", "label": "Cafe americano gratis", "kind": "free_product", "rule": null,
    "productId": "…", "productName": "Cafe americano", "discountUnit": null, "discountValue": null,
    "currencyCode": null, "extraUnits": null, "validUntil": "…" },
  "verdict": { "valid": true } } }
```

```json
"verdict": { "valid": false, "code": "coupon_expired", "message": "Este cupón venció el 03/11/2026." }
```

| `verdict.code` | `message` (fecha `dd/mm/aaaa` en la zona horaria del comercio) |
|---|---|
| `coupon_not_yet_valid` | «Este cupón vale desde el [fecha].» |
| `coupon_expired` | «Este cupón venció el [fecha].» |
| `already_redeemed` | «Este cupón ya fue canjeado.» |
| `coupon_daily_limit` | «El cliente ya usó un cupón hoy en este comercio.» |
| `coupon_cap_reached` | «Se agotaron los cupones de esta campaña.» |
| `program_changed` | «El programa de fidelidad cambió: este cupón ya no se puede canjear.» (solo `extra_*`) |

Si aplican varios, va el primero de la tabla. El veredicto NO mira el carrito (producto faltante, cantidad, moneda):
eso lo dice `M4`.

## M2 — Validar: SE BORRA

`POST /api/counter/coupon-validate` deja de existir (404).

## M3 — Quitar (cambia)

`POST /api/counter/coupon-remove` — `{ "membershipId": "…", "couponId": "…" }`

- **200** `{ "removed": "selected" }` — se borra la eleccion del cliente, sea el cupon valido o no. El cupon vuelve a
  la lista del cliente segun su propia vigencia.
- **409 `coupon_not_removable`** — el cupon no es la eleccion actual del cliente. `409 not_enrolled`.
- `404 unknown_coupon` · `404 not_found` como hoy. **`removed: "validated"` desaparece.**

## M4 — La venta con cupon (cambia)

`POST /api/counter/grant` — mismo cuerpo. `coupon.couponId` tiene que ser **la eleccion actual** del cliente (si no,
`409 coupon_not_selected`: el cliente cambio de cupon; la UI vuelve a pedir `M1`).

- Los rechazos del veredicto llegan con el mismo `code`: `coupon_not_yet_valid`, `coupon_expired`, `already_redeemed`,
  `coupon_daily_limit`, `coupon_cap_reached`, `program_changed`. **`coupon_not_active` desaparece** (se parte en los dos
  primeros). Mas los de la venta: `coupon_product_missing`, `coupon_quantity`, `coupon_currency_mismatch`.
- **`extra_stamps` / `extra_points`:** descuento 0; los sellos/puntos del cupon se suman a los de la venta.

```json
{ "order": { "unitsGranted": 1, "balanceAfter": 9, "kind": "stamps", "total": "10.00", "grossTotal": "10.00",
  "coupon": { "label": "2 sellos extra", "discountAmount": "0.00", "extraUnits": 2 } } }
```

`order.unitsGranted` = lo de la venta; `order.coupon.extraUnits` = lo del cupon (`null` si no es `extra_*`);
`order.balanceAfter` = el saldo final, con los dos.

## Historial del dia

Sin cambios de forma. Toda entrada `coupon` tiene venta.
