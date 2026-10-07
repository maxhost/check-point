# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-07, tarde) — SPEC 0167 CERRADA (`32127da`); SIGUE EL IMPLEMENTADOR

**Hecho (verificado):**
- **Restricciones identicas local/PROD**; la diferencia de hash era la collation (ADR 0126 §Medido).
- **Collation de PROD leida por MCP:** `builtin` / `C.UTF-8`; sonda de orden `5dbe08e3`, `upper('ñá')` = `ÑÁ`.
  Reproducida en local con una base `builtin`/`C.UTF-8` (creada y borrada en el contenedor de medicion).
- **Spec 0167 `cerrada`** (N2): compose fijado por digest con `initdb` builtin `C.UTF-8`, roles calcados, migrador de
  drizzle-orm, `neonConfig` solo con host local, seed ficticio, oraculo `huellas.sql` + `huellas-prod.txt` +
  `compare.sh`, candado `PROD_DB_HOST_SHA12` en `getDb` y `neon-test.sh`, R2 de desarrollo, runbook.
- **Owner (2026-10-07):** creo el bucket R2 de desarrollo; sus 6 claves van en `tools/local-db/.env.r2-dev` (ignorado,
  `git check-ignore` verificado). Se copian a los `.env.local` solo junto con el cambio de `DATABASE_URL` a local.

**Siguiente:**
1. Orquestador, antes de despachar: confirmar que `tools/local-db/.env.r2-dev` tiene las 6 claves (solo nombres y
   largos); calcular `PROD_DB_HOST_SHA12`; generar `huellas-prod.txt` con `huellas.sql` por MCP (solo lectura).
2. `implementador` sobre la spec 0167; despues `revisor` con las 3 mutaciones del plan de pruebas.

**Ambiente de la medicion:** contenedores `proxy-medicion` (55432, 4444) arriba; `neondb_owner` con contraseña
`local-solo-dev` (descartable). Bajar con `docker compose -p proxy-medicion down -v` antes de levantar el compose de la spec.

**Decisiones del owner, no volver a preguntar:** base local en Docker que replica Neon, sin ramas Neon de desarrollo ni
preview de Vercel; proxy, mismo driver; esquema + datos de prueba, nunca copia de PROD; R2 de desarrollo en local;
Vercel Hobby en el periodo de pruebas; rotacion de claves la decide el owner (no recordarla).

**Pendientes del owner:** sacar `QA_LOGIN_ENABLED` de Vercel; borrar pases/PWA de prueba de los telefonos. Skills
`qa-cupones-prueba`, `qa-cupon-valido` y `delete-user` apuntan a comercios que ya no existen (ofrecido borrarlas).

**Como se trabaja:** commits LOCALES en `main`, sin push (Hobby; contar con `git rev-list --count origin/main..main`).
PROD con datos reales: cero escrituras sin OK explicito (esta sesion: solo SELECT).

**Gotchas:** el hook `env-read-guard.sh` bloquea cualquier comando que nombre un `.env` junto a `grep`/`head`/`cut`/`sed`
aunque sea en otra parte: el parser de claves y las ediciones de docs que mencionen `.env` van como script escrito con
Write y corrido aparte. zsh no parte `$VAR` en palabras.

**Prompt para retomar:** «Lee docs/estado/claude.md: despachar el implementador de la spec 0167».
