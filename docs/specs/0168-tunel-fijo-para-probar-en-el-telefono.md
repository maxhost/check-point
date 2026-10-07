---
spec: 0168
fecha: 2026-10-07
estado: implementada
resumen: Implementa el ADR 0127 — Cloudflare Tunnel con nombre (`dev-business.` → merchant :3001, `dev-my.` → consumer :3000), merchant en el puerto 3001, `allowedDevOrigins` con los dos hosts, `check-env.ts` rechaza cualquier origen de PROD en los `.env.local` y exige `CONSUMER_ORIGIN` en merchant, y runbook para el telefono (PWA + push).
disjunta: si
archivos: tools/tunnel/config.yml, tools/tunnel/up.sh, package.json, apps/merchant/package.json, apps/merchant/next.config.ts, apps/consumer/next.config.ts, tools/local-db/check-env.ts, tools/local-db/check-env.test.ts, docs/runbooks/tunel-dev.md
---

# 0168 — Tunel fijo para probar el ambiente local en el telefono

Nivel **N1** (tooling local, sin migraciones, sin logica de auth: solo configuracion). Decisiones del owner en el
ADR 0127 (tunel con nombre, subdominios fijos, acceso abierto).

## Problema

Medido el 2026-10-07 (parser de Node que imprime solo hostnames de PROD o «otro», nunca valores):

- `apps/merchant/.env.local` `BETTER_AUTH_URL` = `business.checkpass.club` → el link de login que imprime
  `EMAIL_PROVIDER=console` lleva a PROD (`apps/merchant/src/server/auth.ts:59`).
- `apps/consumer/.env.local` `CONSUMER_ORIGIN` = `my.checkpass.club` → pases, QR y callbacks OAuth se emiten hacia PROD
  (`packages/domain/src/server/hosts.ts:115`, `apps/consumer/src/server/oauth-callback.ts:153`).
- `apps/merchant/.env.local` sin `CONSUMER_ORIGIN` → el rewrite de `/api/public/*` va a `https://my.checkpass.club`
  (`apps/merchant/next.config.ts:16`). `tools/local-db/check-env.ts` no revisa ninguno de estos.
- Merchant y consumer arrancan los dos en `:3000` (`apps/merchant/package.json` `next dev` sin puerto;
  `apps/consumer/package.json` `--port 3000`).
- El telefono no alcanza `localhost`; por IP de la red es `http` y no instala la PWA ni acepta push.

## Alcance

**Entra:** tunel con nombre `checkpass-dev` y su config de ingress en el repo; `pnpm dev:tunnel`; merchant en `:3001`;
`allowedDevOrigins`; reglas nuevas de `check-env.ts` con su test; runbook (alta unica del owner, uso diario, telefono).

**No entra:** wallet real en el telefono (credenciales de desarrollo de Apple/Google, decision abierta del owner);
login social del cliente por el tunel (registrar `dev-my.` en Google/Apple); Cloudflare Access (owner: acceso abierto);
par VAPID de desarrollo (ya pedido por la spec 0167 §7, sigue como paso del owner); `apps/platform` y `apps/public`.

## Diseño

### 1. Tunel (`tools/tunnel/`)

- `config.yml` (sin secretos; las credenciales del tunel viven en `~/.cloudflared/`, fuera del repo):

  ```yaml
  tunnel: checkpass-dev
  ingress:
    - hostname: dev-business.checkpass.club
      service: http://localhost:3001
    - hostname: dev-my.checkpass.club
      service: http://localhost:3000
    - service: http_status:404
  ```
- `up.sh`: si `cloudflared` no esta en el PATH → `ABORTADO: falta cloudflared (docs/runbooks/tunel-dev.md §1)` exit 1.
  Si no existe `~/.cloudflared/cert.pem` → `ABORTADO: falta cloudflared tunnel login (runbook §1)` exit 1. Si no,
  `exec cloudflared tunnel --config tools/tunnel/config.yml run checkpass-dev`. Si `cloudflared` necesita
  `credentials-file` explicito, se resuelve en el script con el UUID de `cloudflared tunnel info checkpass-dev`
  (medido, no supuesto, y transcripto en el cierre).
- Root `package.json`: `"dev:tunnel": "tools/tunnel/up.sh"`.

### 2. Puertos y `allowedDevOrigins`

- `apps/merchant/package.json`: `"dev": "next dev --port 3001"`.
- `apps/merchant/next.config.ts`: `allowedDevOrigins` suma `"dev-business.checkpass.club"`.
- `apps/consumer/next.config.ts`: suma `"dev-my.checkpass.club"`. Las entradas existentes quedan.

### 3. `check-env.ts`: origenes

- Hosts de PROD: `checkpass.club`, `www.checkpass.club`, `business.checkpass.club`, `my.checkpass.club`.
- En cada `.env.local` de las dos apps, toda clave que matchee `/(ORIGIN|ORIGINS|_URL)$/` y no `/DATABASE/` se parte
  por `,` y **ningun** host puede ser de PROD: `MAL <app> <CLAVE> no apunta a PROD`. Un valor que no es URL tambien
  es `MAL` (falla cerrado). Nunca imprime el valor, solo la clave.
- Merchant: `BETTER_AUTH_URL` === `https://dev-business.checkpass.club` y `CONSUMER_ORIGIN` ===
  `https://dev-my.checkpass.club` (sin ella el rewrite cae a PROD).
- Consumer: `CONSUMER_ORIGIN` === `https://dev-my.checkpass.club`.
- Para poder testearlo: `CHECK_ENV_ROOT` (opcional) reemplaza `ROOT`; sin ella, todo igual que hoy.
- `check-env.test.ts`: arbol temporal con `packages/db/src/local.ts` copiado, `.env.r2-dev` y `.env.local` ficticios.
  Casos: (a) todo bien → exit 0; (b) merchant `BETTER_AUTH_URL=https://business.checkpass.club` → exit 1 y la linea
  `MAL … BETTER_AUTH_URL no apunta a PROD`; (c) merchant sin `CONSUMER_ORIGIN` → exit 1; (d) un
  `BETTER_AUTH_TRUSTED_ORIGINS` con `https://www.checkpass.club` como segundo elemento → exit 1; (e) la salida nunca
  contiene un valor sembrado (centinela unico en un valor).

### 4. Variables del owner (las aplica el owner: los agentes no escriben `.env*`)

- `apps/merchant/.env.local`: `BETTER_AUTH_URL=https://dev-business.checkpass.club`,
  `CONSUMER_ORIGIN=https://dev-my.checkpass.club`.
- `apps/consumer/.env.local`: `CONSUMER_ORIGIN=https://dev-my.checkpass.club`.
- El orquestador puede darle un script de scratchpad que solo reemplaza esas lineas (como en la spec 0167).

### 5. Runbook `docs/runbooks/tunel-dev.md`

- §1 Alta unica (owner): `brew install cloudflared`; `cloudflared tunnel login` (navegador, elegir `checkpass.club`);
  `cloudflared tunnel create checkpass-dev`; `cloudflared tunnel route dns checkpass-dev dev-business.checkpass.club`
  y lo mismo con `dev-my.checkpass.club`.
- §2 Uso diario: base local arriba (`pnpm db:local:up`), `pnpm dev:tunnel`, `pnpm dev:merchant`, `pnpm dev:consumer`,
  cada uno en su terminal. Trabajar siempre por `https://dev-business.` / `https://dev-my.`, tambien en la compu.
- §3 Telefono: abrir `https://dev-my.checkpass.club`, agregar a pantalla de inicio (iPhone: Compartir → Agregar a
  inicio; push en iOS solo desde la app instalada), aceptar notificaciones.
- §4 Que no se puede: wallet real (pase autofirmado: el iPhone lo rechaza), login con Google/Apple del cliente.

## Archivos

| Archivo | Accion |
|---|---|
| `tools/tunnel/config.yml`, `tools/tunnel/up.sh` | crear |
| `package.json` (root) | editar: `dev:tunnel` |
| `apps/merchant/package.json` | editar: `--port 3001` |
| `apps/merchant/next.config.ts`, `apps/consumer/next.config.ts` | editar: `allowedDevOrigins` |
| `tools/local-db/check-env.ts` | editar: §3 y `CHECK_ENV_ROOT` |
| `tools/local-db/check-env.test.ts` | crear |
| `docs/runbooks/tunel-dev.md` | crear |

**Disjunta?** Si (`next.config.ts` de merchant/consumer es zona Claude por ser config de servidor).

## Definition of Done

- [ ] `pnpm vitest run --project tools tools/local-db/check-env.test.ts` verde, 5 casos.
- [ ] `node tools/local-db/check-env.ts` con los `.env` reales: **exit 1** antes del §4 del owner (lineas `MAL` de
      `BETTER_AUTH_URL` y `CONSUMER_ORIGIN`) y **exit 0** despues. Se transcriben las dos salidas.
- [ ] `tools/tunnel/up.sh` sin `cloudflared` en el PATH → exit 1 con el mensaje del §1 (PATH recortado).
- [ ] Con el alta del owner hecha: `dig +short dev-my.checkpass.club` y `dev-business.` resuelven a Cloudflare.
- [ ] Con tunel + las dos apps arriba: `curl -s -o /dev/null -w '%{http_code}' https://dev-my.checkpass.club/wallet` y
      `https://dev-business.checkpass.club/es/business/login` (o la ruta real del login, leida del codigo) → `200`.
- [ ] El link de login de merchant que sale en la consola empieza con `https://dev-business.checkpass.club/`.
- [ ] QA del owner en el telefono: PWA instalada desde `dev-my.`, push aceptado, y
      `select count(*) from consumer.web_push_subscription` en la base LOCAL sube en 1.
- [ ] `pnpm verify` en verde con Node 24, una sola vez al final, con su tabla final transcripta.
- [ ] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: 2. Clase: el candado de origenes que deja pasar PROD

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `check-env.ts`: comparar solo el primer elemento de la lista separada por `,` | caso (d) de `check-env.test.ts` |
| 2 | `check-env.ts`: quitar la exigencia de `CONSUMER_ORIGIN` en merchant | caso (c) |

**Protocolo:** skill `protocolo-de-verificacion` (shasum limpio, bitacora antes de medir, etiqueta `MUTATION`, revertir
con diff). **Corte:** dos vueltas seguidas de «el fix abrio la siguiente» → al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- Que el push LLEGUE al telefono: no hay hoy un disparador manual de push en local; se verifica la suscripcion (fila en
  la base local), no la entrega.
- Wallet y login social por el tunel (ver «No entra»).
- La exposicion publica del tunel (decision del owner: acceso abierto con datos ficticios).

## Handoff

N1: lo implementa el orquestador en la conversacion principal, sin subagentes. Commit del trabajo, despues el bloque
ESTADO con su sha.

## Abierto

Nada que bloquee. Pendiente del owner fuera del codigo: §1 del runbook (alta del tunel) y §4 (variables).

## Cierre (2026-10-07)

Implementada en `140f6e9` por el orquestador (N1, sin subagentes).

**Medido:**
- `pnpm vitest run --project tools tools/local-db/check-env.test.ts` → 5/5 verde.
- Mutaciones (copia limpia en scratchpad, shasum `9d399360e410…` antes y despues, `diff` vacio al revertir;
  `rg -n MUTATION apps tools` → vacio):

  | # | Mutacion | Resultado ejecutado |
  |---|---|---|
  | 1 | comparar solo el primer elemento de la lista | ROJO solo (d): `expected … to match /^MAL .*BETTER_AUTH_TRUSTED_ORIGINS n…/` |
  | 2 | quitar la exigencia de `CONSUMER_ORIGIN` en merchant | ROJO solo (c): `expected … to match /^MAL .*apps\/merchant\/\.env…/` |

- `node tools/local-db/check-env.ts` con los `.env` reales, ANTES del §4 → **exit 1**:
  ```
  MAL  apps/merchant/.env.local BETTER_AUTH_URL no apunta a PROD
  MAL  apps/merchant/.env.local BETTER_AUTH_URL = https://dev-business.checkpass.club
  MAL  apps/merchant/.env.local CONSUMER_ORIGIN = https://dev-my.checkpass.club
  MAL  apps/consumer/.env.local CONSUMER_ORIGIN no apunta a PROD
  MAL  apps/consumer/.env.local CONSUMER_ORIGIN = https://dev-my.checkpass.club
  5 chequeo(s) MAL
  ```
  (Barrido previo, solo tipos de host: las unicas claves `*ORIGIN(S)`/`*_URL` de las apps son esas dos.)
- `PATH=/usr/bin:/bin bash tools/tunnel/up.sh` → `ABORTADO: falta cloudflared (docs/runbooks/tunel-dev.md §1)`, exit 1.
- `pnpm verify` (Node 24): typecheck, lint, ui-guard, format:check, test, build, test:e2e, neon (full) → todos `ok`;
  3136 tests pasan. `verify: ok`.

**Desvio menor de la spec:** el test NO copia `packages/db/src/local.ts`: escribe uno con la huella de un endpoint
ficticio. Con la huella real, el chequeo de `.env.prod.local` solo pasa con la URL de PROD, y el caso (a) seria
imposible sin ella.

**Login del comercio por el tunel:** la ruta real es `/es/business/onboarding` (leida de `apps/merchant/src/app/page.tsx`).

**Pendiente (owner):** §1 del runbook (alta del tunel; hoy `cloudflared` no esta instalado y no hay `~/.cloudflared/`);
§4 (variables; script de scratchpad). Despues, con el owner: `dig`, `curl` 200 a `dev-my./wallet` y
`dev-business./es/business/onboarding`, link de login con `dev-business.`, check-env exit 0, si `cloudflared` necesita
`credentials-file` explicito, y PWA + push en el telefono (fila en `consumer.web_push_subscription` LOCAL).
