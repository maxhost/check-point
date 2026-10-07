# Runbook — base local y migracion a PROD

Spec 0167, ADR 0126. Desde el 2026-10-07 la rama `main` de Neon es PROD con clientes reales: **en local nada habla
con ella**. Se desarrolla contra una base Postgres 18.6 en Docker que replica Neon (roles, collation, esquema), y una
migracion llega a PROD solo como paso explicito de este runbook.

## 1. La base local

| Comando | Que hace |
|---|---|
| `tools/local-db/up.sh` (o `pnpm db:local:up`) | Levanta `pg` + `proxy` (proyecto Docker `checkpass-local`), aplica las migraciones, da login local a `checkpass_consumer` y siembra datos ficticios. Idempotente. |
| `tools/local-db/reset.sh` | Borra el volumen y repite `up.sh` desde cero. |
| `tools/local-db/compare.sh` | Oraculo «esquema local == PROD»: `huellas.sql` en local contra `huellas-prod.txt`. Exit 0 solo sin diferencias. |
| `node tools/local-db/check-env.ts` | Las variables locales quedaron como pide el §2 (solo claves y largos). |
| `tools/local-db/check-roles.sh` | Los roles calcados no regalan permisos (`checkpass_consumer` no lee `merchant_auth`; `customer_reader` ve solo su comercio). Y `getDb`/`withDbTransaction` andan por el proxy. |

- URL de las apps: `postgresql://neondb_owner:local-solo-dev@db.localtest.me:5432/neondb`. `db.localtest.me`
  resuelve a 127.0.0.1. Por HTTP el puerto de la URL se ignora; el proxy esta en `127.0.0.1:4444`. Postgres directo
  esta en `127.0.0.1:55432` (superusuario `postgres` / `local-solo-dev`, solo para depurar).
- `getDb()` y `withDbTransaction()` configuran el driver para el proxy cuando el host es local, y **tiran** si reciben
  el endpoint de PROD con `NODE_ENV` distinto de `production` (`packages/db/src/local.ts`).
- Datos sembrados (todos ficticios):
  - Merchants: `owner-cafe@example.test` (Café Ejemplo, Sellos) y `owner-panaderia@example.test` (Panadería Prueba, Puntos).
  - Clientes: `+54 9 11 5555-0001` (con 4 sellos y un cupon de bienvenida), `-0002`, `-0003`.
  - Login de merchant: con `EMAIL_PROVIDER=console` el enlace sale en la consola de `pnpm dev`.

## 2. Variables locales (las aplica el owner; ningun agente puede escribir `.env*`)

**Orden obligatorio** (asi el runbook nunca queda sin la URL de PROD, y ningun logo local cae en el bucket de PROD
con filas de PROD):

1. [ ] `packages/db/.env.prod.local`: crear con la URL **directa** (host sin `-pooler`) de la rama `main`:
   ```
   DATABASE_URL_UNPOOLED=<la URL de PROD que hoy esta en DATABASE_URL, con el host sin -pooler>
   ```
2. [ ] `apps/merchant/.env.local` y `apps/consumer/.env.local`, **en el mismo paso**: `DATABASE_URL` local y R2 de
   desarrollo (las 6 claves de `tools/local-db/.env.r2-dev`, copiadas tal cual).
3. [ ] El resto de cada archivo, segun los bloques de abajo.
4. [ ] Verificar: `node tools/local-db/check-env.ts` (imprime claves, largos y veredictos; nunca valores). Exit 0
   solo si ninguna `DATABASE_URL*` de las apps es PROD, las dos usan la base local, las 6 claves R2 son las de
   desarrollo, el consumer no tiene secretos de wallet ni `CLICKSEND_*`/`TWILIO_*`/`OTP_PROVIDER`, y
   `packages/db/.env.prod.local` tiene la URL directa de PROD.

**`apps/merchant/.env.local`**

```
DATABASE_URL=postgresql://neondb_owner:local-solo-dev@db.localtest.me:5432/neondb
EMAIL_PROVIDER=console
R2_ACCOUNT_ID=<de tools/local-db/.env.r2-dev>
R2_BUCKET=<de tools/local-db/.env.r2-dev>
R2_ENDPOINT=<de tools/local-db/.env.r2-dev>
R2_REGION=<de tools/local-db/.env.r2-dev>
R2_ACCESS_KEY_ID=<de tools/local-db/.env.r2-dev>
R2_SECRET_ACCESS_KEY=<de tools/local-db/.env.r2-dev>
# Sin cambios: NEON_CI_DATABASE_URL, NEON_CI_DATABASE_URL_UNPOOLED, NEON_CI_CONSUMER_DATABASE_URL (rama de CI).
# Con EMAIL_PROVIDER=console, RESEND_API_KEY no se usa; puede quedar o borrarse.
```

**`apps/consumer/.env.local`**

```
DATABASE_URL=postgresql://neondb_owner:local-solo-dev@db.localtest.me:5432/neondb
WALLET_PROVIDER=fake
R2_ACCOUNT_ID=<de tools/local-db/.env.r2-dev>
R2_BUCKET=<de tools/local-db/.env.r2-dev>
R2_ENDPOINT=<de tools/local-db/.env.r2-dev>
R2_REGION=<de tools/local-db/.env.r2-dev>
R2_ACCESS_KEY_ID=<de tools/local-db/.env.r2-dev>
R2_SECRET_ACCESS_KEY=<de tools/local-db/.env.r2-dev>
WEB_PUSH_VAPID_PUBLIC_KEY=<par NUEVO de desarrollo, ver abajo>
WEB_PUSH_VAPID_PRIVATE_KEY=<par NUEVO de desarrollo>
```

Y **borrar** del consumer:
- Wallet de PROD: `APPLE_PASS_CERT_P12`, `APPLE_PASS_CERT_PASSWORD`, `APPLE_PASS_TYPE_ID`, `APPLE_WWDR_CERT`,
  `APPLE_TEAM_ID`, `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_JSON` (y `APPLE_APNS_*` si estuvieran). Con los
  secretos presentes el proveedor real gana aunque `WALLET_PROVIDER=fake` (`packages/domain/src/server/wallet/provider.ts`).
- `CLICKSEND_*`, `TWILIO_*`, `OTP_PROVIDER`: ningun `.ts` de `apps/` ni `packages/` las lee.
- El par VAPID de PROD (se reemplaza por el de desarrollo).

Par VAPID de desarrollo (P-256, mismo formato que `packages/domain/src/server/push/vapid.ts`), en una terminal propia:

```
node -e 'const c=require("node:crypto");const {publicKey,privateKey}=c.generateKeyPairSync("ec",{namedCurve:"prime256v1"});const p=publicKey.export({format:"jwk"});console.log("WEB_PUSH_VAPID_PUBLIC_KEY="+Buffer.concat([Buffer.from([4]),Buffer.from(p.x,"base64url"),Buffer.from(p.y,"base64url")]).toString("base64url"));console.log("WEB_PUSH_VAPID_PRIVATE_KEY="+privateKey.export({format:"jwk"}).d)'
```

## 3. Migrar a PROD

Paso explicito, despues del PASS del revisor de la spec que trae la migracion. **El orden migracion/deploy lo decide
el codigo que ya corre en PROD** (skill `gotchas-del-repo`): una migracion aditiva puede ir antes del push; una que
archiva, borra o renombra algo que el codigo viejo lee va despues.

1. [ ] Migracion nueva aplicada y probada en local: `tools/local-db/up.sh` (o `pnpm db:local:migrate` con la URL local
   en el entorno). `tools/local-db/compare.sh` muestra **solo** la diferencia esperada (las categorias que la
   migracion toca y `migraciones`).
2. [ ] `pnpm verify` en verde.
3. [ ] `pnpm db:migrate:prod`: `drizzle-kit migrate` con `DATABASE_URL_UNPOOLED` de `packages/db/.env.prod.local`.
   Antes de migrar imprime la huella del endpoint y aborta si no es la de PROD (`PROD_DB_ENDPOINT_SHA12`) o si el
   host es `-pooler`. Nunca imprime la URL.
4. [ ] Regenerar `tools/local-db/huellas-prod.txt`: correr `tools/local-db/huellas.sql` en PROD por el MCP de Neon
   (`run_sql`, solo lectura) y guardar la salida, una fila por linea.
5. [ ] `tools/local-db/compare.sh` en verde (local == PROD de nuevo).
6. [ ] Push a `main` (despliega).

## 4. Limites declarados

- Login con Google o Apple del consumidor **no funciona en local**: sus redirect URIs son de PROD.
- Stripe no esta configurado en local (`apps/*/.env.local` no tiene claves de Stripe).
- Las suites `.neon.integration` siguen yendo contra la rama `ci-integration` (`tools/neon-test.sh`), no contra la
  base local. Su candado contra PROD ya no depende de `DATABASE_URL`: compara la huella del endpoint de cada
  `NEON_CI_*` con `PROD_DB_ENDPOINT_SHA12`.
