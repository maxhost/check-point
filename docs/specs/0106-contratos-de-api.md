# 0106 — Contrato de API: premio estructurado de campaña

> Contrato para quien hace la UI (GPT), por entrega. Implementa la spec 0106 / ADR 0098. Rutas
> relativas a `apps/merchant/src/`. Convenciones y formas de error: las de `0101-contratos-de-api.md`
> (marketing) y, para el mostrador, `{ error, code }` de `counterError` (`app/api/counter/_auth.ts:125`).
> **El `code` es el contrato; el `error` es copia.** Estado de cada entrega: ver `docs/INDEX.md`.

## El premio (`Reward`) — forma comun

| Campo | Tipo | Regla |
|---|---|---|
| `couponKind` | `"free_product" \| "two_for_one" \| "discount" \| "extra_stamps" \| "extra_points"` | con cupon; **ausente → `free_product`** |
| `couponLabel` | string 1..40 | texto visible (va al push). **Lo compone la UI** segun tipo/idioma y el comercio lo edita |
| `couponProductId` | uuid \| null | solo `free_product`/`two_for_one`; producto DEL negocio (`GET /api/catalog`) |
| `couponDiscountUnit` | `"percent" \| "amount"` \| null | obligatorio con `discount`, prohibido en otro tipo |
| `couponDiscountValue` | string decimal (`"10.00"`) \| null | `percent`: entero 1..100; `amount`: > 0, en la moneda del negocio |
| `couponExtraUnits` | entero 1..1000 \| null | obligatorio con `extra_*`, prohibido en otro tipo |
| `couponRule` | string 1..2000 \| null | condiciones («solo medianos»); la ven cliente y cajero; **no** va en pase ni push |
| `couponCost` | string decimal ≥ 0 | costo estimado por canje (la UI puede precargarlo del `unitCost` del producto) |
| `couponMaxRedemptions` | entero 1..1.000.000 | tope de canjes de la campaña |

**Todo o nada:** sin cupon, todos `null`. Con cupon, `endsAt` obligatorio (ADR 0094, sin cambios).
**Tipos segun programa:** `extra_stamps` solo si el programa operativo es de sellos; `extra_points`
solo si es de puntos; sin programa operativo, ninguno. La UI los ofrece asi; la API lo exige.
**Moneda:** las respuestas de marketing traen `currencyCode` (ISO 4217, p. ej. `"USD"`, `"ARS"`,
`"EUR"`) a nivel raiz; el simbolo lo pone la UI (`Intl.NumberFormat`). Nunca viaja un simbolo.

## E1 — Campañas y plantillas

- `POST /api/marketing/campaigns`, `PATCH /api/marketing/campaigns/{id}`,
  `POST /api/marketing/templates/{key}/enable`: aceptan los campos de arriba. En el `PATCH`,
  nombrar **cualquier** campo del premio reemplaza el premio entero (los ausentes quedan `null`).
- El DTO `Campaign` (0101 §2) suma `couponKind`, `couponDiscountUnit`, `couponDiscountValue`,
  `couponExtraUnits`, `couponRule`. `GET /campaigns`, `GET /campaigns/{id}`, `GET /templates` y las
  respuestas de escritura suman `currencyCode` en la raiz.
- `GET /api/marketing/campaigns/{id}/results`: `results.coupon` suma `kind`.
- Errores nuevos, todos `400 validation` con `fields`:

| Campo en `fields` | Cuando |
|---|---|
| `couponKind` | tipo desconocido, o `extra_*` que no corresponde al programa |
| `couponProductId` | id invalido **o** producto que no es del negocio (mismo mensaje) |
| `couponDiscountUnit` / `couponDiscountValue` | falta, sobra o fuera de rango |
| `couponExtraUnits` | falta, sobra o fuera de 1..1000 |
| `couponRule` | no es texto o supera 2000 |
| `couponLabel` | #7/#8 (plantillas de saldo) reciben cualquier campo del premio (como hoy) |

Ejemplo (`enable` de `missed_you`):

```json
{ "couponKind": "two_for_one", "couponProductId": "…uuid…", "couponLabel": "2x1 en Café",
  "couponRule": "Solo tamaño mediano", "couponCost": "1.20", "couponMaxRedemptions": 100,
  "endsAt": "2026-10-31" }
```

## E2 — Mostrador

- `POST /api/counter/resolve` (el scan, sin cambios de request): `coupon` pasa a
  `{ couponId, label, campaignName, validUntil, kind, rule, discountUnit, discountValue,
  currencyCode, extraUnits }` (los que no aplican, `null`).
- `POST /api/counter/coupon-redeem` (request sin cambios: `clientRequestId`, `couponId`,
  `locationId?`). Respuesta `200`:
  `{ coupon: { label, campaignName, kind, unitsGranted, balanceAfter } }` — `unitsGranted` y
  `balanceAfter` solo con `extra_*`, si no `null`.
- Error nuevo: **`409 program_changed`** — el cupon es de sellos/puntos extra y el programa del
  negocio ya no es de esa unidad (o se cerro). El cupon queda sin usar. Los demas codigos no cambian
  (`unknown_coupon`, `coupon_not_active`, `already_redeemed`, `coupon_cap_reached`,
  `request_id_reused`).

## E3 — Cupones del cliente

`GET /api/public/consumer/coupons` — sesion de consumidor (cookie `consumer_session`).

```json
{ "coupons": [ { "id": "…", "businessId": "…", "businessName": "Café Central",
  "label": "2x1 en Café", "kind": "two_for_one", "rule": "Solo tamaño mediano",
  "discountUnit": null, "discountValue": null, "currencyCode": "USD", "extraUnits": null,
  "validUntil": "2026-10-31T23:59:59.000Z" } ] }
```

Solo cupones vigentes y sin canje, orden `validUntil` ascendente. Sin sesion: `401 unauthenticated`.
No trae nombre de campaña, costo ni ids internos.

## E4 — Resultados por premio

`GET /api/marketing/rewards/results?from=YYYY-MM-DD&to=YYYY-MM-DD` (owner de marketing). Rango en la
zona horaria del negocio, maximo 366 dias; fuera de eso `400 validation` (`fields.from`/`fields.to`).

```json
{ "currencyCode": "USD", "quality": "estimado_configurado",
  "rewards": [ { "kind": "free_product", "productId": "…", "label": "Café americano",
    "redeemed": 43, "incurredCost": "25.80", "unitsGranted": null } ] }
```

`label` = nombre actual del producto; sin producto (o borrado), el texto del ultimo canje del grupo.
