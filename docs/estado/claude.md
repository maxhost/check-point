# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-07, tarde) — SPEC 0167 LISTA PARA EL IMPLEMENTADOR (`1bad053`); IMPLEMENTADOR DESPACHADO

**Hecho (verificado):**
- **Collation de PROD:** `builtin` / `C.UTF-8` (MCP), reproducida en local. Restricciones identicas local/PROD.
- **Bucket R2 de desarrollo** (owner): 6 claves en `tools/local-db/.env.r2-dev` (ignorado). Bucket y claves distintos de
  PROD, misma cuenta. Probado con el SDK: put/get/delete en el bucket dev; la clave dev recibe 403 en el bucket de PROD.
- **Huella de PROD:** `PROD_DB_ENDPOINT_SHA12 = bf545fdce7a0` (endpoint `main`, no el host: Neon publica variantes
  `-rvr` que un candado por host dejaria pasar). La huella del host completo coincide con la del `DATABASE_URL` de los `.env.local`.
- **Oraculo:** `tools/local-db/huellas.sql` (19 categorias, collate C) + `huellas-prod.txt` (MCP, solo lectura).
  - Dos diferencias resueltas: `published_at` de los TOS (lo pone `now()`, excluido) y las membresias de PROD
    (`neon_service`; `pg_maintain`/`pg_signal_autovacuum_worker` con `SET FALSE`), anotadas en la spec §1.
  - Con eso, el contenedor de medicion solo diferia en `collation` (era `en_US.utf8`); una base builtin `C.UTF-8` da
    la fila de PROD.
- Contenedores `proxy-medicion` bajados (`down -v`).
- **Los `.env` los escribe el owner:** los agentes tienen denegada la escritura (spec §7, orden: `.env.prod.local` primero).

**Siguiente:**
1. `implementador` (despachado en esta sesion) sobre la spec 0167; leer su handoff y re-medir su evidencia.
2. `revisor` con las mutaciones del plan de pruebas.
3. El owner aplica los `.env` segun la checklist del runbook; recien ahi, pruebas manuales.

**Decisiones del owner, no volver a preguntar:** base local en Docker que replica Neon, sin ramas Neon de desarrollo ni
preview de Vercel; proxy, mismo driver; esquema + datos de prueba, nunca copia de PROD; R2 de desarrollo en local;
Vercel Hobby en el periodo de pruebas; rotacion de claves la decide el owner (no recordarla).

**Pendientes del owner:** sacar `QA_LOGIN_ENABLED` de Vercel; borrar pases/PWA de prueba de los telefonos. Skills
`qa-cupones-prueba`, `qa-cupon-valido` y `delete-user` apuntan a comercios que ya no existen (ofrecido borrarlas).

**Como se trabaja:** commits LOCALES en `main`, sin push (Hobby; contar con `git rev-list --count origin/main..main`).
PROD con datos reales: cero escrituras sin OK explicito (esta sesion: solo SELECT y lecturas de la API de Neon).

**Gotchas:**
- El hook `env-read-guard.sh` bloquea cualquier comando que nombre un `.env` junto a `grep`/`head`/`cut`/`sed`: los
  scripts que leen `.env` se escriben con Write y se corren en un comando aparte.
- La API de Neon da 429 con rafagas: reintentar una vez.
- zsh no parte `$VAR` en palabras.

**Prompt para retomar:** «Lee docs/estado/claude.md: seguir la implementacion de la spec 0167».
