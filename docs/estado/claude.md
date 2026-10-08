# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-08) — AMBIENTE LOCAL + TUNEL ANDANDO (`pnpm dev:local`); TELEFONO PARQUEADO (#80)

**Hecho (verificado):**
- Spec 0168 implementada y con QA del owner (`140f6e9`, `853a01e` puertos, `b77de14`, `ce177ec`, `653f4bb`):
  consumer `:3200`, merchant `:3201`, tunel `checkpass-dev` (alta del owner hecha). `pnpm dev:local` del owner: base,
  apps, tunel y smoke en `200`. Login del comercio por `dev-business.` con `pnpm dev:link`: 1 sesion en
  `merchant_auth.session` LOCAL. `check-env.ts` exit 0 (ahora tambien exige `BETTER_AUTH_SECRET`).
- Skill `/entorno-local` (estado/arrancar/link/parar/reset-base) y `pnpm dev:local` / `pnpm dev:link`.
- Rama `dev` creada (ADR 0128, `131bf09`) y niveles L0-L3 (ADR 0129, `d63c957`; tabla en `CLAUDE.md`). Ambiente local
  arriba en `dev` (`/entorno-local`: todo en 200).

**Parqueado por el owner (PARQUEADO #80):** QA del telefono (PWA + push). El cliente solo crea cuenta con Google/Apple
y el callback `dev-my.` no esta registrado. Al retomar: preguntar credenciales de PROD vs de desarrollo.

**Siguiente:** el owner trae «un par de cosas para trabajar»: clasificar cada una L0-L3 (si dudo, preguntarle). QA manual de la 0167 por el tunel (alta, sello, logo en bucket dev) sigue posible
del lado del comercio.

**Decisiones del owner, no volver a preguntar:** base local en Docker (ADR 0126); tunel fijo con acceso abierto y
puertos 3200/3201 (ADR 0127); no borra secretos de sus `.env`: se COMENTAN; R2 de desarrollo; Vercel Hobby; rotacion
de claves la decide el owner (no recordarla). Wallet real en el telefono: decision ABIERTA.

**Pendientes del owner:** sacar `QA_LOGIN_ENABLED` de Vercel; borrar pases/PWA de prueba de los telefonos; par VAPID de
desarrollo; `.env.example` sin el bloque de la 0167 ni `BETTER_AUTH_SECRET`/puertos nuevos (agentes sin permiso).

**Como se trabaja (ADR 0128, owner 2026-10-08):** rama local `dev` (creada desde `main` en `302e208`), sin push.
Con OK del owner: `verify` → `git switch main && git merge --ff-only dev` → `pnpm dev:local` en main → `git push` →
`git switch dev`. `main` local tiene 29 commits sin pushear (aprobados antes del ADR; pushearlos tambien pide OK).
PROD con datos reales: cero escrituras sin OK explicito.

**Gotchas:**
- El owner edita con TextEdit: darle scripts de scratchpad que hagan el cambio. Agentes no escriben `.env*`.
- `env-read-guard.sh` bloquea cualquier comando cuyo TEXTO tenga `.env` junto a `grep`/`sed`/`head`: poner la edicion
  en un archivo (Write) y correrlo aparte.
- La carpeta del repo llega como `Documents` o `documents` (APFS): comparar rutas en minusculas.
- bash de macOS es 3.2: sin `wait -n`; array vacio + `set -u` revienta.

**Prompt para retomar:** «Lee docs/estado/claude.md».
