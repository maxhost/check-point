# 0112 — Contrato de API: «Mis beneficios» y la oferta cruzada

> Para quien hace la UI. Implementa la spec 0112 / ADR 0104. Rutas relativas a `apps/merchant/src/`. Errores:
> `{ error, code }` y, en `400 validation`, `fields: { campo: mensaje }` (como `0101-contratos-de-api.md`).

## Que es «Mis beneficios», en datos

Dos lecturas del cliente logueado (cookie `consumer_session`):

1. **Sus cupones** — `GET /api/public/consumer/coupons` (E3 de `0106-contratos-de-api.md`), **sin filtro** de rubro
   ni distancia. Para agrupar «por programa» usar `businessId`/`businessName`.
2. **Ofertas cruzadas** — `GET /api/public/consumer/cross-offers`, **filtradas** (rubro distinto y ≤ 2 km).

Las pantallas (y si «Mis beneficios» pasa a ser la pestaña inicial de `/wallet`) las decide y construye el owner.

## C1 — Ofertas cruzadas del cliente

`GET /api/public/consumer/cross-offers?lat=-34.6037&lng=-58.3816`

- `lat`/`lng` = GPS del telefono (`navigator.geolocation`). **Opcionales, pero juntos.** No se guardan.
- Sin GPS, el servidor usa el ultimo local donde el cliente escaneo; si no hay ninguno con coordenadas, `offers`
  viene vacio y `origin` es `"none"` (la UI puede pedir permiso de ubicacion).

```json
{ "origin": "gps",
  "offers": [ { "campaignId": "…", "businessId": "…", "businessName": "Gym Norte",
    "logoPath": "/api/public/brands/…/logo?v=3", "message": "Te esperamos con un regalo",
    "label": "10% en tu primera clase", "kind": "discount", "rule": null,
    "discountUnit": "percent", "discountValue": "10", "currencyCode": "ARS", "extraUnits": null,
    "validDays": 15, "distanceMeters": 640,
    "nearestLocation": { "name": "Sede Palermo", "addressLabel": "Av. Santa Fe 3200" } } ] }
```

| `origin` | Significa |
|---|---|
| `gps` | se midio desde `lat`/`lng` |
| `last_scan` | sin GPS: desde el ultimo local escaneado con coordenadas |
| `none` | sin ubicacion: no hay ofertas cruzadas |

Que NO aparece: comercios del mismo rubro que el ultimo donde escaneo o que el local donde esta parado (≤ 100 m);
a mas de 2 km; campañas cuyo publico no es el cliente (no clientes / dormidos); comercios a los que les apago las
promociones; las que ya reclamo (estan en C3); las de cupo del mes agotado. Orden: mas cerca primero. `kind` y sus
campos: los de E3. Sin costo, cupo, ids de membresia ni claves internas.

Errores: `401 unauthenticated` (sin sesion); `400 validation` (`fields.lat` / `fields.lng`: falta uno, no numerico o
fuera de rango).

## C2 — Reclamar una oferta cruzada

`POST /api/public/consumer/cross-offers/{campaignId}/claim` — cuerpo `{ "lat": -34.6, "lng": -58.38 }` (opcional,
mismas reglas que C1).

- **201** `{ "coupon": <cupon E3 con origin "cross"> }` — emitido ahora; vale desde ya por `validDays` dias. **No
  hace falta estar sumado al programa del comercio**: se canjea en su mostrador escaneando el QR del cliente.
- **200** — ya lo tenia: devuelve el mismo cupon (idempotente; reintentar es seguro).
- **404 `offer_unavailable`** — ya no esta disponible para este cliente (lejos, otro publico, cupo agotado,
  campaña terminada o inexistente). Un solo codigo a proposito: refrescar C1.
- `401 unauthenticated`, `400 validation` como C1.

No manda ninguna notificacion.

## C3 — Cambio en E3 (`GET /api/public/consumer/coupons`)

Cada cupon suma `"origin": "cross" | "campaign"`. Un cupon cruzado reclamado vive aca, sin filtro, como cualquier
otro cupon propio.

## M1 — Plantilla «Oferta cruzada» (Marketing del comercio)

Mismas rutas que las demas plantillas: `GET /api/marketing/templates` la lista con `key: "cross"`;
`POST /api/marketing/templates/cross/enable` y `…/cross/disable`.

| Campo de `enable` | Regla |
|---|---|
| premio (`couponLabel`, `couponCost`, `couponKind` y sus campos) | **obligatorio**, como en Bienvenida |
| `couponMaxRedemptions` | prohibido (el freno es el cupo mensual) |
| `channels`, `excludedLocationIds` no vacio, cualquier `welcome*` | prohibidos |
| `message` | opcional, max 60, def. «Te esperamos con un regalo» |
| `crossAudience` | `"non_members"` (def.) \| `"dormant"` \| `"any"` |
| `dormantDays` | 30 \| 60 \| 90, def. 30 — solo se usa con `"dormant"` |
| `crossValidDays` | 7 \| 15 \| 30, def. 15 — vigencia del cupon desde que se reclama |
| `crossMonthlyCap` | entero 1..10000, def. 50 — cupones reclamados por mes calendario de su zona |
| `startsAt` / `endsAt` | opcionales |

Errores: `400 validation` con el campo; cualquier `cross*` en otra plantilla → 400 con ese campo. `disable`: los
cupones ya reclamados siguen valiendo hasta su vencimiento. **DTO `Campaign`** suma
`cross: { audience, validDays, monthlyCap } | null`; una cruzada trae `channels: []`.

## Mostrador

Sin cambios de contrato: al escanear el QR del cliente, el cupon cruzado aparece como cualquier cupon
(`coupon` en el resolve) y se canjea por `POST /api/counter/coupon-redeem`. Nuevo error posible, solo si se canjea
sin haber escaneado: `409 not_enrolled`.
