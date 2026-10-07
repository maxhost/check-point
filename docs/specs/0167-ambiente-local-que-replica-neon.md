---
spec: 0167
fecha: 2026-10-07
estado: cerrada
resumen: Implementa el ADR 0126 — Postgres 18 en Docker con roles y collation de PROD + proxy de Neon, migrador de drizzle-orm, `neonConfig` solo con host local, seed ficticio, oraculo de huellas local == PROD, candados contra PROD en `getDb` y `neon-test.sh`, `.env.local` sin servicios de PROD (R2 de desarrollo) y runbook de migracion a PROD.
disjunta: si
archivos: tools/local-db/*, packages/db/src/client.ts, packages/db/src/local.ts, packages/db/src/migrate-local.ts, packages/db/src/seed-local.ts, packages/db/package.json, package.json, tools/neon-test.sh, .env.example, docs/runbooks/migrar-prod.md
---

# 0167 — Ambiente local que replica Neon

Nivel **N2** (infraestructura de datos, roles y RLS, candados contra PROD). Decision: ADR 0126 (y su §Medido).

## Problema

`DATABASE_URL` de `apps/merchant/.env.local` y `apps/consumer/.env.local` apunta a la rama `main` de Neon = PROD,
que desde el 2026-10-07 tiene clientes reales. Correr `pnpm dev` escribe en produccion; subir un logo escribe en el
bucket R2 de PROD; el unico candado de `tools/neon-test.sh` compara la rama de CI contra ese `DATABASE_URL`, asi que
deja de proteger en cuanto `DATABASE_URL` sea local. No hay base local que se comporte como Neon.

## Alcance

**Entra:**
- Compose con `postgres:18` (Postgres 18.6) y el proxy `local-neon-http-proxy`, ambos fijados por digest.
- Base `neondb` creada con la **collation de PROD** (ver §Diseño 1 y §Abierto 1).
- Roles calcados de PROD: `neon_superuser` y `neondb_owner` (leidos de `pg_roles` el 2026-10-07, ADR 0126 §Medido).
- Migrador local con `drizzle-orm/neon-serverless/migrator` sobre el `Pool` del proxy.
- `neonConfig` para el proxy SOLO cuando el host de la URL es local.
- Seed de datos ficticios.
- Oraculo «esquema local == PROD» por huellas.
- Candado en `getDb`/`withDbTransaction`: fuera de produccion, rechaza el host de PROD.
- Candado nuevo en `tools/neon-test.sh` que no depende de `DATABASE_URL`.
- Variables locales de las dos apps sin ningun servicio que alcance a un cliente real ni a datos de PROD.
- Runbook de migracion a PROD.

**No entra:**
- Cambiar de driver, ramas Neon para desarrollo o previews de Vercel (owner, 2026-10-07).
- Copiar datos de PROD a local (owner: nunca).
- Cambiar como se migra PROD: sigue con `drizzle-kit migrate` (`pnpm db:migrate`), que ya funciona contra Neon.
- Login con Google o Apple del consumidor en local (sus redirect URIs son de PROD). Queda documentado como limite en el runbook.
- Stripe: `apps/*/.env.local` no tiene claves de Stripe hoy. Se revisa en su propia spec si hace falta billing en local.
- Mover la rama `ci-integration` o las suites `.neon.integration` a la base local.

## Diseño

### Especificación técnica

**1. Contenedores (`tools/local-db/compose.yaml`, proyecto `checkpass-local`).**
- Contenedor `pg`:
  - Imagen `postgres@sha256:fc973eb97c9fd04bfa1840e0f510719a584ccb3be8debfe6a4144637a9dfe8cf` (18.6), puerto `127.0.0.1:55432`, volumen nombrado.
  - `POSTGRES_DB=neondb`; `POSTGRES_USER=postgres` (superusuario del contenedor, solo para el proxy y el bootstrap).
  - `POSTGRES_INITDB_ARGS="--locale-provider=builtin --builtin-locale=C.UTF-8 --locale=C.UTF-8"`.
  - Es la collation de PROD, leida el 2026-10-07 por MCP: `datcollate`/`datctype`/`datlocale` = `C.UTF-8` y
    `datlocprovider` = `b` (builtin). La sonda de orden da `5dbe08e3` y `upper('ñá')` da `ÑÁ`.
  - Una base local creada con esos parametros da exactamente lo mismo; la imagen `postgres:18` por defecto
    (`en_US.utf8`, libc) da `2be342dd`. Por eso se explicaba la diferencia de hash de las restricciones (ADR 0126 §Medido).
- Contenedor `proxy`:
  - Imagen `ghcr.io/timowilhelm/local-neon-http-proxy@sha256:cd2ae14edf2feafbc3330492de5c80506f77274c3bd013154cdef697bdeb768a`,
    puerto `127.0.0.1:4444`.
  - `PG_CONNECTION_STRING` con el superusuario `postgres` del contenedor (el proxy lee los secretos SCRAM con esa
    conexion, ADR 0126 §Medido).
- `tools/local-db/init/01-roles.sql` (lo corre `docker-entrypoint-initdb.d` una sola vez):
  - `neon_superuser` NOLOGIN con `CREATEROLE CREATEDB BYPASSRLS REPLICATION` y `ADMIN` de `pg_read_all_data`,
    `pg_write_all_data`, `pg_monitor`, `pg_signal_backend`, `pg_maintain`, `pg_create_subscription` y
    `pg_signal_autovacuum_worker`.
  - `neondb_owner` LOGIN con contraseña local fija `local-solo-dev`, mismos atributos, **sin SUPERUSER**, miembro de
    `neon_superuser`. Es duenio de `neondb` y del esquema `public`.
  - `customer_reader` y `checkpass_consumer` NO se crean aca: los crean las migraciones, igual que en PROD.
- `tools/local-db/up.sh`: `docker compose up -d --wait` → migrador local (punto 3) → `ALTER ROLE checkpass_consumer LOGIN PASSWORD 'local-solo-dev'`
  (en PROD ese login se dio fuera de las migraciones) → seed (punto 5). Idempotente: correrlo dos veces deja el mismo estado.
- `tools/local-db/reset.sh`: `down -v` + `up.sh`.

**2. Cliente (`packages/db/src/local.ts` nuevo + `client.ts`).**
- `isLocalDbHost(url)`: `true` solo si el host es `db.localtest.me`, `localhost` o `127.0.0.1`.
- `configureNeonForLocal(url)`:
  - Si el host es local, fija una vez por proceso `neonConfig.fetchEndpoint = "http://<host>:4444/sql"`,
    `wsProxy = "<host>:4444/v2"`, `useSecureWebSocket = false`, `pipelineTLS = false` y `pipelineConnect = false`.
  - Con cualquier otro host no toca `neonConfig`.
- `assertNotProdOutsideProduction(url, env)`:
  - Si `env.NODE_ENV !== "production"` y `sha256(host sin -pooler)[0..12]` es igual a la constante `PROD_DB_HOST_SHA12`
    (huella del host de PROD), tira `Error("DATABASE_URL apunta a PROD fuera de produccion")`.
  - La constante es una huella, no un secreto. Se calcula una vez desde el `.env.local` actual con el parser de claves
    (CLAUDE.md §Verificacion) antes de reescribirlo.
  - Con `NODE_ENV=production` (Vercel) no hace nada: el deploy sigue llegando a PROD.
- `getDb()` y `withDbTransaction()` llaman a las dos funciones antes de crear el cliente o el `Pool`. Su contrato no cambia.

**3. Migrador local (`packages/db/src/migrate-local.ts`, script `db:local:migrate`).**
- `migrate(drizzle(pool), { migrationsFolder: "./drizzle" })` con `drizzle-orm/neon-serverless`, sobre `DATABASE_URL`
  como `neondb_owner` a traves del proxy. Usa el mismo journal y la misma `drizzle.__drizzle_migrations` que PROD.
- Rechaza (exit 1) si `isLocalDbHost` es falso: no puede migrar PROD por accidente.
- `pnpm db:migrate` (drizzle-kit, PROD) no se toca.

**4. Oraculo de huellas (`tools/local-db/huellas.sql` + `tools/local-db/huellas-prod.txt`).**
- `huellas.sql` es una consulta de solo lectura. Devuelve una fila por categoria, con conteo y `md5` del `string_agg`
  **con `collate "C"` explicito en todo `ORDER BY`**: asi la huella no depende de la collation de la base.
- Categorias:
  - Migraciones: conteo y ultima `created_at`.
  - TOS semilla.
  - Extensiones con version.
  - Columnas.
  - Indices.
  - Politicas.
  - Tablas con RLS.
  - Grants de tabla y de columna de `customer_reader` y `checkpass_consumer`.
  - Funciones.
  - Triggers.
  - Restricciones por `contype`, con nombre.
  - Atributos y membresias de los 4 roles.
  - `datcollate`/`datctype`/`datlocprovider`/`datlocale` de la base.
- `huellas-prod.txt`: la salida de `huellas.sql` en PROD, leida por el MCP de Neon (solo lectura). Se regenera en el
  runbook despues de cada migracion a PROD.
- `tools/local-db/compare.sh`: corre `huellas.sql` en local y hace `diff` contra `huellas-prod.txt`. Exit 0 solo sin
  diferencias. Es el oraculo «local == PROD».

**5. Seed (`packages/db/src/seed-local.ts`, script `db:local:seed`).**
- Rechaza si el host no es local.
- Datos ficticios con dominio `@example.test` y telefonos de la serie ficticia `+54 9 11 5555-0xxx`:
  - 2 comercios con su usuario de merchant.
  - 1 programa activo por comercio, con 3 items de catalogo.
  - 3 clientes con tarjeta, uno con sellos y un cupon disponible.
- Idempotente: cada fila tiene id fijo y se inserta con `on conflict do nothing`.
- No toca `core.terms_template`: la siembran las migraciones.

**6. `tools/neon-test.sh`.**
- El candado actual compara contra `DATABASE_URL`, que pasa a ser local, y deja de proteger. Se reemplaza:
  `sha256(host de NEON_CI_DATABASE_URL sin -pooler)[0..12]` distinto de `PROD_DB_HOST_SHA12` (la misma huella de
  `local.ts`; el script la lee de ahi con `rg`, sin duplicarla).
- Si son iguales: `ABORTADO` y exit 1, con el mismo mensaje de hoy.
- El resto del script no cambia.

**7. Variables locales (`.env.example` documenta; el owner aplica a sus `.env.local`).**
- Ambas apps: `DATABASE_URL=postgresql://neondb_owner:local-solo-dev@db.localtest.me:5432/neondb`.
  Por HTTP el puerto de la URL se ignora: medido el 2026-10-07 con 5432, 55432 y 1, los tres responden.
  Se usa 5432 por convencion. El host resuelve a 127.0.0.1.
- Merchant:
  - `EMAIL_PROVIDER=console` (ya soportado fuera de produccion, `apps/merchant/src/server/email/provider.ts`).
  - `NEON_CI_CONSUMER_DATABASE_URL` sin cambios.
- Consumer:
  - `WALLET_PROVIDER=fake` y sin secretos de Apple/Google Wallet (`packages/domain/src/server/wallet/provider.ts`).
  - VAPID: un par nuevo de desarrollo, nunca el de PROD.
- Ambas apps (las dos importan `r2.ts`): R2 del **bucket de desarrollo** (decision del owner, 2026-10-07). El owner
  deja sus 6 claves (`R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_REGION`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`) en `tools/local-db/.env.r2-dev`, ignorado por `.env.*` (`git check-ignore` verificado).
  Se copian a los `.env.local` **en el mismo paso** que `DATABASE_URL` pasa a local, nunca antes: con la base de PROD,
  un logo subido en local dejaria filas de PROD apuntando a objetos del bucket de desarrollo.
- `DATABASE_URL` de PROD deja de estar en los `.env.local` de las apps. Para el runbook vive en
  `packages/db/.env.prod.local` (ya ignorado por `.env.*`), como `DATABASE_URL_UNPOOLED`.
- Hallazgo: `CLICKSEND_*`, `TWILIO_*` y `OTP_PROVIDER` estan en `apps/consumer/.env.local`, pero ningun `.ts` de
  `apps/` ni `packages/` las lee (`rg` del 2026-10-07). Se sacan del `.env.local` local; no se toca codigo.

**8. Runbook (`docs/runbooks/migrar-prod.md`).**
- Pasos:
  1. Migracion nueva aplicada y probada en local (`db:local:migrate`, `compare.sh` muestra solo la diferencia esperada).
  2. `pnpm verify`.
  3. `pnpm db:migrate:prod`: `drizzle-kit migrate` con `dotenv -e packages/db/.env.prod.local`; imprime la huella
     del host antes de migrar.
  4. Regenerar `huellas-prod.txt` por MCP de Neon.
  5. `compare.sh` en verde.
  6. Push a `main`.
- Limites declarados: login Google/Apple del consumidor no funciona en local; Stripe no esta configurado en local.

### Arquitectura de referencia

ADR 0126 (y §Medido), ADR 0113 (Node 24), ADR 0114 (zonas: esto es tooling y servidor, de Claude).

## Archivos

| Archivo | Accion |
|---|---|
| `tools/local-db/compose.yaml`, `init/01-roles.sql`, `up.sh`, `reset.sh`, `huellas.sql`, `huellas-prod.txt`, `compare.sh` | crear |
| `packages/db/src/local.ts` + `local.test.ts` | crear |
| `packages/db/src/client.ts` | editar (dos llamadas al principio de `getDb`/`withDbTransaction`) |
| `packages/db/src/migrate-local.ts`, `seed-local.ts` | crear |
| `packages/db/package.json`, `package.json` | editar (scripts `db:local:*`, `db:migrate:prod`) |
| `tools/neon-test.sh` | editar (candado) |
| `.env.example` | editar |
| `docs/runbooks/migrar-prod.md` | crear |

### Disjunta?

Si: ninguna spec abierta toca `packages/db/src/client.ts`, `tools/neon-test.sh` ni `tools/local-db/`.

### Archivos compartidos

| Que | Quien lo deja listo | Cuando |
|---|---|---|
| `PROD_DB_HOST_SHA12` (huella del host actual de `DATABASE_URL`) | orquestador | antes de despachar |
| `huellas-prod.txt` (MCP de Neon, solo lectura) | orquestador | antes de despachar |
| Bucket R2 de desarrollo + claves | owner | antes de la verificacion manual |

## Definition of Done

- [ ] `tools/local-db/reset.sh` desde cero termina con exit 0. `select count(*) from drizzle.__drizzle_migrations` = 66
      (o el numero vigente) y la base tiene la collation de PROD.
- [ ] `tools/local-db/compare.sh` exit 0 contra `huellas-prod.txt`. Incluye restricciones con nombre, roles y collation.
- [ ] `up.sh` dos veces seguidas: segunda corrida exit 0 y `compare.sh` sigue en 0. El seed no duplica filas: conteos
      iguales antes y despues.
- [ ] `pnpm dev` de merchant y consumer contra la base local: login de merchant por email impreso en consola; alta de
      un cliente; un sello; transaccion interactiva (`withDbTransaction`) sin error.
- [ ] Con `NODE_ENV=development` y la URL de PROD, `getDb()` tira antes de abrir conexion (test unitario).
- [ ] `tools/neon-test.sh` aborta si `NEON_CI_DATABASE_URL` tiene el host de PROD, aunque `DATABASE_URL` sea local.
- [ ] `migrate-local.ts` y `seed-local.ts` rechazan un host no local (exit 1, sin conectar).
- [ ] `tools/neon-test.sh` (suites contra `ci-integration`) en verde, sin cambios en los tests.
- [ ] `pnpm verify` en verde con Node 24 (ADR 0113), con su tabla final transcripta.

## Plan de pruebas y verificación

- [ ] Unit `packages/db/src/local.test.ts`:
  - `isLocalDbHost`: hosts de Neon → falso; los tres locales → verdadero.
  - `configureNeonForLocal` con host de Neon no modifica `neonConfig`; con host local fija los 5 campos.
  - `assertNotProdOutsideProduction`: tira con el host de PROD (con y sin `-pooler`) y `NODE_ENV=development`/`test`;
    no tira con `production` ni con un host local.
- [ ] Integracion contra la base local (`up.sh` previo):
  - `checkpass_consumer` por su login recibe `permission denied for schema merchant_auth`.
  - `SET LOCAL ROLE customer_reader` sin `app.business_id` ve 0 filas de clientes.
  - Es lo medido en ADR 0126: prueba que los roles calcados no regalan permisos.
- [ ] Oraculo: `compare.sh` exit 0. **Mutaciones (revisor, 3):**
  - Base creada con `en_US.utf8`.
  - `neondb_owner` con `SUPERUSER`.
  - Una restriccion renombrada en local.
  - Cada una tiene que dar `diff` no vacio y exit ≠ 0; se revierte y vuelve a 0.
- [ ] Candados: mutar `PROD_DB_HOST_SHA12` a otra huella → el test de `assertNotProd...` falla en rojo (prueba que el
      test muerde). `neon-test.sh` con `NEON_CI_DATABASE_URL` = URL de PROD en un `.env` temporal → `ABORTADO`, sin
      llegar a `pnpm db:migrate`.
- [ ] Comandos: `tools/local-db/reset.sh`, `tools/local-db/compare.sh`, `pnpm --filter @mi-pasaporte/db test`,
      `tools/neon-test.sh`, `pnpm verify`.
- [ ] Manual (owner): con su `.env.local` nuevo, subir un logo en local → el objeto aparece en el bucket de desarrollo y
      no en el de PROD.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. `PASS` del revisor antes de `implementada`.

## Abierto

Nada que bloquee. Resueltos el 2026-10-07:
- **Collation de PROD:** `builtin` / `C.UTF-8`, leida por MCP y reproducida en local (§Diseño 1).
- **Bucket R2 de desarrollo:** creado por el owner; sus claves van en `tools/local-db/.env.r2-dev` (§Diseño 7).
  El implementador verifica que el archivo existe y tiene las 6 claves (solo nombres y largos) antes de usarlo.
