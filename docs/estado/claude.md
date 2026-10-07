# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-07, noche) — SPEC 0168 IMPLEMENTADA (`140f6e9`, cierre `772d74a`); FALTA EL ALTA DEL TUNEL DEL OWNER

**Hecho (verificado):**
- **Spec 0168 implementada** en `140f6e9` (N1, conversacion principal): `tools/tunnel/{config.yml,up.sh}`,
  `pnpm dev:tunnel`, merchant en `:3001` (despues `:3201`, ver abajo), `allowedDevOrigins` con `dev-business.`/`dev-my.`, `check-env.ts` con el
  candado de origenes + `CHECK_ENV_ROOT`, `check-env.test.ts` (5/5), runbook `docs/runbooks/tunel-dev.md`.
- 2 mutaciones ejecutadas, cada una ROJO solo en su caso ((d) y (c)); revertidas con `diff` vacio; `rg MUTATION` vacio.
- `node tools/local-db/check-env.ts` con los `.env` reales: **exit 1** con 5 `MAL` (BETTER_AUTH_URL y CONSUMER_ORIGIN
  de las dos apps), transcripto en el cierre de la spec. `up.sh` sin `cloudflared` → `ABORTADO…`, exit 1.
- `pnpm verify` con Node 24: los 8 gates `ok` (3136 tests). Commits locales, sin push.

- **Alta del tunel HECHA por el owner:** tunel `checkpass-dev` (`edc1fd88-…`), `dig` de los dos hosts → IPs de
  Cloudflare; `up.sh` conecta sin `credentials-file` explicito. `:3000` lo ocupaba `GlaDOS/apps/web` y el tunel lo
  publico en `dev-my.` <1 min (apagado, 530). **Owner: puertos consumer `:3200`, merchant `:3201`** (`853a01e`, ADR 0127).

**Siguiente (owner, en este orden):**
1. ~~Alta del tunel~~ hecha. Levantar SIEMPRE las apps antes que `pnpm dev:tunnel`.
2. Variables del §4 con el script del scratchpad de esta sesion `aplicar-0168.ts` (si se perdio, rehacerlo: reemplaza
   3 lineas y deja `.env.local.respaldo-0168`, ignorado por git). Despues `node tools/local-db/check-env.ts` → exit 0.
3. Con el owner (DoD pendiente de la 0168): `dig +short` de los dos hosts; `curl` 200 a
   `https://dev-my.checkpass.club/wallet` y `https://dev-business.checkpass.club/es/business/onboarding`; link de login
   en la consola con `dev-business.`; medir si `cloudflared` pide `credentials-file` explicito; PWA + push en el
   telefono → `select count(*) from consumer.web_push_subscription` en la base LOCAL sube en 1. Anotarlo en el cierre.
4. Despues: QA manual de la 0167 (login, alta, sello, logo en bucket dev) por las direcciones del tunel.

**Decisiones del owner, no volver a preguntar:** base local en Docker (ADR 0126); tunel fijo en checkpass.club con
acceso abierto (ADR 0127); no borra secretos de sus `.env`: se COMENTAN con `#` (wallet, SMS); R2 de desarrollo;
Vercel Hobby; rotacion de claves la decide el owner (no recordarla). Wallet real en el telefono: decision ABIERTA.

**Pendientes del owner:** sacar `QA_LOGIN_ENABLED` de Vercel; borrar pases/PWA de prueba de los telefonos; par VAPID de
desarrollo (hoy consumer local usa el de PROD); `.env.example` sin el bloque de la 0167 (agentes sin permiso).

**Como se trabaja:** commits LOCALES en `main`, sin push (Hobby; contar con `git rev-list --count origin/main..main`).
PROD con datos reales: cero escrituras sin OK explicito.

**Gotchas:**
- El owner edita con TextEdit: guarda `.rtf`. Darle scripts que hagan el cambio, una sola ruta de archivo por paso.
- El hook `env-read-guard.sh` bloquea todo comando que contenga `.env` junto a `grep`/`head`/`cut`/`sed`: escribir el
  script con Write y correrlo aparte. Los agentes no pueden escribir `.env*`.
- En zsh el exit de un pipe es `$pipestatus`, no `${PIPESTATUS[0]}` (sale vacio).

**Prompt para retomar:** «Lee docs/estado/claude.md: cerrar la DoD de la 0168 con el owner (tunel ya dado de alta)».
