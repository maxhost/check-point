---
spec: 0117
fecha: 2026-09-30
estado: cerrada
resumen: Fase 3 del ADR 0107 (ADR 0109) — el cliente sale de merchant de una vez: proyecto Vercel propio para apps/consumer en my.checkpass.club con rol de Postgres sin merchant_auth, raiz → /wallet y el CSS que le faltaba; merchant borra pantallas, /api/public, CSS y assets del cliente y queda con un proxy /api/public/* al cliente; www manda /api/public/* al cliente; los tests de pantallas del cliente se mudan; runbook del owner paso a paso con precondicion.
disjunta: si
archivos: apps/consumer/**, apps/merchant/{next.config.ts,package.json,public/**,src/app/(consumer)/**,src/app/api/public/**,src/app/globals.css,src/server/*.test.ts (mudanza/imports)}, apps/merchant/src/server/merchant-without-consumer.test.ts, apps/public/src/legacy-routes{,.test}.ts, tools/{neon-test.sh,app-boundary.test.ts}, scripts/run-recovery-integration.mjs, docs/**
---

# 0117 — El corte: el cliente en su propio proyecto

> ADR 0107 fase 3 y ADR 0109. **Owner (2026-09-30):** sin paso por merchant («no quiero parche»); el proyecto lo crea
> el owner en el dashboard; todo en una entrega; la raiz de `my.` redirige a `/wallet`.

## Problema

`my.checkpass.club` no responde (curl exit 35, medido 2026-09-30 noche) y `www` redirige ahi los QR impresos de
Plantano y el link `/c/*` del pase: estan rotos. El cliente sigue corriendo dentro de merchant (`app/(consumer)/**`,
`app/api/public/**`, 50 archivos) aunque `apps/consumer` ya tiene copias identicas (0116). Merchant tiene acceso a
`merchant_auth` y el cliente no lo necesita (ADR 0109, medido).

## Alcance

**Entra (codigo, implementador):**

1. **Capturas de referencia ANTES de borrar nada:** `/recover` y `/wallet` (sin sesion) de merchant a 390×844, con el
   procedimiento de la 0116 (`next start`, rama de CI, interlock de host). Son el oraculo del punto 3.
2. **Consumer, raiz:** `/` → 308 a `/wallet` (en `next.config.ts` `redirects()`, funcion exportada y testeada).
3. **Consumer, CSS:** sumar al `globals.css` las reglas de elemento del de merchant que faltan, copiadas tal cual:
   lineas **40–47** (`select`; la spec decia 40–46 y dejaba afuera la `}`: hallazgo del implementador) y **235–254** (`h1`, `h2`, `p`, `label:where(…)`). Oraculo: las capturas de consumer
   quedan `cmp`-identicas a las de referencia del punto 1. Si alguna difiere tras eso, se describe y se lleva al QA del
   owner (no se persigue).
4. **Consumer, deploy:** `apps/consumer/vercel.json` como el de merchant **sin `crons`** (`installCommand`
   `pnpm install --frozen-lockfile`, `buildCommand` `pnpm build`).
5. **Merchant borra** `src/app/(consumer)/**`, `src/app/api/public/**`, `public/sw.js`, `public/wallet-logo.png` (solo
   los usa el cliente: medido) y las lineas del bloque `/* Micro-portal del consumidor (spec 0031) */` de
   `globals.css` (**3452–3772**: `.consumer-*`; el bloque `.card-preview` de antes se queda, lo usa el backoffice).
   Dependencias npm que queden sin import en `apps/merchant/src`: se sacan.
6. **Merchant conserva y agrega:** `hosts.ts`/`proxy.ts` sin cambios (308 de paginas del cliente en `business.` a
   `my.`); **proxy nuevo** en `next.config.ts` `rewrites()`: `/api/public/:path*` → `${CONSUMER_ORIGIN ?? "https://my.checkpass.club"}/api/public/:path*`
   (pases de Apple y callbacks con `business.` grabado), en una funcion exportada y testeada.
7. **`www` (`apps/public/src/legacy-routes.ts`):** `legacyRewrites` devuelve primero `/api/public/:path*` →
   `CONSUMER_API_ORIGIN` (default `https://my.checkpass.club`) y despues `/api/:path*` → merchant. `legacyOriginsFromEnv`
   lee `CONSUMER_API_ORIGIN`. Se actualizan sus tests (el «and nothing else» pasa a las dos reglas, en ese orden).
8. **Tests del cliente (ADR 0109):**
   - Los 5 co-ubicados en `app/(consumer)/**` y `app/api/public/**` se mudan con su carpeta a `apps/consumer`.
   - Todo test de merchant que **importa o lee** un archivo de `app/(consumer)/**`, `app/api/public/**` o
     `public/sw.js` se muda a `apps/consumer/src/…` (misma ruta relativa) **si no importa codigo de merchant** (sus
     supports incluidos). Medido: `enroll-existing-account`, `enroll-install-hint`, `enroll-manifest-path`,
     `loyalty-stamp-route`, `loyalty-stamp-placeholder.neon.integration`, `push-click-route`, `push-sw-click`,
     `recovery-routes`, `wallet-account-opened`, `wallet-manifest`, `wallet-pass-locations-wiring`,
     `wallet-passkit-rate-limit`.
   - Los que necesitan codigo de merchant se quedan y apuntan al archivo de `apps/consumer` por ruta relativa. Medido:
     `consumer-coupons.neon`, `consumer-marketing-opt-out.neon`, `marketing-welcome-{google,landing,triggers}.neon`,
     `web-push.neon`, `wallet-consumer-origin-wiring`, `app/backoffice/marketing/welcome-ui`.
   - **Ninguna asercion se toca**; cambian especificadores y rutas leidas. Si un test no entra en ninguna de las dos
     reglas, se declara en el handoff y se frena ese test (no se reescribe).
9. **`tools/app-boundary.test.ts`** (nuevo): ningun archivo **no-test** de `apps/merchant/src` importa algo de
   `apps/consumer` ni al reves (piso: ≥ 300 archivos escaneados en merchant y ≥ 40 en consumer).
10. **`apps/merchant/src/server/merchant-without-consumer.test.ts`** (nuevo): no existen `src/app/(consumer)`,
    `src/app/api/public`, `public/sw.js`, `public/wallet-logo.png`, y `globals.css` no tiene ningun selector `.consumer-`.
11. **`tools/neon-test.sh`** acepta rutas de consumer: `tools/neon-test.sh --app consumer src/…` (default merchant);
    `scripts/run-recovery-integration.mjs` sigue apuntando a archivos que existen.
12. Los barridos que miraban `app/(consumer)` de merchant (`consumer-opt-out-writer`, `image-cropper-contract`) siguen
    con sus pisos verdes sin bajarlos (la raiz de consumer ya esta incluida desde la 0116).

**Entra (base, orquestador, con OK del owner en el momento):** rol `checkpass_consumer` en la rama de CI y en PROD,
**creado por SQL como `neondb_owner`, NUNCA por la API ni la consola de Neon**: medido 2026-09-30 en la rama de CI, un
rol creado por la API entra como miembro de `neon_superuser` (con `BYPASSRLS` y `CREATEROLE`), lee `merchant_auth`, y
`REVOKE neon_superuser` da `permission denied`; uno creado con `CREATE ROLE` no tiene membresias ni acceso a
`merchant_auth`/`drizzle` (sonda en transaccion revertida). **Ninguna credencial pasa por el agente:**
- **Rama de CI:** el orquestador crea `checkpass_consumer` **`NOLOGIN`** por `run_sql` (no hace falta contraseña para
  medir privilegios ni para M6).
- **PROD:** el owner corre en el editor SQL de la consola de Neon (rama `main`) el bloque de abajo con una contraseña
  propia, y arma la URL del rol reemplazando usuario y contraseña en la URL pooled de `neondb_owner`.

```sql
CREATE ROLE checkpass_consumer LOGIN PASSWORD '<contraseña del owner>';
GRANT USAGE ON SCHEMA core, consumer TO checkpass_consumer;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core, consumer TO checkpass_consumer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA core, consumer TO checkpass_consumer;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA core, consumer
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO checkpass_consumer;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA core, consumer
  GRANT USAGE, SELECT ON SEQUENCES TO checkpass_consumer;
-- Agregado en PROD 2026-09-30 tras el corte: 4 tablas tienen RLS con politicas solo para
-- customer_reader; sin esto el rol ve 0 filas ("programa no disponible").
ALTER ROLE checkpass_consumer BYPASSRLS;
```

`neondb_owner` es el dueño unico de las 57 tablas (medido en la rama de CI). **Nada** en `merchant_auth` ni en
`drizzle`. El orquestador verifica en cada rama con `pg_auth_members` (sin membresias), `has_schema_privilege` y
`has_table_privilege` (`merchant_auth`/`drizzle` → `false`; las 52 tablas de `core`/`consumer` con DML → `true`).

**Entra (owner, runbook de abajo):** proyecto Vercel, variables, dominio, env de merchant y de `www`, Stripe/secrets,
aviso a Plantano.

**No entra:** mover el worker de Wallet (se queda en merchant, ADR 0109 §5); mover los 28 modulos solo-cliente; podar
`tokens.css` duplicado; enrutamiento por host en consumer (las paginas de merchant dan 404 ahi); features del cliente.

## Runbook del owner — cada paso con su precondicion (LECCIONES 2026-09-30)

El orquestador verifica la precondicion de cada paso y entrega el siguiente **de a uno**.

**Orden corregido tras la revision (hallazgo del revisor, verificado):** el codigo de la 0117 NO va a `main` hasta que
`my.` responda. Al desplegarse, merchant y `www` reenvian `/api/public/*` a `my.`, y el backoffice pide en relativo
logos e imagenes por `/api/public/...` (`brand-kit/data.ts:71`, `catalog/core.ts:74`, `client-view.ts:132`, …): con `my.`
caido se romperian pantallas de comercios. Por eso: se pushea la rama `motor` (no `main`); el proyecto del cliente
usa **Production Branch = `motor`** durante R2–R4; con `my.` verificado, el orquestador pushea `motor` → `main` (R4b) y
el owner vuelve la Production Branch del cliente a `main` (R4c).

| # | Paso (owner) | Precondicion que verifica el orquestador antes de darlo |
|---|---|---|
| R1 | Neon → rama `main` → SQL Editor: correr el bloque SQL de arriba con tu contraseña; armar la URL del rol | 0117 con PASS y pusheada a `origin/motor` (NO a `main`); despues de R1 el orquestador verifica sin membresias y `false` sobre `merchant_auth` antes de dar R2 |
| R2 | Vercel → Add New Project → repo `maxhost/check-point`, **Root Directory `apps/consumer`**, framework Next.js, **Production Branch `motor`** (Settings → Git). Variables (Production): `DATABASE_URL` = URL de R1; `CONSUMER_ORIGIN=https://my.checkpass.club`; y **copiadas de merchant**: `APPLE_PASS_CERT_P12`, `APPLE_PASS_CERT_PASSWORD`, `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_WWDR_CERT`, `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_JSON`, `WALLET_PROVIDER`, `WALLET_PUSH_CHANNEL`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_SUBJECT`, `OTP_PROVIDER`, `OTP_ENCRYPTION_KEY`, `OTP_HMAC_SECRET`, `RECOVERY_ENABLED`, `CLICKSEND_*`, `TWILIO_*`, `R2_*`, `STOCK_PROVIDER`, `PEXELS_API_KEY`, `WALLET_PASSKIT_RATE_*` (las que existan en merchant). Deploy | R1 verificado (rol sin membresias, `false` en `merchant_auth`) |
| R3 | Abrir en el **telefono** la URL `*.vercel.app` del proyecto: `/wallet`, `/recover`, un `/enroll/<programa real>` | `curl` a `<vercel.app>/api/health` 200, `/` 308 → `/wallet`, `/api/public/consumer/coupons` 401 |
| R4 | Vercel (cliente) → Domains → agregar `my.checkpass.club` | owner confirmo R3 en el telefono |
| R4b | (orquestador) push `motor` → `main`; deploys de merchant y public `success` con el sha | `my./api/health` 200 con certificado |
| R4c | Vercel (cliente) → Settings → Git → Production Branch = `main` | R4b verificado: `business./api/public/consumer/coupons` 401 (proxy a `my.`) y un logo del backoffice 200 |
| R5 | Merchant (Production): `MERCHANT_ORIGIN=https://business.checkpass.club`, `CONSUMER_ORIGIN=https://my.checkpass.club`, `BETTER_AUTH_URL=https://business.checkpass.club`, `BETTER_AUTH_TRUSTED_ORIGINS=https://www.checkpass.club,https://checkpass.club`; borrar `PUBLIC_APP_ORIGIN`; Redeploy | R4c hecho y `my./api/health` 200 |
| R6 | Public (`www`): `CONSUMER_API_ORIGIN=https://my.checkpass.club` (opcional: es el default); Redeploy | `business./wallet` 308 → `my./wallet`; `business./api/public/consumer/coupons` 401 via proxy |
| R7 | Stripe webhook y secrets `MARKETING_TICK_ENDPOINT`/`WALLET_PUSH_ENDPOINT`/`CATALOG_IMPORT_RECONCILE_ENDPOINT` → `business.` | `www/api/public/consumer/coupons` 401 y `www/enroll/<id>` 308 → `my.` |
| R8 | Avisar a Plantano («entren por business.checkpass.club; reingresar una vez») | R5–R7 verificados |

Vuelta atras de R4: quitar el dominio del proyecto del cliente (vuelve a «no responde», el estado de hoy).

## Definition of Done (codigo)

- [ ] Capturas de referencia de merchant tomadas ANTES del borrado (ruta en la bitacora); despues del punto 3, `cmp`
      de las de consumer contra ellas (resultado transcripto).
- [ ] `ls` de lo borrado en merchant → no existe; `rg -n '\.consumer-' apps/merchant/src/app/globals.css` → vacio.
- [ ] Los 12 tests mudados existen bajo `apps/consumer/src` y no en merchant; los 8 que se quedan importan de
      `apps/consumer`. **Conteo total de tests (root) igual al de partida** + los nuevos de esta spec (anotar cifras por
      proyecto antes y despues; cada diferencia explicada).
- [ ] `tools/app-boundary.test.ts`, `merchant-without-consumer.test.ts`, los tests de `redirects()` de consumer, de
      `rewrites()` de merchant y de `legacy-routes` verdes.
- [ ] `tools/neon-test.sh --app consumer src/server/loyalty-stamp-placeholder.neon.integration.test.ts` y
      `tools/neon-test.sh src/server/consumer-coupons.neon.integration.test.ts` → verdes.
- [ ] Gates de root: typecheck, lint, test, format:check, build (`TURBO_FORCE=1`), `test:e2e`.
- [ ] `pnpm install --frozen-lockfile` funciona (si el lockfile cambia, con los 90 binarios de plataforma intactos).

## DoD (base y PROD, orquestador)

- [ ] Rama de CI: rol `NOLOGIN` creado por SQL; sin membresias; `has_*_privilege` → `false` en `merchant_auth` y
      `drizzle`, `true` (DML) en las 52 tablas de `core`/`consumer`. M6 mutada y revertida sobre ese rol.
      **Limite declarado:** no se levanta consumer con el rol en CI (no hay contraseña sin pasar una credencial por el
      agente); la prueba con conexion real es R3 en PROD (telefono, enrolarse).
- [ ] PROD: las mismas sondas de privilegios tras R1; R1–R8 verificados con `curl --resolve <host>:443:216.198.79.1`.

## Plan de pruebas y verificación

Presupuesto: **6 mutaciones**. Clase de error a cazar: los plausibles del corte — una pantalla o ruta del cliente que
sobrevive en merchant, un import que cruza apps en codigo de produccion, un proxy que pierde `/api/public` (pases ya
emitidos), la raiz sin redirigir, el rol con acceso a `merchant_auth`, CSS de cliente que queda en merchant.

| # | Mutacion | Oraculo | Guard hermano |
|---|---|---|---|
| M1 | dejar `apps/merchant/src/app/api/public/push/click/route.ts` | `merchant-without-consumer.test.ts` rojo nombrando la carpeta | typecheck/build no (compila) |
| M2 | en un archivo **no-test** de merchant, importar algo de `apps/consumer/src` | `tools/app-boundary.test.ts` rojo nombrando archivo | ninguno |
| M3 | quitar la regla `/api/public/:path*` de los `rewrites()` de merchant | su test rojo | ninguno (en dev nadie llama) |
| M4 | invertir el orden de `legacyRewrites` (merchant primero) | test de `legacy-routes` rojo («primero `/api/public`») | ninguno: con el orden mal `/api/public` iria a merchant y daria 404 |
| M5 | borrar el `redirects()` de `/` en consumer | su test rojo | ninguno |
| M6 | (rama de CI, orquestador o revisor) `GRANT USAGE ON SCHEMA merchant_auth` + `SELECT` sobre `merchant_auth."user"` al rol | la sonda negativa deja de dar `permission denied` → rojo; despues `REVOKE` y re-sonda | ninguno |

Protocolo de la skill `protocolo-de-verificacion` §2. M6 se revierte con `REVOKE` y se re-mide la sonda.

**Limites declarados:** la igualdad visual se mide en dos pantallas sin sesion; el resto lo ve el owner en R3. El rol se
prueba por sondas y por las rutas GET; un `POST` real del cliente en PROD lo hace el owner en R3 (enrolarse).

## Handoff requerido

Un implementador (codigo, puntos 1–12) y un revisor. Con el PASS: push de la rama `motor` (no `main`), rol en CI (DoD base), rol en PROD con
OK del owner, y runbook R1–R8 de a un paso (R4b = push a `main`).

## Abierto

Nada que bloquee.
