# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-07, mañana) — PROXY LOCAL MEDIDO (ADR 0126 §Medido, `36e0740`); FALTA LA DIFERENCIA DE RESTRICCIONES Y LA SPEC

**Hecho (verificado):**
- **Proxy medido** en Docker descartable (`postgres:18` 18.6 + `local-neon-http-proxy`, driver 1.1.0 del repo, Node 24):
  HTTP, `transaction([...])` y `Pool` por WebSocket con transaccion andan con SCRAM; `/v1`, `/v2` y sin ruta, los tres;
  contraseña mala rechazada; sobrevive a reiniciar proxy y Postgres. Detalle en ADR 0126 §Medido.
- **Roles reales de PROD** (SELECT a `pg_roles`): `neondb_owner` sin superusuario pero con `CREATEROLE CREATEDB BYPASSRLS
  REPLICATION` y miembro de `neon_superuser`. Sin `BYPASSRLS` la 0060 falla. Replicado asi, `checkpass_consumer` sigue
  recibiendo `permission denied for schema merchant_auth` (login propio y `SET LOCAL ROLE`).
- **Migraciones:** `drizzle-kit migrate` NO llega al proxy (exit 1 mudo); el migrador de
  `drizzle-orm/neon-serverless/migrator` sobre el `Pool` del proxy aplica las 66 en 2,3 s, todo-o-nada.
- **Esquema local vs PROD** (misma consulta de huellas en los dos lados): identicos columnas, indices, politicas, RLS,
  grants, funciones, triggers, extensiones, TOS y migraciones. **Restricciones: 724 en ambos, hash distinto.**
- Commit `36e0740` (local): ADR 0126 con lo medido + hook `env-read-guard.sh` + LECCIONES + gotchas + INDEX.

**Siguiente:**
1. **Localizar la diferencia de restricciones** (la API de Neon daba 429 a las ~03:20 UTC del 2026-10-07): en PROD con
   `mcp__neon__run_sql`, agrupando por `contype` con dos hashes (con y sin `conname`). Local ya medido (hash con nombre,
   orden tabla+nombre / hash sin nombre, orden tabla+definicion; esquemas core, consumer, merchant_auth, drizzle):
   `c` 142 `22439de4…`/`e10af27d…`, `f` 111 `30e0bbdc…`/`b986c52b…`, `n` 412 `031692b8…`/`1d307c44…`,
   `p` 58 `7c0733ee…`/`68c6e591…`, `u` 1 `8afbd464…`/`c797ae87…`. Si es solo de nombres, decidir si importa.
2. **Spec N2** (`TEMPLATE.md`) con lo medido: roles calcados de PROD (incluido `neon_superuser`), migrador de
   `drizzle-orm` en vez de `drizzle-kit`, `PG_CONNECTION_STRING` del proxy con el superusuario del contenedor, la
   consulta de huellas como oraculo «local == PROD», mas lo que ya listaba el ADR (seed, `neonConfig` en `client.ts`
   solo con host local, variables locales de las apps, candado de `neon-test.sh`, runbook).

**Ambiente de la medicion:** contenedores `proxy-medicion` (puertos 55432 y 4444), compose en el scratchpad de la sesion
(se pierde): bajar con `docker compose -p proxy-medicion down -v` cuando no sirvan.

**Decisiones del owner (2026-10-07), no volver a preguntar:** base local en Docker que replica Neon, sin ramas Neon para
desarrollo y sin preview de Vercel; proxy (mismo driver), no cambiar de driver; esquema + datos de prueba, nunca copia de
PROD; se queda en Vercel Hobby durante el periodo de pruebas; la rotacion de claves la decide el owner (no recordarla).

**Pendientes del owner:** sacar `QA_LOGIN_ENABLED` de Vercel; borrar pases/PWA de prueba de los telefonos. Las skills
`qa-cupones-prueba`, `qa-cupon-valido` y `delete-user` apuntan a comercios que ya no existen (ofrecido borrarlas).

**Como se trabaja:** commits LOCALES en `main`; `main` va 5 adelante de `origin/main` sin push (se junta, Hobby). PROD
tiene datos reales: cero escrituras sin OK explicito (los SELECT de esta sesion fueron de solo lectura).

**Gotchas:** zsh no parte `$VAR` en palabras (usar una funcion para `docker compose ... psql`); `R2_ENDPOINT` y
`foreign-staged.sh` en la skill `gotchas-del-repo`; el hook `env-read-guard.sh` frena heredocs que mencionen un env
local junto a `cut`/`grep`: escribir con Write y correr aparte.

**Prompt para retomar:** «Lee docs/estado/claude.md: localizar la diferencia de restricciones y escribir la spec del ambiente local».
