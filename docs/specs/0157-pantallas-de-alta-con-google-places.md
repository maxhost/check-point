---
spec: 0157
fecha: 2026-10-04
estado: cerrada
resumen: Wizard de alta en tres pasos y buscador de Google Places para locales sobre el contrato 0155; retira la UI de Geoapify y el alta anterior.
disjunta: no
archivos: apps/merchant/src/app/[locale]/(merchant)/business/onboarding/**, apps/merchant/src/app/backoffice/locations/**, apps/merchant/src/app/components/**, apps/merchant/src/app/globals.css, apps/merchant/src/lib/location-address*, tests/e2e/**
---

# 0157 — Pantallas del alta con Google Places

## Problema

- `onboarding-api.ts` llama a `/api/merchant/auth/start` y `/api/onboarding/business`, ambas borradas por la 0155.
- `onboarding-wizard.tsx` pide email antes del negocio y exige programa y QR antes de terminar; el ADR 0121 ordena negocio, email y confirmación.
- `location-form.tsx` envía la selección de Geoapify con coordenadas, mientras locales ahora esperan `address.selectionToken`.

## Alcance

**Entra:** wizard nuevo; buscador reutilizable con P1/P2, categorías P3 y alta P4; login existente; locales con dirección elegida o escrita; retiro de componentes, helper y CSS de Geoapify, programa y QR del wizard.

**No entra:** API, servidor, programa desde el panel, checklist posterior ni migraciones.

## Diseño

El paso 1 carga P3, busca con `trim` de 3–120 caracteres tras 300 ms y crea un UUID v4 por sesión. Todos los P1 y el P2 de esa búsqueda comparten token; elegir o pulsar «Cambiar» inicia otro. P2 precarga nombre solo para `kind: business`, categoría sugerida si aparece en P3 y dirección de solo lectura. Se exige nombre de 1–120 caracteres y categoría. El paso 2 pide email y envía P4 con `business: { name, categoryGcid, selectionToken }`. Un 201 muestra confirmación y acceso a `/backoffice`; `verificationSent: false` ofrece reenvío. Un 200 `sent` muestra el enlace para cuenta existente y descarta los datos del negocio. Un 422 `invalid_selection` devuelve al buscador; errores de email y negocio se muestran junto al campo; 429/503 conservan los datos y permiten reintentar. El acceso «Ya tengo cuenta» conserva `POST /api/merchant/auth/login`.

Al cargar, `GET /api/onboarding/state`: sin sesión empieza en negocio; con sesión navega al panel. No se restauran programa ni QR.

El formulario de locales usa P1/P2. Una elección envía `address: { label, selectionToken }`; escribir después borra el token y envía solo `label`. Un PATCH de solo nombre omite `address`. `invalid_selection` y `address_country_mismatch` muestran el mensaje de la API y mantienen el formulario.

## Archivos

| Archivo | Acción |
|---|---|
| `business/onboarding/_components/{onboarding-wizard,business-step,account-step,wizard-shared}.tsx`, `_lib/{contracts,onboarding-api,onboarding-flow}.ts` y tests | editar |
| `app/components/places-search.tsx`, `backoffice/locations/{location-form,locations-console}.tsx` | crear / editar |
| `address-autofill-geoapify.tsx`, `address-autofill.tsx`, `address-combobox.tsx`, `program-step.tsx`, `program-impact.tsx`, `complete-step.tsx`, `lib/location-address.ts` y test | borrar |
| `app/globals.css`, `business/onboarding/onboarding.css`, e2e afectados | editar |

**Disjunta?** No: sigue la 0155 del servidor, ya revisada en `onboarding-google`. El owner pidió un único push conjunto; la reserva queda en commit local hasta incluir toda la UI.

## Definition of Done

- [x] Pruebas del adaptador comprueban rutas P1–P4, cuerpo con `selectionToken`, resultado 201/200 y errores.
- [x] Pruebas de flujo comprueban el paso inicial y redirección de sesión; prueba de locales comprueba token y edición manual. El PATCH de solo nombre se verifica por `addressChanged: false` y por el spread condicional de `locations-console.tsx`.
- [x] `rg -n -i 'geoapify|/api/merchant/auth/start|/api/onboarding/business' apps/merchant/src/app apps/merchant/src/lib` → vacío.
- [ ] `pnpm verify` con Node 24 en verde. Verificación de navegador del wizard y locales: 2/2 pasan.

## Mutaciones — presupuesto: 2

| # | Mutación | Oráculo rojo |
|---|---|---|
| 1 | P2 recibe un `sessionToken` nuevo | test del buscador exige el mismo token de P1 |
| 2 | `addressBody` omite `selectionToken` | test de locales exige el token elegido |

**Protocolo:** anotar salida roja, revertir la mutación y comprobar el diff limpio antes de cerrar.

## Declarado afuera

- Google real en e2e: P1/P2 se prueban con respuestas HTTP controladas; la 0155 ya hizo smoke real.
- QA de entrega de email y uso en teléfono real: posterior al deploy.

## Handoff

Un implementador (GPT), revisor independiente antes de marcar `implementada`.

## Abierto

Nada bloqueante.

## Resultado local (2026-10-04)

Wizard, locales y retiro de Geoapify terminados sobre `onboarding-google`. Typecheck y lint pasan; 9 pruebas unitarias dirigidas y 2 de navegador pasan. Build Webpack de Merchant pasa. `pnpm verify` sigue rojo por build Turbopack (`driver.css`: bind de puerto `Operation not permitted`) y Neon CI: la columna `merchant_auth.session.onboarding_grant_until` falta en esa rama, pero el servidor 0155 aún la usa; 39 suites fallan y 50 tests fallan. El formato detectado en dos archivos se corrigió después de esa corrida. No se marca `implementada` ni se pushea con el gate rojo.

Bitácora de mutaciones (anotada antes de medir):

| Mutación | SHA limpio inicial | Resultado | Restauración |
|---|---|---|---|
| M1: P2 usa UUID distinto a P1 | `6b883be67259fb38f178a9c8327869ab4df08742` | `playwright test --grep 'alta en tres pasos'`: 1 rojo, `expect(tokens[0]).toBe(tokens[1])`; los dos UUID difieren | SHA restaurado igual |
| M2: `addressBody` omite `selectionToken` | `71065f4465b1f4c1ca25977c9ea894b7353089c8` | `vitest run location-form.test.ts`: 1 rojo, falta `selectionToken: "signed-place"` | SHA restaurado igual |
