# 0155 — Contrato de API: alta del comercio con Google Places

> Para GPT (pantallas). Lo que no se nombra aca no cambia. Todas las rutas son same-origin del merchant; ninguna pide
> clave de Google en el cliente. Errores con la forma de siempre: `{ "error": "<mensaje>", "code": "<codigo>" }`.

## El flujo, una linea por pantalla

1. **Negocio.** Un solo input de busqueda. Con ≥ 3 caracteres (sin contar espacios de los bordes) y 300 ms sin teclear
   → `P1`. Al elegir una sugerencia → `P2`. Despues se muestra el formulario:
   - sugerencia `kind: "business"` → **nombre** precargado con el `mainText` de la sugerencia, **categoria**
     precargada con `suggestedCategoryGcid` (si viene), **direccion** = `place.addressLabel`, solo lectura.
   - sugerencia `kind: "address"` → nombre vacio, categoria vacia (o la sugerida si viene), direccion igual.
   - «Cambiar» al lado de la direccion vuelve al buscador (sesion de busqueda NUEVA).
   - Categorias: de `P3`. Nombre y categoria obligatorios.
   - Abajo, el acceso «Ya tengo cuenta → Iniciar sesion» (el `POST /api/merchant/auth/login` de hoy, sin cambios).
2. **Email.** Un input. `P4` con el email y lo del paso 1. `201` → paso 3. `200 { sent: true }` → pantalla «Ya tenes
   cuenta: te mandamos un link para entrar» (lo del paso 1 se descarta). `422 invalid_selection` → volver al paso 1.
3. **Confirmacion.** «Tu negocio <name> esta listo» + boton «Ir a mi panel» → `/backoffice`. Si
   `verificationSent: false`, el aviso de hoy con «Reenviar enlace» (`POST /api/merchant/auth/verify-email`, sin cambios).

Al cargar la pagina: `GET /api/onboarding/state` (sin cambios). `authenticated: false` → paso 1. `authenticated: true`
→ redirigir a `/backoffice` (con la escritura unica de `P4` no existe cuenta de dueño sin negocio).

**Sesion de busqueda (`sessionToken`):** un UUID v4 que genera el cliente (`crypto.randomUUID()`) al empezar a buscar.
Se manda el MISMO en cada `P1` de esa busqueda y en el `P2` que la cierra. Despues de un `P2` (o de «Cambiar»), uno
nuevo. Es lo que hace que Google no cobre las busquedas mientras se teclea.

## P1 — Sugerencias

`POST /api/places/autocomplete` — publica (sin sesion).

```json
{ "input": "cafe platano", "sessionToken": "6f1c…-uuid-v4" }
```

**200**

```json
{ "suggestions": [
  { "placeId": "ChIJ…", "kind": "business", "mainText": "Café Plátano", "secondaryText": "Cuenca, Ecuador" },
  { "placeId": "Ek9M…", "kind": "address", "mainText": "Santa María & Puerto de Palos", "secondaryText": "Trujui, Buenos Aires, Argentina" }
] }
```

- Hasta 5 sugerencias, solo de los paises soportados (AR, BR, CL, CO, EC, MX, PE, PY, UY), sesgadas hacia la ubicacion
  aproximada del visitante. `secondaryText` puede ser `null`. Lista vacia = sin resultados (no es error).

| Status | `code` | Cuando |
|---|---|---|
| 400 | `invalid_input` | `input` con menos de 3 o mas de 120 caracteres tras `trim`, o `sessionToken` que no es UUID |
| 503 | `places_unavailable` | Google no respondio o respondio error (incluida la cuota del dia agotada) |

## P2 — Elegir una sugerencia

`POST /api/places/details` — publica.

```json
{ "placeId": "ChIJ…", "sessionToken": "6f1c…" }
```

**200**

```json
{ "place": {
    "placeId": "ChIJ…",
    "kind": "business",
    "addressLabel": "Av. Remigio Crespo 4-55, Cuenca, Ecuador",
    "latitude": -2.9081,
    "longitude": -79.0137,
    "countryCode": "EC",
    "suggestedCategoryGcid": "gcid:cafe"
  },
  "selectionToken": "eyJ…" }
```

- `selectionToken` es opaco: se guarda tal cual y se manda en `P4` (o en el alta/edicion de un local). Vence a las
  **2 horas**.
- `suggestedCategoryGcid` es un `gcid` de la lista de `P3`, o `null`.

| Status | `code` | Cuando |
|---|---|---|
| 400 | `invalid_input` | falta `placeId` o `sessionToken` no es UUID |
| 404 | `place_not_found` | Google no conoce ese `placeId` |
| 422 | `unsupported_country` | el lugar no esta en un pais soportado. Mensaje: «Por ahora solo trabajamos en Argentina, Brasil, Chile, Colombia, Ecuador, México, Perú, Paraguay y Uruguay.» |
| 503 | `places_unavailable` | Google no respondio |

## P3 — Categorias

`GET /api/onboarding/prefill` — **pasa a ser publica** y **cambia de forma**: ya no trae `countries`,
`suggestedCountryCode` ni `bias`.

```json
{ "categories": [ { "gcid": "gcid:cafe", "displayName": "Cafetería" } ] }
```

## P4 — Crear la cuenta y el negocio

`POST /api/onboarding/signup` — publica. **Reemplaza** a `POST /api/merchant/auth/start` y a
`POST /api/onboarding/business`, que pasan a `404`.

```json
{ "email": "nombre@negocio.com",
  "business": { "name": "Café Plátano", "categoryGcid": "gcid:cafe", "selectionToken": "eyJ…" } }
```

**201** — email nuevo: se crearon la cuenta, el negocio y su local «Principal» (sin programa), y viene la cookie de
sesion.

```json
{ "created": true, "verificationSent": true,
  "business": { "id": "…", "name": "Café Plátano", "slug": "cafe-platano" } }
```

**200** — el email ya tiene cuenta: **no se crea nada y no hay cookie**; se mando un link de acceso.

```json
{ "sent": true }
```

| Status | `code` | Cuando |
|---|---|---|
| 400 | `invalid_body` | el cuerpo no es JSON o no es un objeto |
| 400 | `invalid_email` | email mal formado o de un dominio no entregable (mensaje para mostrar bajo el campo) |
| 400 | `invalid_business` | `name` vacio o de mas de 120 caracteres, o `categoryGcid` fuera de la lista de `P3`. Trae `"field": "name" \| "categoryGcid"` |
| 422 | `invalid_selection` | `selectionToken` ausente, alterado o vencido → volver al paso 1 |
| 429 | `rate_limited` | demasiados intentos (mismos limites que tenia `start`) |
| 503 | `signup_unavailable` | fallo interno; reintentar |

Se valida todo (`400`/`422`) **antes** de mirar si el email existe: un error de validacion nunca manda un mail.

## Locales del backoffice (cambia el campo `address`)

`POST /api/locations` y `PATCH /api/locations/:id`: el objeto `address` pasa de
`{ label, provider: "geoapify", longitude, latitude, featureId }` a:

```json
{ "address": { "label": "Av. Remigio Crespo 4-55, Cuenca, Ecuador", "selectionToken": "eyJ…" } }
```

- Con `selectionToken` → local georreferenciado (el servidor usa la direccion y las coordenadas del token, no el
  `label`). Sin `selectionToken` → direccion tipeada a mano, sin coordenadas (como hoy).
- El buscador del formulario de locales usa las mismas `P1`/`P2`.

| Status | `code` | Cuando |
|---|---|---|
| 422 | `invalid_selection` | token alterado o vencido |
| 422 | `address_country_mismatch` | el lugar elegido esta en otro pais que el negocio. Mensaje: «Esa dirección está en otro país que tu negocio.» |

`503 address_unverified` deja de existir (ya no se llama a un proveedor al guardar).
