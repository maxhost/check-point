# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-07, tarde) — SPEC 0168 (TUNEL PARA EL TELEFONO) CERRADA (`10afff9`), A IMPLEMENTAR

**Hecho (verificado):**
- `.env` de la spec 0167 aplicados por el owner (script de scratchpad que el corrio): `node tools/local-db/check-env.ts`
  exit 0. Respaldos de sus valores previos: `apps/*/.env.local.respaldo-2026-10-07` (ignorados por git).
- `pnpm db:migrate:prod` corrido con OK del owner: exit 0, nada pendiente. SELECT de solo lectura: rol `neondb_owner`,
  `drizzle.__drizzle_migrations` = 66 = archivos en `packages/db/drizzle`. (Primer intento con la URL del rol
  `checkpass_consumer`: `permission denied for schema drizzle`, nada escrito.)
- ADR 0127 + spec 0168 (N1) escritos y commiteados en `10afff9`. Decisiones del owner: tunel con nombre de Cloudflare,
  subdominios fijos `dev-business.` / `dev-my.checkpass.club`, acceso abierto.

**Hallazgo medido (hueco de la 0167, lo cierra la 0168):** los `.env.local` siguen con origenes de PROD:
merchant `BETTER_AUTH_URL` = `business.checkpass.club` (el link de login de consola va a PROD), consumer
`CONSUMER_ORIGIN` = `my.checkpass.club`, merchant sin `CONSUMER_ORIGIN` (rewrite `/api/public/*` → PROD).
**El QA local del owner NO deberia hacerse antes de arreglar esto.**

**Siguiente:**
1. Implementar la spec 0168 en la conversacion principal (N1, sin subagentes): `tools/tunnel/`, merchant :3001,
   `allowedDevOrigins`, `check-env.ts` + `check-env.test.ts` (5 casos, 2 mutaciones), runbook `tunel-dev.md`.
2. Owner: alta unica del tunel (runbook §1: `brew install cloudflared`, `tunnel login`, `create`, `route dns` x2) y
   las 3 variables del §4 (darle un script de scratchpad como en la 0167; los agentes no escriben `.env*`).
3. DoD con el owner: `dig`, `curl` 200 por el tunel, link de login con `dev-business.`, PWA + push en el telefono
   (fila en `consumer.web_push_subscription` LOCAL). `pnpm verify` al final.
4. Despues: QA manual de la 0167 (login, alta, sello, logo en bucket dev) por las direcciones del tunel.

**Decisiones del owner, no volver a preguntar:** base local en Docker (ADR 0126); tunel fijo en checkpass.club con
acceso abierto (ADR 0127); no borra secretos de sus `.env`: se COMENTAN con `#` (wallet, SMS); R2 de desarrollo;
Vercel Hobby; rotacion de claves la decide el owner (no recordarla). Wallet real en el telefono: decision ABIERTA
(credenciales de desarrollo de Apple/Google), no entra en la 0168.

**Pendientes del owner:** sacar `QA_LOGIN_ENABLED` de Vercel; borrar pases/PWA de prueba de los telefonos; par VAPID de
desarrollo (hoy consumer local usa el de PROD); `.env.example` sin el bloque de la 0167 (agentes sin permiso).

**Como se trabaja:** commits LOCALES en `main`, sin push (Hobby; contar con `git rev-list --count origin/main..main`).
PROD con datos reales: cero escrituras sin OK explicito.

**Gotchas:**
- El owner edita con TextEdit: guarda `.rtf` (convertir con `textutil -convert txt`). Darle scripts que hagan el cambio
  en vez de pasos a mano, y una sola ruta de archivo por paso.
- El hook `env-read-guard.sh` bloquea todo comando que contenga `.env` (incluso `process.env`) junto a
  `grep`/`head`/`cut`/`sed`: escribir el script con Write y correrlo aparte.
- Los agentes no pueden escribir `.env*`. La API de Neon da 429 con rafagas: reintentar una vez.
- Las dos apps arrancaban en :3000; la 0168 mueve merchant a :3001.

**Prompt para retomar:** «Lee docs/estado/claude.md: implementar la spec 0168 (tunel para el telefono)».
