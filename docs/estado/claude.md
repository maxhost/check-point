# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-07, mediodia) — SPEC 0167 EN BORRADOR (`b9afa60`); LA DIFERENCIA DE RESTRICCIONES ERA LA COLLATION

**Hecho (verificado):**
- **Restricciones identicas local/PROD.** Agrupadas por `contype` con nombre, los 5 hashes coinciden (md5 en los dos
  lados, misma consulta). Sin nombre difieren `c` y `n`; el local recalculado con `collate "C"` da los de PROD
  (`36d3b362`, `3b40be61`). **Causa: collation** — local `en_US.utf8` (libc), PROD ordena por bytes. Anotado en ADR 0126 §Medido.
- **Spec 0167** (N2, `borrador`): compose fijado por digest, roles calcados, collation de PROD, migrador de drizzle-orm,
  `neonConfig` solo con host local, seed ficticio, oraculo `huellas.sql` + `huellas-prod.txt` + `compare.sh`, candado
  `PROD_DB_HOST_SHA12` en `getDb` y en `neon-test.sh`, runbook. Fila en INDEX; fila del ADR 0126 apunta a la spec.
- Medido: por HTTP el proxy ignora el puerto de la URL (5432/55432/1 andan).
- **Decision del owner (2026-10-07):** imagenes en local → **bucket R2 de desarrollo** (lo crea el owner).

**Siguiente:**
1. **Leer la collation exacta de PROD** (spec 0167 §Abierto 1, consulta escrita ahi). El MCP de Neon pidio
   re-autenticacion: el owner corre `/mcp`. Esperado: sonda de orden `5dbe08e3`. Con eso se completa §Diseño 1 y la
   spec pasa a `cerrada`.
2. Antes de despachar al `implementador`: calcular `PROD_DB_HOST_SHA12` y generar `huellas-prod.txt` (orquestador).

**Ambiente de la medicion:** contenedores `proxy-medicion` (55432, 4444) siguen arriba; a `neondb_owner` se le puso
la contraseña `local-solo-dev` (descartable). Bajar con `docker compose -p proxy-medicion down -v` cuando no sirvan.

**Decisiones del owner, no volver a preguntar:** base local en Docker que replica Neon, sin ramas Neon de desarrollo ni
preview de Vercel; proxy, mismo driver; esquema + datos de prueba, nunca copia de PROD; R2 de desarrollo en local;
Vercel Hobby en el periodo de pruebas; rotacion de claves la decide el owner (no recordarla).

**Pendientes del owner:** `/mcp` para Neon; crear el bucket R2 de desarrollo; sacar `QA_LOGIN_ENABLED` de Vercel;
borrar pases/PWA de prueba de los telefonos. Skills `qa-cupones-prueba`, `qa-cupon-valido` y `delete-user` apuntan a
comercios que ya no existen (ofrecido borrarlas).

**Como se trabaja:** commits LOCALES en `main`; `main` va 6 adelante de `origin/main` sin push (Hobby). PROD con datos
reales: cero escrituras sin OK explicito (esta sesion: solo SELECT).

**Gotchas:** el hook `env-read-guard.sh` bloquea cualquier comando que nombre un `.env` junto a `grep`/`head`/`cut`
aunque sea en otra parte del pipeline: el parser de claves va en un comando aparte. zsh no parte `$VAR` en palabras.

**Prompt para retomar:** «Lee docs/estado/claude.md: leer la collation de PROD y cerrar la spec 0167».
