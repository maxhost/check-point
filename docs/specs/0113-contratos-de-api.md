# 0113 — Contrato de API: horas valle

> Para quien hace la UI. Implementa la spec 0113 / ADR 0105. Se suma al contrato `0112-contratos-de-api.md`.
> Errores `{ error, code }`; `400 validation` con `fields`. Horas en la zona horaria del comercio. Dias ISO:
> 1 = lunes … 7 = domingo.

## H1 — Horario de apertura de un local (pantalla de Marca / Locales)

`GET /api/locations/{locationId}/hours` → la semana completa. `PUT` con el mismo cuerpo la reemplaza entera.

```json
{ "days": [
  { "weekday": 1, "ranges": [ { "opens": "08:00", "closes": "13:00" }, { "opens": "16:00", "closes": "21:00" } ] },
  { "weekday": 6, "ranges": [ { "opens": "20:00", "closes": "02:00" } ] },
  { "weekday": 7, "ranges": [] } ] }
```

- Siempre 7 dias en la respuesta; en el `PUT`, los 7 obligatorios. `ranges: []` = cerrado. Maximo 2 rangos.
- `HH:MM` en pasos de 30 min. `closes` ≤ `opens` = cierra al dia siguiente (el sabado 20:00–02:00 es la noche del
  sabado). Los dos rangos de un dia no se pueden pisar.
- Errores: `400 validation` con `fields["days.0.ranges.1"]` (formato, paso, pisado, mas de 2) o `fields.days`
  (faltan dias o hay repetidos); `404` si el local no es del comercio. Permiso: el de las rutas de locales.
- «Copiar a todos los locales» es de la UI: un `PUT` por local.

## H2 — Franjas valle por local (Marketing)

`GET /api/marketing/valley/locations`

```json
{ "locations": [ { "locationId": "…", "name": "Sede Centro", "hoursSet": true,
  "detection": { "status": "proposed", "computedAt": "2026-10-06T09:00:00Z", "scans": 412 },
  "networkWindows": [ { "weekday": 2, "startHour": 15, "endHour": 17 } ],
  "merchantWindows": [],
  "effective": "network",
  "heatmap": [[0,0,0,0,0,0,0,0,3,9,12,10,8,7,4,2,2,5,9,11,6,1,0,0], …] } ] }
```

| `detection.status` | Significa (texto sugerido) |
|---|---|
| `proposed` | la red encontro franjas flojas (`networkWindows`) |
| `none` | hay datos y no hay horas flojas claras |
| `insufficient_data` | menos de 150 escaneos en 8 semanas: preguntarle al comercio «¿cual es tu hora mas floja?» y guardarlo con el `PUT` |

`detection` es `null` si nunca se calculo (local nuevo: el calculo corre cada 6 h). `heatmap`: 7 filas (lunes a
domingo) × 24 horas, escaneos de las ultimas 8 semanas. `effective`: cuales mandan (las del comercio si tiene).

`PUT /api/marketing/valley/locations/{locationId}/windows` — `{ "windows": [ { "weekday": 2, "startHour": 15,
"endHour": 17 } ] }`. Horas enteras 0..24, `endHour > startHour`, sin pisarse en el mismo dia, al menos una
(`[]` → `400 fields.windows`). Reemplaza las del comercio.

`DELETE /api/marketing/valley/locations/{locationId}/windows` — vuelve a las de la red. `204`.

## H3 — Plantilla «Horas valle»

`POST /api/marketing/templates/valley/enable` / `…/disable`, como las demas.

| Campo | Regla |
|---|---|
| premio | **obligatorio**; ademas de los tipos de siempre acepta `couponKind: "custom"` (texto libre: solo `couponLabel`, ej. «2x1 en cerveza») |
| `couponMaxRedemptions`, `channels`, `excludedLocationIds` no vacio, `welcome*`, `cross*` | prohibidos |
| `message` | opcional, max 60, def. «Ahora hay lugar: te esperamos con un regalo» |
| `dormantDays` | 30 \| 60 \| 90, def. 30 |
| `valleyMonthlyCap` | 1..10000, def. 50 — cupones reclamados por mes |

El publico es fijo: quien no es cliente y los clientes dormidos (nunca el activo). DTO `Campaign` suma
`valley: { monthlyCap } | null`. `couponKind: "custom"` en otra plantilla → `400 fields.couponKind`.

## H4 — «Mis beneficios»: cambios en C1 y C2 (0112)

C1 (`GET /api/public/consumer/cross-offers`): cada oferta suma `"type": "cross" | "valley"`. Una oferta valle trae
ademas:

```json
{ "type": "valley", "locationId": "…",
  "window": { "startHour": 15, "endHour": 17, "endsAt": "2026-10-06T20:00:00.000Z" } }
```

Solo aparece **mientras la franja esta abierta**, una por campaña y local, con el mismo filtro que la cruzada
(medido contra ese local). Orden: las valle primero, despues por distancia.

C2 (`POST …/{campaignId}/claim`): para una valle, el cuerpo lleva `"locationId"` (obligatorio; en una cruzada →
`400 fields.locationId`). El cupon vale **hasta `window.endsAt`** de hoy. Una vez por persona y por local: si ya tuvo
uno de ese local → `404 offer_unavailable`. `kind: "custom"` se muestra con su `label`.
