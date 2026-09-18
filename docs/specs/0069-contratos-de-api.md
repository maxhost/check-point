---
spec: 0069
fecha: 2026-09-17
estado: anexo
resumen: Contrato HTTP normativo de la spec 0069 — metodo, ruta, entrada, salida y TODOS los codigos de error con su status de los 5 endpoints que la spec entrega o toca: `GET /api/onboarding/prefill`, `POST /api/onboarding/business`, `POST /api/onboarding/program`, `GET /api/public/loyalty/:businessId/:programId/stamp` y `GET /api/loyalty-program/qr`. Es lo que consume quien construye la UI por fuera (ADR 0070 §16) y es el oraculo del revisor. Declara ademas, como ESTADO ACTUAL y no como decision, que las 4 rutas de `/api/loyalty-program` responden sus errores SIN `code`.
---

# 0069 — Contrato de API: el wizard de alta

> **Este documento es un entregable, no documentacion opcional** (spec 0069 §Alcance /
> ADR 0070 §17). Un endpoint sin su fila aca **no esta terminado**, y un `code` que el
> contrato declara y la ruta no emite —o al reves— es un FAIL de revision. Mismo rol
> normativo que `0055-contratos-del-orquestador.md` y `0067-contratos-de-api.md`.
>
> **El arco entrega API, NO interfaz.** La UI la construye el owner por fuera; este
> archivo es su insumo. No hay ninguna pantalla nueva en la spec 0069.

## Convenciones

- Salvo donde diga otra cosa, `content-type: application/json` en la entrada y en la
  salida. Los dos endpoints de imagen (§4 y §5) devuelven **bytes**, no JSON.
- **Los tres endpoints NUEVOS (§1, §3 y §5) responden todo error como
  `{ "error": "<texto en español>", "code": "<codigo estable>" }`**, la convencion del
  contrato 0067. El `code` es el contrato; el `error` es copia y la UI puede reescribirlo.
- **§2 (`POST /api/onboarding/business`) responde SIN `code`.** No es una decision de
  esta spec: es como ya respondia, y la 0069 **no cambio la forma de sus errores**, solo
  le sumo una causa de `400`. Ver «Estado actual declarado» al final.
- La autenticacion del owner es la **cookie de sesion de better-auth**
  (`better-auth.session_token`, `HttpOnly`). Ninguna ruta acepta un token por header.
- **Ningun endpoint de esta spec exige email verificado**, y es deliberado (ADR 0070 §11):
  la verificacion bloquea **lo posterior al wizard**, no el wizard. Agregarle el gate a
  §1, §2 o §3 dejaria el alta cerrada con llave, porque el email se verifica despues.
  Esta spec **no agrega ni saca** el gate en ninguna otra superficie (`PARQUEADO.md`
  fila 56).
- **Ningun identificador de negocio ni de programa viaja en el cuerpo ni en el query de
  una ruta autenticada**: siempre sale de la sesion (ADR 0070 §15.3). Es lo que impide
  que un owner alcance el negocio o el programa de otro.

---

## 1. `GET /api/onboarding/prefill` — el prellenado de la PANTALLA 2

**Requiere sesion de owner.** Sin email verificado (ver «Convenciones»).

**Entrada:** ninguna. No lee query ni cuerpo. Los tres headers que **si** lee los pone
Vercel en el edge y el cliente no los controla: `x-vercel-ip-country`,
`x-vercel-ip-latitude`, `x-vercel-ip-longitude`.

**Salida 200** — **NO setea cookie.**

```jsonc
{
  "countries": [
    { "code": "AR", "name": "Argentina", "currencyCode": "ARS" },
    { "code": "BR", "name": "Brasil",    "currencyCode": "BRL" },
    { "code": "CL", "name": "Chile",     "currencyCode": "CLP" },
    { "code": "CO", "name": "Colombia",  "currencyCode": "COP" },
    { "code": "EC", "name": "Ecuador",   "currencyCode": "USD" },
    { "code": "MX", "name": "México",    "currencyCode": "MXN" },
    { "code": "PE", "name": "Perú",      "currencyCode": "PEN" },
    { "code": "PY", "name": "Paraguay",  "currencyCode": "PYG" },
    { "code": "UY", "name": "Uruguay",   "currencyCode": "UYU" }
  ],
  "suggestedCountryCode": "MX",            // o null
  "bias": { "latitude": -2.9001, "longitude": -79.0059 },   // o null
  "categories": [
    { "gcid": "gcid:restaurant", "displayName": "Restaurante" }
    // … 15 en total
  ]
}
```

**Son exactamente estas CUATRO claves** (`bias`, `categories`, `countries`,
`suggestedCountryCode`), pinneadas con `Object.keys(body).sort()` en
`server/onboarding-prefill.test.ts`.

**Lo que la UI tiene que saber, y es contrato:**

1. **`countries` va SIEMPRE completa — 9 paises — y NUNCA se recorta por la deteccion.**
   La deteccion por IP es una **sugerencia**, jamas un filtro (ADR 0070 §14): un
   comerciante detras de una VPN tiene que poder elegir su pais igual. Un
   `x-vercel-ip-country: ES` (pais **no** soportado) devuelve
   `suggestedCountryCode: null` **y la lista intacta**.
2. **`suggestedCountryCode`** es `null` si el header no viene o si el pais no esta
   soportado. Se normaliza a mayusculas (`ar` → `AR`).
3. **`bias`** sirve para sesgar el autocomplete de Geoapify. Es `null` si falta
   **cualquiera** de las dos coordenadas o si alguna no es un numero finito: media
   posicion no sesga nada.
4. **EL TIMEZONE NO SALE DE ACA.** Lo resuelve el cliente con
   `Intl.DateTimeFormat().resolvedOptions().timeZone`, que ahi es exacto y en el
   servidor seria adivinado. **La UI no lo puede esperar de este endpoint.**
5. **`categories` son las 15 de la lista curada** (`lib/business-categories.ts`), con el
   `gcid:` **crudo** de Google Business Profile. El selector manda el `gcid` tal cual a
   §2. El dia que Google apruebe el Basic API Access la lista se reemplaza por la API
   **sin migrar un dato** (ADR 0070 §7).

**Errores**

| Status | `code` | Cuando |
|---|---|---|
| 401 | `unauthorized` | sin sesion |

Oraculo: `server/onboarding-prefill.test.ts` (los 401, la lista completa con un pais no
soportado, el bias parcial y el barrido de claves).

---

## 2. `POST /api/onboarding/business` — el alta del negocio (PANTALLA 2)

**Requiere sesion.** Es **una por cuenta**: un segundo alta con la misma sesion es `409`.

**Entrada**

```jsonc
{
  "name": "La Farmacia",
  "categoryGcid": "gcid:pharmacy",
  "countryCode": "MX",
  "timezone": "America/Mexico_City",
  "locationName": "Matriz",
  "address": {
    "label": "Av. Reforma 100",
    "provider": "geoapify",
    "longitude": -99.1667,
    "latitude": 19.4326,
    "featureId": "…",
    "snapshot": { }
  }
}
```

- **`categoryGcid` es OBLIGATORIO y lo agrega esta spec.** Tiene que ser uno de los 15
  valores exactos que devuelve §1. **No se normaliza**: ni se recorta, ni se baja a
  minusculas, ni se acepta sin el prefijo `gcid:`. El valor viene de un selector que la
  UI arma con la lista de §1, asi que cualquier variante es un valor inventado.
- **`gcid:store` NO es un valor valido en esta ruta**, aunque sea el `DEFAULT` de la
  columna `core.business.category_gcid`. Ese default existe para que
  `ADD COLUMN … NOT NULL` no falle sobre tablas con filas (migracion `0035`), y **no es
  la regla de producto**: la regla vive aca.
- `countryCode`: ISO-3166 alfa-2, uno de los **9** de §1. **`MX` entra con esta spec.**
- `timezone`: IANA. El slug **no viaja**: lo deriva el servidor del nombre (spec 0067 §1).

**Salida 201** — **NO setea cookie.**

```jsonc
{ "businessId": "3f1a…", "slug": "la-farmacia" }
```

Efectos, todos en una transaccion: la fila de `core.business` (con su `category_gcid` y
su `currency_code` derivado del pais — `MX` → `MXN`), la membresia `owner`, el local con
su verificacion de direccion, y una suscripcion `plan: 'free'`, `status: 'active'`.

**Errores** — **esta ruta responde `{ "error": "…" }` SIN `code`** (ver «Estado actual
declarado»). La UI distingue por status y, dentro del `400`, por el texto:

| Status | `code` | Cuerpo / cuando |
|---|---|---|
| 400 | *(sin `code`)* | `{"error":"Selecciona una categoría válida."}` — `categoryGcid` ausente, vacio, que no es string, o que no esta en las 15 de §1. **Se evalua ANTES que todo lo demas**, asi que un cuerpo invalido en varias cosas a la vez devuelve este |
| 400 | *(sin `code`)* | `{"error":"Selecciona una ubicación válida."}` — falta `name`, `countryCode` no soportado, `timezone` que no es IANA, falta `locationName`, o `address` sin coordenadas numericas |
| 401 | *(sin `code`)* | `{"error":"No autorizado."}` — sin sesion |
| 409 | *(sin `code`)* | `{"error":"Tu negocio inicial ya fue creado."}` — la cuenta ya tiene una membresia |
| 503 | *(sin `code`)* | `{"error":"<mensaje de la verificación de dirección>"}` — Geoapify no pudo verificar la ubicacion o no esta configurado |
| 503 | *(sin `code`)* | `{"error":"No pudimos guardar tu negocio. Intenta nuevamente."}` — fallo al persistir, **incluido el TOCTOU del slug**: el reintento deriva el siguiente libre |

**Limite heredado y declarado:** un cuerpo que **no es JSON** no esta contemplado —
`await request.json()` corre fuera de cualquier `try`—, asi que **el handler RECHAZA**
(medido en `onboarding-business.neon.integration.test.ts`, caso «LÍMITE») y Next lo
traduce a un **500 sin `code`** en vez del `400` que corresponderia. Es anterior a esta
spec y la 0069 no lo toca; queda como hallazgo (ver el final).

Oraculo: `server/onboarding-business.neon.integration.test.ts` (las seis categorias
invalidas, el 201 con la fila leida por SQL, el `MXN` y el `ES` que sigue afuera).

---

## 3. `POST /api/onboarding/program` — el programa desde DOS campos (PANTALLA 3)

**Requiere sesion de owner.** **El negocio sale de la SESION**: no hay `businessId` en el
cuerpo ni en el query.

**Entrada — dos campos, y nada mas**

```jsonc
{ "target": 8, "reward": { "type": "custom", "label": "Café gratis" } }
```

- `target`: **entero 2..50** (cada cuantos sellos se gana el premio).
- `reward.type`: **`"custom"` y nada mas** en este endpoint. Los premios de catalogo y de
  descuento existen en `PUT /api/loyalty-program`, no en el wizard.
- `reward.label`: texto no vacio; se recorta.

**Que compone el servidor, y por que importa para la UI:** `saveProgram` exige un
`ProgramInput` completo —modalidad, configuracion, **al menos una clausula de terminos**,
exactamente un premio y la mecanica de acumulacion—. Este endpoint lo arma solo:

| Campo | Valor | De donde sale |
|---|---|---|
| `kind` | `"stamps"` | el wizard solo ofrece Sellos |
| `configuration` | `{ "unitName": "sello", "target": <target> }` | la unidad no se elige en el wizard |
| `clauses` | las semillas **`earning`** y **`redemption`** de `core.terms_template` (locale `es`, scope `global-draft`, `published`) | `drizzle/0004_polite_turbo.sql`. **`transition` NO entra**: es la clausula del cierre |
| `rewards` | `[reward]` | exactamente uno, que es lo que Sellos pide |
| `accrual` | `{ "mode": "per_purchase", "grant": 1, "blockAmount": null }` | **un sello por compra.** Lo eligio el implementador, no el owner: la spec no lo fija y el validador no acepta que falte |
| `stampAction` | `"keep"` | el wizard no sube imagen — de ahi sale el placeholder de §4 |

**La UI de afuera NO tiene que inventar los terminos legales del comercio.** Ese es el
motivo entero de que este endpoint exista al lado de `PUT /api/loyalty-program`.

**Salida 201** — **NO setea cookie.**

```jsonc
{ "programId": "9c2b…", "created": true }
```

**El programa nace `status = 'active'`** por el `DEFAULT` de la columna
(`core.loyalty_program.status`). No es trabajo del endpoint: es una propiedad que el
oraculo **verifica**, no que el codigo construye.

Un `200` con `"created": false` significa que el negocio **ya tenia** un programa de
Sellos y este llamado lo **edito** (reusa `saveProgram`). El wizard no deberia llegar a
ese caso; esta declarado porque la ruta lo puede emitir.

**Errores**

| Status | `code` | Cuando |
|---|---|---|
| 400 | `invalid_body` | el cuerpo no es JSON parseable |
| 401 | `unauthorized` | sin sesion |
| 403 | `not_owner` | la sesion no es owner de ningun negocio |
| 409 | `program_exists` | el programa esta en cierre (`closing`) y no puede editarse, o la carrera de dos altas simultaneas |
| 422 | `invalid_program` | `target` que no es un entero 2..50; `reward` ausente, sin `label`, o de un `type` que el wizard no ofrece; cuerpo que no es un objeto |
| 503 | `program_unavailable` | fallo no de dominio. **Incluye el caso en que faltan las semillas de terminos**: antes que escribir un programa **sin terminos**, la ruta corta. Todo lo que toca la base va adentro del `try`, asi que un fallo de base **nunca** sale como 500 sin `code` |

Oraculos: `server/onboarding/program-defaults.test.ts` (la composicion, validada contra
el validador **real** de `saveProgram`) y
`server/onboarding-program.neon.integration.test.ts` (el 201, el `status='active'` leido
por SQL, las **dos** clausulas renderizadas, el unico premio y los `target` invalidos).

---

## 4. `GET /api/public/loyalty/:businessId/:programId/stamp?v=<version>` — el sello

**Publica: no requiere sesion.** Devuelve **bytes de imagen**, nunca JSON en el caso feliz.

`v` es la `stamp_image_version` vigente del programa. **El unico lugar que construye esta
URL es `toClientProgram`** (`server/loyalty-program/client-view.ts`), que la emite
**siempre** —con sello o sin el— y de ahi la propagan `GET /api/loyalty-program`
(`program.stampImagePath`) y el wallet del consumidor.

**Tres desenlaces, y los tres son contrato:**

| Caso | Status | `content-type` | Cuerpo |
|---|---|---|---|
| sello vigente y `v` correcta | 200 | `image/webp` si el request manda `accept: image/webp`, si no `image/png` | los bytes de R2 |
| programa **sin** sello y `v` correcta | 200 | **`image/png` siempre** (el placeholder ignora `accept`) | el **PLACEHOLDER**: cuadrado de 512×512, **fondo transparente**, con la **primera letra del nombre del negocio** en `#1A1A1A`. Un nombre sin ninguna letra latina cae a `•` |
| **`v` que no es la vigente** (con sello o sin el), programa inexistente, `businessId`/`programId` que no son uuid | **404** | — | vacio |

**Headers del 200** (exactamente tres, pinneados):
`content-type`, `cache-control: public, max-age=31536000, immutable`,
`x-content-type-options: nosniff`.

**Sin sello, la version vigente es la de la columna, `0` por default.** Un sello que se
**removio** deja la columna en `null` con la version **incrementada**, asi que ahi el
placeholder se sirve en esa version, no en `0`.

**Por que una version vieja NO sirve el placeholder, y es lo mas importante de esta
seccion:** si lo hiciera, una URL cacheada y vencida mostraria la letra **en lugar de un
sello real recien subido** — y eso es peor que el 404, porque el 404 lo arregla recargar
y esto no. Oraculo: la mutacion #3 del presupuesto.

**Invariante que no se negocia: esta ruta NUNCA serializa `stampImageObjectKey`.** Ni en
el cuerpo ni en un header. Lo pinnea `server/loyalty-stamp-route.test.ts` leyendo los
headers completos, no solo el cuerpo.

**Errores:** no hay cuerpo de error. Todo lo que no sea un 200 es un **404 con cuerpo
vacio**, incluido el fallo de lectura de R2. La ruta **no distingue** «no existe» de «no
es tuyo»: es publica y no debe publicar la existencia de un programa.

Oraculos: `server/loyalty-stamp-route.test.ts` (los tres desenlaces y la no-filtracion) y
`server/loyalty-stamp-placeholder.neon.integration.test.ts` (el PNG real, el 404 de la
version vieja y la regresion con sello).

---

## 5. `GET /api/loyalty-program/qr` — el QR de enrolamiento, descargable

**Requiere sesion de owner.** Devuelve **bytes de imagen** en el caso feliz.

**Entrada: solo query.**

| Parametro | Valores | Default |
|---|---|---|
| `format` | `svg` \| `png` | `svg` (cualquier otro valor cae a `svg`) |
| `download` | `1` | ausente = no adjunta |

**`programId` NO es un parametro, y su ausencia es el contrato de seguridad de esta
ruta.** El programa lo resuelve `programForOwner(session.user.id)`. Un `?programId=` en
la URL **se ignora por completo**: con el, cualquier owner podria fabricar y repartir el
codigo de enrolamiento de otro comercio. Oraculo: la mutacion #5 del presupuesto, con el
QR **decodificado de verdad** (no «vino un SVG»).

**Salida 200** — **NO setea cookie.**

| `format` | `content-type` | Cuerpo |
|---|---|---|
| `svg` | `image/svg+xml` | el SVG del QR, correccion de errores **H** |
| `png` | `image/png` | PNG de **1024×1024**, fondo blanco |

Headers del 200: `content-type`, `cache-control: private, no-store`,
`x-content-type-options: nosniff`, y con `download=1` tambien
`content-disposition: attachment; filename="qr-<slug>.<svg|png>"` con el **slug del
negocio**.

**Que codifica:** `enrollUrl(<origin del request>, <programId del owner>)`, o sea
`<origin>/enroll/<programId>` (ADR 0042). El `origin` sale del request: no hay helper de
URL por env en este repo.

**QR pelado, sin poster ni logo**, por decision del owner: en el wizard todavia no hay ni
color ni logo del comercio. El poster armado es del brand kit (spec 0041).

**Errores**

| Status | `code` | Cuando |
|---|---|---|
| 401 | `unauthorized` | sin sesion |
| 403 | `not_owner` | la sesion no es owner de ningun negocio |
| 403 | `business_suspended` \| `business_closed` | el negocio no opera (spec 0072 §D4; con `suspensionReason` solo el primero) |
| 404 | `no_program` | el negocio no tiene un programa operativo (`active`/`closing`) |
| 503 | `qr_unavailable` | fallo no de dominio (base caida, rasterizado fallido) |
| **nunca** | **`email_not_verified`** | **NO SE EMITE — ver abajo** |

**LA AUSENCIA DE `email_not_verified` ES CONTRATO, NO UN DESCUIDO (spec 0075).** Esta ruta es la
**unica** del API del owner que no lleva el paso 3 del gate: resuelve por
`requireApiOwnerSinGateDeEmail` y conserva enteros los pasos 1, 2 y 4 (sesion, owner activo y el
eje `status`, con su fail-closed). **Motivo:** la pantalla del QR es la **cuarta del wizard**
(ADR 0070 §1: `→ | Tu QR | nada: es la recompensa | ya generado`) y el owner dicto que la
verificacion de email bloquea *«todo lo que venga DESPUES del wizard»* (ADR 0070 §11). Una
cuenta recien creada llega a esta pantalla con `email_verified: false` **por construccion**, asi
que el paso 3 volvia inalcanzable el resultado del propio alta. Es la misma razon por la que
`POST /api/onboarding/program` (§3) y `GET /api/onboarding/state` (contrato 0074 §3) tampoco lo
llevan.

**Para quien construye la UI:** la pantalla del QR **no** tiene que ofrecer «verificá tu email»
como salida de un 403. Sus 403 posibles son `not_owner`, `business_suspended` y
`business_closed`, y ninguno se resuelve verificando el email.

Oraculo: `server/loyalty-qr.neon.integration.test.ts` (los dos formatos, el
`content-disposition` con el slug, el 401, el 404, el aislamiento entre dos negocios y **el
owner con `email_verified: false` descargando su QR en SVG y en PNG**) y
`server/api-owner-surfaces.test.ts` (la tabla `SURFACES_SIN_GATE_DE_EMAIL`, que asevera la
excepcion en positivo, y `SURFACES`, que sigue midiendo los otros **cinco** desenlaces sobre esta
misma ruta).

---

## Estado actual declarado — lo que ESTE contrato NO arregla

**Las cuatro rutas de `/api/loyalty-program` responden sus errores SIN `code`**, contra la
convencion del contrato 0067 («todo error responde `{error, code}`»). **Es un hallazgo a
decidir, no una decision del owner**, y la spec 0069 no lo arregla porque no es su
alcance. Medido contra el arbol el 2026-09-17:

| Ruta | Errores, tal como salen hoy |
|---|---|
| `GET /api/loyalty-program` | 401 `{"error":"No autorizado."}` · 403 `{"error":"Sin negocio."}` |
| `PUT /api/loyalty-program` | 401 `{"error":"No autorizado."}` · 4xx `{"error":"<mensaje de LoyaltyError>"}` (403/409/422) · 503 `{"error":"No pudimos guardar el programa."}` |
| `DELETE /api/loyalty-program` | 401 · 4xx de `LoyaltyError` · 503 `{"error":"No pudimos retirar el programa."}` |
| `PATCH /api/loyalty-program` | 401 · 422 `{"error":"Acción no válida."}` · 4xx de `LoyaltyError` · 503 `{"error":"No pudimos cancelar el cierre."}` |

Y la quinta del mismo arbol, por completitud: `POST /api/loyalty-program/stamp-upload`
tampoco emite `code` (401, 403, 400, 4xx de `LoyaltyError`, 503).

**Consecuencia para quien construye la UI:** de esas rutas hay que discriminar por
**status**, y dentro de un mismo status por el texto de `error` —que es copia y puede
cambiar—. Los cinco endpoints de este contrato (§1, §3 y §5) si traen `code`; §2 no, por
el motivo declarado en «Convenciones».

**Candidato a la fila 56 de `PARQUEADO.md`.**

### Segundo hallazgo, tambien declarado y no arreglado

`POST /api/onboarding/business` con un cuerpo **que no es JSON** hace que el handler
rechace —medido— y Next lo traduce a **500**, porque `await request.json()` corre fuera
de todo `try`. Es anterior a esta spec. El arreglo es
el mismo patron que ya usa §3 (`try` alrededor del `json()` → `400 invalid_body`), pero
cambiar la forma de respuesta de esa ruta excede el alcance de la 0069.
