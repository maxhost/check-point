---
spec: 0155
fecha: 2026-10-04
estado: cerrada
resumen: Servidor del alta en 3 pasos (ADR 0121) — rutas publicas de Google Places (autocomplete + details Essentials, sesgo por IP, token de seleccion firmado), POST /api/onboarding/signup que crea cuenta + negocio + local en una escritura (email conocido → link, sin nada), prefill publico solo con categorias, locales del backoffice con token; borra Geoapify, start y business. Contrato para GPT en 0155-contratos-de-api.md.
disjunta: no
archivos: apps/merchant/src/server/places/*, apps/merchant/src/app/api/places/*, apps/merchant/src/app/api/onboarding/{signup,prefill,business}/*, apps/merchant/src/app/api/merchant/auth/start/*, apps/merchant/src/server/{location-providers,supported-countries,auth-start}.ts, apps/merchant/src/server/locations/{core,shared}.ts, apps/merchant/src/lib/location-address*.ts, tests neon/unit listados, apps/merchant/package.json
---

# 0155 — Alta del comercio con Google Places (servidor)

**Nivel N2** (`CLAUDE.md` §Niveles): crea cuentas y sesiones. Decisiones del owner en el ADR 0121 (§1–§9); contrato
HTTP para GPT en [`0155-contratos-de-api.md`](0155-contratos-de-api.md), que **es parte de esta spec**: donde esta
spec no repite un status o un campo, manda el contrato.

## Problema

- El alta crea la cuenta antes que el negocio: `POST /api/merchant/auth/start` (sin negocio) y despues
  `POST /api/onboarding/business` (exige sesion). El owner quiere el negocio primero y el email despues (ADR 0121 §1).
- La direccion la resuelve Geoapify: autocomplete directo del navegador con clave publica sin restriccion de origen
  (PARQUEADO #49) y re-verificacion server-side con reverse geocoding en cada alta (`location-providers.ts`).
- No hay forma de encontrar un COMERCIO por nombre: solo direcciones.

## Alcance

**Entra (servidor, Claude):**
1. Cliente de Google Places del servidor: autocomplete y details (SKU Essentials).
2. Token de seleccion firmado (HMAC) con lo que se guarda del lugar.
3. Mapeo `types` de Google → `gcid` de la lista curada.
4. Zona horaria desde coordenadas con `@photostructure/tz-lookup`.
5. Rutas `P1`–`P4` del contrato y el cambio de `address` en locales.
6. Borrar Geoapify del servidor, `start`, `business` y sus tests; migrar las suites que sembraban con `start`.
7. Docs: gotcha de Geoapify en la skill `gotchas-del-repo` → reemplazado por el de Google; PARQUEADO #49 cerrado.

**No entra:**
- Pantallas (GPT, spec propia sobre este contrato): wizard nuevo, formulario de locales, borrar
  `address-autofill-geoapify.tsx`, `address-autofill.tsx`, `address-combobox.tsx`, `account-step.tsx` (modo alta),
  `program-step.tsx`, `program-impact.tsx`, `complete-step.tsx` y el CSS de Geoapify en `globals.css`.
- El checklist posterior (verificar email, catalogo, activar programa): trabajo futuro del owner.
- **El permiso de alta (`onboardingGrantUntil`, spec 0077) se conserva igual**: `signup` lo emite como lo emitia
  `start`. Sin el paso de programa nadie lo consume en el wizard; decidir si se borra va con el checklist (PARQUEADO #71).
- Horarios, telefono, web, fotos de Google (ADR 0121 §5).
- Limite por IP en las rutas de Places (ver «Limites declarados»).
- Migracion de esquema: `provider` es `text` libre; no hay columnas nuevas.
- Borrar las env de Geoapify en Vercel (paso del owner despues del deploy).

## Diseño

### Especificación técnica

**Archivos nuevos en `apps/merchant/src/server/places/`:**

- **`google.ts`** — `autocomplete({ input, sessionToken, bias })` y `details({ placeId, sessionToken })`.
  - Autocomplete: `POST https://places.googleapis.com/v1/places:autocomplete`, headers `X-Goog-Api-Key`
    (`process.env.GOOGLE_MAPS_API_KEY`), body `{ input, sessionToken, languageCode: "es", includedRegionCodes:
    ["ar","br","cl","co","ec","mx","pe","py","uy"] }` (de `SUPPORTED_COUNTRIES`, en minusculas) y, si hay `bias`,
    `locationBias: { circle: { center: { latitude, longitude }, radius: 50000 } }`. Devuelve hasta 5
    `{ placeId, kind, mainText, secondaryText }` desde `suggestions[].placePrediction` (`placeId`,
    `structuredFormat.mainText.text`, `structuredFormat.secondaryText?.text ?? null`, `types`). Las sugerencias sin
    `placePrediction` (las `queryPrediction`) se descartan.
  - `kind`: `"business"` si `types` incluye `"establishment"`, si no `"address"`. Funcion pura exportada
    (`suggestionKind`).
  - Details: `GET https://places.googleapis.com/v1/places/{placeId}?sessionToken=…&languageCode=es`, header
    **`X-Goog-FieldMask: id,formattedAddress,location,addressComponents,types`** — exactamente esos cinco (ADR 0121
    §6: ninguno Pro/Enterprise). La mascara es una constante exportada y tiene test.
  - Errores: sin clave, red caida, o status ≥ 500 / 429 / 403 → `PlacesError("places_unavailable")`; 404 o 400 de
    Google sobre el `placeId` → `PlacesError("place_not_found")`. Se loguea `{ status, googleStatus }`, nunca la clave
    ni la URL completa.
  - Medido el 2026-10-04 con la clave del owner: las dos llamadas con estos cuerpos responden (ADR 0121, Contexto).
- **`category-from-types.ts`** — `categoryFromTypes(types: string[]): string | null`. Pura. Recorre una tabla de
  prioridad (de mas especifico a mas general) y devuelve el primer `gcid` cuyo tipo aparezca en `types`:

  | Tipos de Google | `gcid` |
  |---|---|
  | `pizza_restaurant` | `gcid:pizza_restaurant` |
  | `ice_cream_shop` | `gcid:ice_cream_shop` |
  | `bakery` | `gcid:bakery` |
  | `cafe`, `coffee_shop` | `gcid:cafe` |
  | `bar`, `pub`, `wine_bar` | `gcid:bar` |
  | `barber_shop` | `gcid:barber_shop` |
  | `nail_salon` | `gcid:nail_salon` |
  | `beauty_salon`, `hair_salon`, `hair_care` | `gcid:beauty_salon` |
  | `gym`, `fitness_center` | `gcid:gym` |
  | `pharmacy`, `drugstore` | `gcid:pharmacy` |
  | `grocery_store`, `supermarket`, `convenience_store` | `gcid:grocery_store` |
  | `clothing_store` | `gcid:clothing_store` |
  | `pet_store` | `gcid:pet_store` |
  | `car_wash` | `gcid:car_wash` |
  | `restaurant` o cualquier `*_restaurant` | `gcid:restaurant` |

  Ninguna coincidencia → `null`. Todo `gcid` devuelto pasa `isBusinessCategory` (test que recorre la tabla).
- **`timezone.ts`** — `timezoneFor(latitude, longitude): string` con `tzlookup` de `@photostructure/tz-lookup`. Si el
  resultado no pasa `isIanaTimezone` → error (el alta responde `503 signup_unavailable`). Dependencia nueva en
  `apps/merchant/package.json` (CC0-1.0, sin dependencias, 88 KB; `npm view` 2026-10-04: 11.7.0).
- **`selection-token.ts`** — `signSelection(selection)` y `verifySelection(token, now): Selection` con
  `Selection = { v: 1, provider: "google", placeId, label, latitude, longitude, countryCode, timezone, types,
  snapshot, exp }`.
  - Formato: `base64url(JSON) + "." + base64url(HMAC-SHA256)`. Clave: `HMAC-SHA256(BETTER_AUTH_SECRET,
    "places-selection-v1")` (derivada; sin env nueva). Comparacion con `timingSafeEqual`.
  - `exp` = emision + 2 h. Vencido, firma distinta, forma invalida o `v` distinto → `SelectionError` (→
    `422 invalid_selection`). Sin `BETTER_AUTH_SECRET` → error interno (503), nunca un token sin firma.
  - `snapshot`: el JSON de Details tal cual (va a `address_snapshot` / `provider_snapshot`).
- **`supported-countries.ts`** (en `server/`, sale de `location-providers.ts`): `SUPPORTED_COUNTRIES`,
  `isSupportedCountryCode`, `countryFromComponents(addressComponents)` (el `shortText` del componente con tipo
  `country`).

**Rutas:**

- **`POST /api/places/autocomplete`** (`app/api/places/autocomplete/route.ts`) — sin sesion. Valida `input` (3–120
  tras trim) y `sessionToken` (UUID). `bias` = `x-vercel-ip-latitude` / `x-vercel-ip-longitude` (los dos o ninguno,
  como hacia `prefill`). Contrato P1.
- **`POST /api/places/details`** (`app/api/places/details/route.ts`) — sin sesion. Llama a `details`; `countryCode`
  de `addressComponents`; si no es soportado → `422 unsupported_country`. `timezone = timezoneFor(lat, lng)`.
  Responde `place` (con `kind` = `suggestionKind(types)`, `suggestedCategoryGcid = categoryFromTypes(types)`) y
  `selectionToken = signSelection(…)`. Contrato P2.
- **`GET /api/onboarding/prefill`** — se borra el chequeo de sesion y los campos `countries`, `suggestedCountryCode`,
  `bias`. Contrato P3.
- **`POST /api/onboarding/signup`** (`app/api/onboarding/signup/route.ts`) — contrato P4. Orden, y nada escribe ni
  manda mail antes del paso 5:
  1. Cuerpo JSON objeto (`400 invalid_body`).
  2. `normalizeEmail` de `auth-start.ts` (`400 invalid_email`, como hoy).
  3. `name` (trim, 1–120) y `categoryGcid` (`isBusinessCategory`) → `400 invalid_business` + `field`.
  4. `verifySelection(business.selectionToken)` → `422 invalid_selection`.
  5. `assertStartWithinLimits` + `recordStartAttempt` (los mismos de `start`, mismas constantes) → `429`.
  6. `findUserIdByEmail(email)` → si existe: `signInMagicLink` y `200 { sent: true }` **sin cookie y sin escribir
     nada mas** (ADR 0121 §2).
  7. Email nuevo: **un solo `db.batch`** con `user` (como `createOwnerUser`: `name: ""`, `emailVerified: false`),
     `owner_profile`, `business` (slug con `slugForNewBusiness`, moneda con `currencyForCountry`, `countryCode` y
     `timezone` del token), `business_membership` owner, `location` («Principal», `address_label`, coordenadas,
     `country_code`, `address_snapshot` del token), `location_verification` (`source: "provider_verified"`,
     `provider: "google"`, `provider_place_id`, `attribution: null`) y `subscription` free/active. Para eso
     `createOwnerUser` se parte en `ownerUserInsert(db, email)` (devuelve el query sin ejecutar) y se usa adentro del
     batch.
  8. Unique violation del email (carrera de dos altas) → rama del paso 6 para ese email, como hacia `start`. Unique
     violation del slug → `503 signup_unavailable` (el reintento deriva otro, como hacia `business`).
  9. `openMerchantSession(userId, { onboardingGrantUntil: now + ONBOARDING_GRANT_MINUTES })`, despues
     `signInMagicLink` para verificar el email (falla → `verificationSent: false`, la cuenta queda), y `201` con la
     cookie.
- **Borradas** (404): `app/api/merchant/auth/start/route.ts`, `app/api/onboarding/business/route.ts`.

**Locales (`server/locations/core.ts`):**
- `AddressInput` pasa a `{ label?, selectionToken? }`. `isProviderSelection` → `typeof selectionToken === "string" &&
  selectionToken.length > 0`.
- `resolveAddress`: con token → `verifySelection` (`422 invalid_selection`); `selection.countryCode !==
  countryCode del negocio` → **`422 address_country_mismatch`**; resultado `provider_verified` / `google` con los datos
  del token (el `label` del body se ignora). Sin token → `typedAddress` como hoy.
- `ResolvedAddress.provider`: `"google" | null` al escribir; los tipos de LECTURA aceptan tambien `"geoapify"` (filas
  viejas).
- Se borra `503 address_unverified`.

**Borrado de Geoapify:** `server/location-providers.ts` (lo vivo se muda a `supported-countries.ts`),
`server/location-providers.test.ts`, `lib/location-address.ts` y `lib/location-address.test.ts` (solo los usa
Geoapify; verificar con `rg` antes de borrar). `.env.example`: `GOOGLE_MAPS_API_KEY=` en lugar de las dos de Geoapify
(si el permiso del agente no deja tocar `.env.example`, lo anota en el handoff y lo hace el orquestador).

**Observabilidad:** `console.error("places_google_failed", { op, status, googleStatus })` y
`console.error("onboarding_signup_failed", { name, slugConflict })`. Nunca email, clave, token ni URL con query.

### Arquitectura de referencia

ADR 0121 (esta decision), ADR 0070 (alta; §17 borrar UI vieja), ADR 0076 / spec 0077 (permiso de alta), spec 0067 §2
(email conocido no abre sesion), ADR 0114 (zonas: GPT pantallas).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/places/google.ts` (+ `.test.ts`) | crear |
| `apps/merchant/src/server/places/category-from-types.ts` (+ `.test.ts`) | crear |
| `apps/merchant/src/server/places/timezone.ts` (+ `.test.ts`) | crear |
| `apps/merchant/src/server/places/selection-token.ts` (+ `.test.ts`) | crear |
| `apps/merchant/src/server/supported-countries.ts` | crear (sale de `location-providers.ts`) |
| `apps/merchant/src/app/api/places/autocomplete/route.ts` | crear |
| `apps/merchant/src/app/api/places/details/route.ts` | crear |
| `apps/merchant/src/app/api/onboarding/signup/route.ts` | crear |
| `apps/merchant/src/server/places-routes.test.ts` | crear (P1/P2 con `fetch` doblado) |
| `apps/merchant/src/server/onboarding-signup.neon.integration.test.ts` | crear (absorbe los casos de `auth-start.neon` y `onboarding-business.neon`) |
| `apps/merchant/src/app/api/onboarding/prefill/route.ts` (+ `server/onboarding-prefill.test.ts`) | editar |
| `apps/merchant/src/server/auth-start.ts` | editar (`ownerUserInsert`) |
| `apps/merchant/src/server/locations/core.ts`, `locations/shared.ts` | editar |
| `apps/merchant/src/server/locations-integration-support.ts`, `locations.neon.integration.test.ts` | editar (token en vez de `providerSelection` Geoapify) |
| `apps/merchant/src/server/{merchant-entry-email.test,magic-link.neon.integration.test,magic-link-business-closed.neon.integration.test,onboarding-grant.neon.integration.test}.ts` | editar (sembrar con `signup` + token firmado de test) |
| `apps/merchant/src/server/auth-start.test.ts` | editar si prueba algo de `start` que se borra; lo de `normalizeEmail`/limites queda |
| `apps/merchant/src/app/api/merchant/auth/start/route.ts`, `app/api/onboarding/business/route.ts` | borrar |
| `apps/merchant/src/server/auth-start.neon.integration.test.ts`, `onboarding-business.neon.integration.test.ts` | borrar **despues** de mudar cada caso a `onboarding-signup.neon` (tabla de equivalencias en el handoff) |
| `apps/merchant/src/server/location-providers.ts` (+ `.test.ts`), `apps/merchant/src/lib/location-address.ts` (+ `.test.ts`) | borrar |
| `apps/merchant/package.json`, `pnpm-lock.yaml` | editar (`@photostructure/tz-lookup`) |
| `.env.example` | editar |
| `.claude/skills/gotchas-del-repo/SKILL.md`, `docs/PARQUEADO.md` | editar (orquestador) |

Cualquier otro importador de lo borrado que aparezca (`rg -l "location-providers|location-address|auth/start/route|onboarding/business/route" apps packages tests`)
se arregla en el mismo cambio y se lista en el handoff. Los importadores de UI (`onboarding-api.ts`,
`location-form.tsx`, `address-autofill-geoapify.tsx`, `contracts.ts`) son de GPT: si rompen el typecheck, el
implementador hace el **minimo** para compilar (tipos), sin rediseñar pantallas, y lo lista.

### Disjunta?

**No.** Toca los mismos archivos de UI que va a tocar la spec de GPT (`onboarding-api.ts`, `location-form.tsx`):
GPT trabaja sobre esta rama despues del PASS. Con las specs abiertas del INDEX no comparte archivos.

### Archivos compartidos

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` en `apps/merchant/.env.local` y en Vercel | owner | hecho (2026-10-04) |
| Este contrato | orquestador | antes de despachar |

## Definition of Done

- [ ] `POST /api/places/autocomplete` y `/details` cumplen P1/P2 (tests con `fetch` doblado que aseveran el body/URL y
      la **field mask exacta** enviados a Google).
- [ ] `POST /api/onboarding/signup` cumple P4: email nuevo → 201 + cookie + negocio/local/verificacion/suscripcion
      leidos por SQL con `provider = 'google'`, `timezone` del token y sin programa; email conocido → 200 `sent`, sin
      `set-cookie`, **0 filas nuevas** en `business`; token alterado o vencido → 422 sin filas ni mail.
- [ ] Locales: token de otro pais → 422 `address_country_mismatch`; token valido → `provider_verified`/`google`; sin
      token → `owner_typed`.
- [ ] `start` y `business` dan 404; `rg -n "geoapify" -i apps/merchant/src/server apps/merchant/src/app/api` → solo
      el literal de lectura de filas viejas en tipos (listado en el handoff).
- [ ] Ningun caso de seguridad de `auth-start.neon` y `onboarding-business.neon` se perdio: tabla «caso viejo → caso
      nuevo» en el handoff.
- [ ] `pnpm verify` en verde con Node 24 (ADR 0113), tabla final transcripta; suites Neon tocadas con
      `tools/neon-test.sh <archivos>`.

## Plan de pruebas y verificación

- [ ] **Unit `selection-token.test.ts`:** ida y vuelta; payload alterado (un digito de `latitude`) con firma vieja →
      `SelectionError`; `exp` pasado → error; token sin `.`/basura → error; sin secreto → lanza.
- [ ] **Unit `category-from-types.test.ts`:** tabla completa de la seccion Diseño; `["italian_restaurant"]` →
      restaurant; `["cafe","restaurant"]` → cafe (prioridad); `["intersection"]` → null; todo resultado pasa
      `isBusinessCategory`.
- [ ] **Unit `timezone.test.ts`:** Cuenca EC (-2.9, -79.0) → `America/Guayaquil`; Trujui AR (-34.6, -58.7) →
      `America/Argentina/Buenos_Aires`; Manaus BR (-3.1, -60.0) → `America/Manaus`; Tijuana MX (32.5, -117.0) →
      `America/Tijuana`.
- [ ] **Unit `google.test.ts` / `places-routes.test.ts`:** body de autocomplete con `includedRegionCodes`, `sessionToken`,
      `locationBias` solo con las dos cabeceras; `queryPrediction` descartada; field mask = los 5 campos; 404 de
      Google → `place_not_found`; 500 → `places_unavailable`; pais `"US"` → 422; input de 2 caracteres → 400 sin
      llamar a `fetch`.
- [ ] **Neon `onboarding-signup.neon.integration.test.ts`:** email nuevo (filas + cookie + `emailVerified=false` +
      grant); email conocido (sin cookie, 0 business nuevos, mail de acceso); dos signups simultaneos con el mismo
      email nuevo → una sola cuenta, el perdedor sin cookie; rate limit; 422 de token sin filas en `user`.
- [ ] **Neon `locations.neon.integration.test.ts`:** los tres casos de locales de la DoD.
- [ ] **Mutaciones (revisor, presupuesto 3, sobre lineas cambiadas; error a cazar: los plausibles):**

  | # | Mutacion | Oraculo esperado | Guard hermano |
  |---|---|---|---|
  | M1 | `verifySelection` acepta el payload sin comparar la firma | rojo: token alterado con `exp` vigente (unit) y 422 de signup (Neon) | `exp` no lo caza porque el caso usa un token vigente |
  | M2 | rama de email conocido de `signup` sigue al paso 7 (crea y abre sesion) | rojo: «email conocido → sin set-cookie, 0 business nuevos» | el unico de `user.email` haria fallar el insert → el caso debe aseverar el **200 `sent`** y la ausencia de cookie, no solo «no hay filas» |
  | M3 | `resolveAddress` no compara pais del token con el del negocio | rojo: «token AR en negocio UY → 422 address_country_mismatch» | ninguno: `location.country_code` no tiene FK ni check contra `business` (verificar en el esquema al medir) |

- [ ] **Comandos:** `pnpm verify`; `tools/neon-test.sh apps/merchant/src/server/onboarding-signup.neon.integration.test.ts
      apps/merchant/src/server/locations.neon.integration.test.ts` + las suites editadas.
- [ ] **Smoke contra Google real (orquestador, una vez):** `curl` a la ruta local P1 «cafe platano» y P2 de la primera
      sugerencia; respuesta con `selectionToken`. Cuesta 1 Details Essentials.
- [ ] **Manual (owner, despues de la UI de GPT y del deploy READY):** alta eligiendo un comercio real; alta eligiendo
      «santa maria y puerto de palos»; alta con un email ya registrado (llega link, no se crea nada); crear un local
      en el backoffice con el buscador.

### Limites declarados

- **Rutas de Places sin limite por IP.** El costo lo acota la cuota diaria de Google Cloud (owner); un abuso puede
  agotarla y cortar las altas del dia (P1/P2 → 503). PARQUEADO #70.
- **Atomicidad de P4:** la da `db.batch` (una transaccion en neon-http); no hay test que fuerce un fallo a mitad del
  batch.
- **El token no se puede revocar** antes de sus 2 h; solo sirve para crear el propio negocio/local y no da acceso a nada.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. PASS independiente del revisor antes de `implementada`.

## Abierto

Nada bloqueante.
