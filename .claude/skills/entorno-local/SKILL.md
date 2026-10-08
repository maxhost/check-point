---
name: entorno-local
description: Levanta, revisa, apaga o diagnostica el ambiente local de prueba (base en Docker, consumer :3200, merchant :3201, tunel dev-my./dev-business.checkpass.club, email local). Uso `/entorno-local [arrancar|estado|link|parar|reset-base]` (sin argumento = estado). Nunca toca PROD ni escribe `.env*`.
---

# Ambiente local de prueba

ADR 0126 (base local), ADR 0127 (tunel). Todo pasa por dos comandos del repo; esta skill los corre y lee su salida.

| Comando | Que hace |
|---|---|
| `pnpm dev:local` | Docker → `db:local:up` (migraciones + seed, idempotente) → `check-env.ts` → puertos libres → consumer :3200 y merchant :3201 → espera `/api/health` → tunel → smoke por el tunel. Logs en `.dev-local/`. Ctrl+C apaga apps y tunel; la base queda. |
| `pnpm dev:link` | El ultimo link de login del comercio (email local, `EMAIL_PROVIDER=console`), sacado de `.dev-local/merchant.log`. |

Antes de cualquier comando: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` (Node 24).

## `arrancar`

1. Correr `estado` primero. Si ya esta arriba, decirlo y no relanzar.
2. **Recomendar al owner que lo corra EL** en su terminal: `! pnpm dev:local` no sirve (bloquea la sesion); que abra
   una terminal y corra `pnpm dev:local`. Un proceso lanzado por el agente con `run_in_background` muere cuando se
   cierra Claude Code: usarlo solo si el owner lo pide para esta sesion, y avisarle eso.
3. Si aborta, el mensaje `ABORTADO: …` dice que hacer; los casos conocidos estan abajo.

## `estado` (por defecto) — solo lectura

Reportar en una tabla, con la salida medida (no supuesta):
- Docker: `docker ps --filter name=checkpass-local --format '{{.Names}} {{.Status}}'` (pg y proxy).
- Variables: `node tools/local-db/check-env.ts` → exit code y solo las lineas `MAL`.
- Puertos: `lsof -nP -iTCP:3200 -iTCP:3201 -sTCP:LISTEN` y el `cwd` de cada pid (`lsof -a -p <pid> -d cwd -Fn`).
  Comparar en minusculas: la misma carpeta aparece como `Documents` o `documents`.
- Tunel: `pgrep -fl "cloudflared tunnel"`; `curl -s -o /dev/null -w '%{http_code}'` a
  `https://dev-my.checkpass.club/api/health` y `https://dev-business.checkpass.club/api/health` (530 = tunel caido,
  502 = la app de ese puerto no responde o esta compilando la primera vez: reintentar una vez).

## `link`

`pnpm dev:link`. Si no hay link: el owner tiene que pedir el acceso en
`https://dev-business.checkpass.club/es/business/onboarding` primero. El link vence a los 15 minutos y se usa una vez.
Es un dato de la base LOCAL: se le puede mostrar al owner.

## `parar`

Si lo lanzo el owner: Ctrl+C en su terminal. Si quedo colgado: matar SOLO los pids de 3200/3201 cuyo `cwd` es este
repo, y `pkill -f "cloudflared tunnel --config tools/tunnel/config.yml"`. Nunca matar un proceso de otra carpeta
(el 3000 suele ser otro proyecto del owner). La base queda arriba; para bajarla:
`docker compose -f tools/local-db/compose.yaml down` (sin `-v`: conserva los datos).

## `reset-base`

`tools/local-db/reset.sh` borra la base local (contenedores + volumen) y la recrea con migraciones y seed. **Pide OK
al owner antes**: pierde todo lo creado a mano en local. Usarlo cuando una rama descartada dejo migraciones aplicadas.

## Fallas conocidas

| Sintoma | Causa | Arreglo |
|---|---|---|
| `ABORTADO: Docker no responde` | Docker Desktop cerrado | abrirlo |
| lineas `MAL` de `check-env` | `.env.local` incompleto o con origen de PROD | el owner lo corrige (agentes no escriben `.env*`); darle un script de scratchpad que imprima solo claves |
| «No pudimos recuperar tu avance» en el alta | merchant sin `BETTER_AUTH_SECRET` (500 en `/api/onboarding/state`) | `check-env` ya lo marca |
| `:3200 lo usa otro programa` | otro proyecto en ese puerto | que el owner lo pare; nunca matarlo sin preguntar |
| 530 por el tunel | `cloudflared` no corre | `pnpm dev:local` (o `pnpm dev:tunnel` con las apps ya arriba) |

## Que no se puede en local

Wallet real (pase autofirmado: el iPhone lo rechaza), login con Google/Apple del cliente, push con par VAPID propio
(hoy usa el de PROD). Ver `docs/runbooks/tunel-dev.md` §5.
