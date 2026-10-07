# Estado de Claude — historico

> Bloques ESTADO viejos, movidos tal cual desde `claude.md` (spec 0151). **No se lee al arrancar**: el estado
> vigente es el bloque `⇥ ESTADO` de arriba de `claude.md`. Se consulta con `rg` si hace falta un dato viejo.



## ESTADO HISTORICO (2026-10-07, tarde) — SPEC 0167 CERRADA (`32127da`); SIGUE EL IMPLEMENTADOR

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

## ESTADO HISTORICO (2026-10-07, mediodia) — SPEC 0167 EN BORRADOR (`b9afa60`); LA DIFERENCIA DE RESTRICCIONES ERA LA COLLATION

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

**Como se trabaja:** commits LOCALES en `main`; `main` va adelante de `origin/main` sin push (Hobby; contar con `git rev-list --count origin/main..main`). PROD con datos
reales: cero escrituras sin OK explicito (esta sesion: solo SELECT).

**Gotchas:** el hook `env-read-guard.sh` bloquea cualquier comando que nombre un `.env` junto a `grep`/`head`/`cut`
aunque sea en otra parte del pipeline: el parser de claves va en un comando aparte. zsh no parte `$VAR` en palabras.

**Prompt para retomar:** «Lee docs/estado/claude.md: leer la collation de PROD y cerrar la spec 0167».

## ESTADO HISTORICO (2026-10-07, mañana) — PROXY LOCAL MEDIDO (ADR 0126 §Medido, `36e0740`); FALTA LA DIFERENCIA DE RESTRICCIONES Y LA SPEC

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

## ESTADO HISTORICO (2026-10-07, madrugada) — SALIDA A LIVE: PROD Y R2 VACIOS, LOGIN DE QA BORRADO; SIGUE EL ARCO DEL AMBIENTE LOCAL (ADR 0126)

**Hecho (verificado):**
- **GLaDOS:** `.glados/` (perfil de calidad + conocimiento del repo) commiteado por el owner en `9dca50c`. El perfil
  pasa el parser real de GLaDOS (`valid`, 6 checks, 39 areas sensibles, 13 dominios). Baseline medido el 2026-10-06:
  typecheck, lint, unit (2373), Neon (3136 en 358 s), e2e (179 en 65 s) y build, todo verde.
- **Login de QA borrado** (`f927d4e`, local): ruta `api/merchant/auth/qa-login`, `server/qa-login.ts`, los botones de
  `account-step.tsx` y sus tests; spec 0150 → `deprecada`. Medido: typecheck 0, lint 0, ui-guard sin aumentos, unit 2346
  passed, e2e `merchant-entry` 1/1 (el primer intento fallo por cache de Turbopack con la ruta borrada; reintento limpio).
  **La variable `QA_LOGIN_ENABLED` de Vercel la saca el owner.**
- **PROD vaciado** con OK explicito del owner (`tools/wipe-database.sql` reescrito en `3998ad7`, local): snapshot Neon
  `pre-wipe-2026-10-07` (`snap-square-truth-axs9z3m2`) antes; Stripe sin ids (0); `TRUNCATE` de 56 tablas de
  `core`/`merchant_auth`/`consumer` en una transaccion con asercion. Despues, por SQL: todo en 0 salvo
  `core.terms_template` = 11 (TOS semilla); 66 migraciones; roles y 14 politicas RLS intactos. Health 200 en
  `business.`, `my.` y `www.`. Antes habia 718 filas (12 comercios, 15 usuarios, 10 clientes).
- **R2 vaciado** (OK del owner): 28 objetos huerfanos (~18,6 MB; `brands/`, `loyalty/`, `products/`) de 7 comercios de
  agosto/septiembre que ya habian salido en la limpieza del 16/17-09. Relistado despues: 0 objetos. No habia
  `catalog-imports/` ni objetos fuera de prefijos de comercio. Sin verificar: que el bucket del `.env.local` (huella
  `369fa6edcd7b`) sea el de Vercel PROD.
- **ADR 0126** (ambiente local que replica Neon) escrito con las decisiones del owner, fila en INDEX.
- **Mistake→rule:** hook `env-read-guard.sh` (PreToolUse Bash, registrado en `.claude/settings.json`) tras imprimir dos
  claves privadas con `cut` sobre un `.env` de valores multilinea; caso en `LECCIONES.md`. Probado: muerde en 4 casos, deja
  pasar 5 legitimos.

**Siguiente — arco del ambiente local (ADR 0126), N2:**
1. Spec (`TEMPLATE.md`): `docker compose` con `postgres:18` + proxy `ghcr.io/timowilhelm/local-neon-http-proxy`; script de
   roles (`neondb_owner` SIN superusuario, `customer_reader`, `checkpass_consumer`) + `drizzle-kit migrate`; seed de datos
   ficticios; `neonConfig` en `packages/db/src/client.ts` solo con host local; `.env.local` a local (Stripe test, email a
   consola, push/wallet apagados); el candado contra PROD de `tools/neon-test.sh` (hoy compara contra `DATABASE_URL`)
   rehecho; runbook local → verify → migracion a PROD explicita → push.
2. **Medir antes de escribir la spec:** que el proxy ande con PG 18 y SCRAM de `neondb_owner`, y si el WebSocket es `/v1`
   o `/v2`.

**Decisiones del owner (2026-10-07), no volver a preguntar:** base local en Docker que replica Neon, sin ramas Neon para
desarrollo y sin preview de Vercel; proxy (mismo driver), no cambiar de driver; esquema + datos de prueba, nunca copia de
PROD; se queda en Vercel Hobby durante el periodo de pruebas; la rotacion de claves la decide el owner (no recordarla).

**Pendientes del owner:** sacar `QA_LOGIN_ENABLED` de Vercel; borrar pases/PWA de prueba de los telefonos. Las skills
`qa-cupones-prueba`, `qa-cupon-valido` y `delete-user` apuntan a comercios que ya no existen (ofrecido borrarlas).

**Como se trabaja:** commits LOCALES en `main` del arbol principal; `main` va 3 adelante de `origin/main`
(`9dca50c`, `f927d4e`, `3998ad7`), sin push (se junta, Hobby). Desde ahora PROD tiene datos reales: cero escrituras sin
OK explicito.

**Gotchas:** `R2_ENDPOINT` trae el bucket en la ruta (para `ListObjectsV2` usar el origen) y `foreign-staged.sh` exige
rutas literales en `git commit --`: ambos en la skill `gotchas-del-repo`. El hook nuevo tambien frena un heredoc que
mencione `.env` + `cut`/`grep`: editar docs con Edit/Write.

**Prompt para retomar:** «Lee docs/estado/claude.md: arco del ambiente local (ADR 0126), empezar midiendo el proxy».

## ESTADO HISTORICO (2026-10-06, tarde) — 0163 Y 0166 EN `origin/main` (`c69751d`, pre-push `verify: ok`); ENCARGO PARA GPT ESCRITO

**Hecho (verificado):**
- **0163** (GPT): `implementada` con PASS del revisor; la rama con sesion la cubre `page.neon.integration.test.ts`.
- **0166** (N2, decision del owner: con sesion, `business.checkpass.club/` lleva al panel): `/` sin `?e=` → sesion valida a
  `/backoffice`, sin sesion al alta; con `?e=` nunca redirige; el guard cierra la sesion sin negocio (`!row`), asi no
  hay ciclo `/` ↔ `/backoffice`. Implementacion `2e45d0f`; revisor PASS (barrio todos los `redirect` a `/`); R2 (que
  quedaba verde) cerrada por mi con el caso `?e=` vacio → panel, medida roja y revertida. Reproducido por mi: unitario
  13/13, Neon 7/7. Comentario vencido de `magic-link/route.ts` corregido.
- **Push** `17cac99..c69751d` desde `sin-gate-email`, pre-push `verify: ok` (tabla en el hook). El `main` del arbol
  principal se adelanto con `--ff-only` a `c69751d` (no tenia commits de GPT). **Vercel: sin statuses al consultar justo
  despues del push** — confirmar `success` antes de pedir QA.
- **Owner (2026-10-06):** una sesion sin negocio no se puede crear (medido en PROD: 15 usuarios, 15 membresias) y NO va a
  PARQUEADO; al desactivar un staff su sesion se cierra (ya lo hace `staff.ts:258`).
- **`docs/encargo-gpt-2026-10-06.md`**: lo que GPT tiene que cerrar — (1) pantalla del motivo de `?e=` (despues de la
  0166, mismo `page.tsx`), (2) fechas de marketing al `DateTimeField` (#79), (3) estado de la 0157 en INDEX.

**Siguiente, en orden:**
1. Statuses de Vercel de `c69751d` en `success` → pedir QA al owner: logueado, `business.checkpass.club/` → panel; sin
   sesion → alta.
2. Flakes que bloquean pushes: PARQUEADO #74 primero, despues #75 y #78.
3. Chicos: H4 de la 0155; `docs/design-system.md` §Form «Pendiente» sobre `validationErrors` (resuelto por la 0162).
4. Cuando GPT pushee la Fase 1 con las fechas migradas: restringir el `type` de `TextField` (#79).
5. Arco UI (ADR 0123): piezas del kit que pida GPT, #77, Cierre.

**Como se trabaja:** GPT commitea la Fase 1 en local sobre `main` del arbol principal sin pushear. Claude trabaja en
worktrees desde `origin/main` (`tools/worktree-new.sh <nombre>`; enlazar `apps/merchant/.env.local` a mano) y pushea con
`git push origin <rama>:main`. El worktree `sin-gate-email` sigue en uso; este commit de estado esta solo ahi.

**Pendientes del owner:** decidir el boton de cada codigo de `?e=` (propuesta en el encargo de GPT) o dejarlo a la spec
de GPT; QA de la 0165 y de la 0166; QA del buscador en locales y del tour de locales (0160); borrar las dos claves de
Geoapify en Vercel.

**Hallazgos abiertos:** PARQUEADO #74, #75, #77, #78, #79; H4 de la 0155.

**Gotchas:** un rojo que sale SOLO dentro del pre-push no es flake hasta leer la salida entera (guardarla:
`git push … > log 2>&1`). No hay `gh` ni `vercel` en el PATH: el estado del deploy se lee con
`curl -s https://api.github.com/repos/maxhost/check-point/commits/<sha>/statuses`.

**Prompt para retomar:** «Lee docs/estado/claude.md: flake #74» (el owner pidio seguir con #74; QA de la 0166 pendiente de su lado).

## ⇥ ESTADO HISTORICO (2026-10-06, mañana) — 0163 IMPLEMENTADA CON PASS (`f124e2d`), SIN PUSHEAR, EN LA RAMA `sin-gate-email`

**Hecho (verificado):**
- **0163** (GPT, N1: la raiz del merchant sin sesion abre el onboarding): revisor independiente **PASS**. La rama con
  sesion (DoD 2) quedo cubierta por un test nuevo, `apps/merchant/src/app/page.neon.integration.test.ts` (4 casos,
  `4 passed` reproducido por mi con `tools/neon-test.sh`). La M2 (`redirect("/backoffice")` con sesion) la reproduje:
  2 rojos con `expected 'redirect:/backoffice' to be 'portada'`, restaurado con `shasum` `1d418096…` identico. El e2e
  commiteado NO mata M1 ni M2: solo las mata el test Neon. Typecheck y eslint del test con exit 0. Spec a `implementada`
  + fila de INDEX en `f124e2d`. **`pnpm verify` completo no se corrio**: corre en el pre-push.
- `f124e2d` y este commit estan en la rama `sin-gate-email` (worktree `check-point-wt/sin-gate-email`), **sin pushear**
  (Hobby: juntar cambios). `origin/main` = `17cac99`; el `main` local (`df88144`) es ancestro de la rama.
- Sigue de antes: 0165 en prod (`17cac99`), QA del owner pendiente.

**Hallazgos a decidir (de la revision de la 0163, no son decision del owner):**
- `/?e=<codigo>` sin sesion pierde el motivo: un staff con `staff_disabled` termina en el wizard de alta de dueño.
  La portada vieja tampoco mostraba el motivo; lo nuevo es el destino.
- Una sesion valida SIN negocio que abre el onboarding salta a `/backoffice` (`restoredStage` solo mira
  `authenticated`), rebota a `/` y queda en la portada sin salida. Previo a la 0163.

**Siguiente, en orden:**
1. Pushear `sin-gate-email` a `main` cuando se junte con lo siguiente (`git push origin sin-gate-email:main`, pre-push
   con `verify`; guardar la salida en un log). Despues, `git merge --ff-only origin/main` en el arbol principal si GPT
   no tiene commits locales, y recien ahi se puede borrar el worktree.
2. Flakes que bloquean pushes: PARQUEADO #74 primero, despues #75 y #78.
3. Chicos: H4 de la 0155; `docs/design-system.md` §Form «Pendiente» sobre `validationErrors` (resuelto por la 0162).
4. Arco UI (ADR 0123), cuando toque: piezas del kit que pida GPT, #79, #77, Cierre.

**Como se trabaja:** GPT commitea la Fase 1 en local sobre `main` del arbol principal sin pushear. Claude trabaja en
worktrees desde `origin/main` (`tools/worktree-new.sh <nombre>`; enlazar `apps/merchant/.env.local` a mano) y pushea con
`git push origin <rama>:main`.

**Pendientes del owner:** QA de la 0165; QA del buscador en locales y del tour de locales (0160); borrar las dos claves
de Geoapify en Vercel; decidir los dos hallazgos de arriba.

**Hallazgos abiertos:** PARQUEADO #74, #75, #77, #78, #79; H4 de la 0155.

**Gotchas:** un rojo que sale SOLO dentro del pre-push no es flake hasta leer la salida entera. No hay `gh` ni `vercel`
en el PATH: el estado del deploy se lee con `curl -s https://api.github.com/repos/maxhost/check-point/commits/<sha>/statuses`.
El `.env.local` del merchant en worktrees: una cookie de sesion basura en `next dev` da 500 (Auth sin env valido); el e2e
de la raiz pasa por el atajo `getSessionCookie`, no porque el env este completo.

**Prompt para retomar:** «Lee docs/estado/claude.md: pushear sin-gate-email y seguir con el flake #74».

## ⇥ ESTADO HISTORICO (2026-10-06, madrugada) — 0165 EN PROD (`17cac99`, Vercel `success` x3); SIGUE EL REVISOR INDEPENDIENTE DE LA 0163

**Hecho (verificado):**
- **0165 / ADR 0125** (catalogo entero, IA incluida, y retirar/cancelar retiro del programa sin email verificado):
  `origin/main` = `17cac99`, pre-push `verify: ok` DENTRO del hook; statuses de GitHub de `17cac99`: Vercel merchant,
  customer y public `success`. Revisor PASS (`8ad441a`), M1–M3 rojas y revertidas. **QA del owner pendiente.**
- **Incidente reparado (2026-10-05, noche):** los tests de `ui-guard`/`zone-audit` (0164), corridos por el pre-push,
  heredaron `GIT_DIR`/`GIT_INDEX_FILE` y escribieron en el repo real (`core.bare=true`, `core.filemode=true`,
  `[user] t@t`, la rama `sin-gate-email` y el HEAD del worktree movidos). Reparado a mano desde el reflog; `origin` no se
  toco. Fix `17cac99`: `gitEnv()` sin `GIT_*` + oraculo con `GIT_DIR` señuelo (rojo sin el fix por la razon correcta).
  Caso en `docs/LECCIONES.md`, regla en la skill `gotchas-del-repo`. Verificado despues del push: `.git/config` con
  `bare = false`, `filemode = false`, sin `[user]`.
- **Owner (2026-10-06):** «la 0157 ya esta cerrada, GPT ya hizo los ajustes»; «el buscador de lugar en alta esta
  probado y funcionando». No volver a pedirlo.
- Fase 1 de UI: prompt dado a GPT (sin push hasta el final; GPT numera desde **0170**, Claude **0165–0169**).

**Siguiente, en orden:**
1. **Revisor independiente de la 0163** (subagente `revisor`, N1 de GPT, `docs/specs/0163-raiz-del-merchant-abre-onboarding.md`,
   diff `1889b6d..bc8f3fd`, handoff `docs/handoff-0163-entrada-merchant-2026-10-05.md`). Lo que pide el handoff: sesion
   valida → `/` conserva la portada; sesion vencida/cookie invalida → onboarding; los rebotes del guard de
   `/backoffice` (destino `/`) no hacen ciclo; DoD abierto en la spec linea 39. Presupuesto: correctitud + 1–3 mutaciones
   sobre `apps/merchant/src/app/page.tsx`. Con PASS: la spec a `implementada` + fila de INDEX (es spec de GPT: solo el
   estado, no su contenido).
2. Flakes que bloquean pushes: PARQUEADO #74 primero (dos `--no-verify` en un dia), despues #75 y #78.
3. Chicos: H4 de la 0155 (400 de Google en Details por clave invalida se ve como `place_not_found`);
   `docs/design-system.md` §Form dice «Pendiente» sobre `validationErrors` (resuelto por la 0162).
4. Arco UI (ADR 0123), cuando toque: piezas del kit que pida GPT, #79, #77, Cierre.

**Como se trabaja:** GPT commitea la Fase 1 en local sobre `main` del arbol principal sin pushear. Claude trabaja en
worktrees desde `origin/main` (`tools/worktree-new.sh <nombre>`; enlazar `apps/merchant/.env.local` a mano) y pushea con
`git push origin <rama>:main`. El worktree `check-point-wt/sin-gate-email` ya cumplio: se puede borrar
(`git worktree remove … && git branch -D sin-gate-email`). Si el `main` local no tiene commits de GPT, se adelanta con
`git merge --ff-only origin/main`.

**Pendientes del owner:** QA de la 0165 (cuenta sin verificar: categoria/producto/imagen/stock, import con IA,
borrados, retirar y cancelar el retiro); QA del buscador en locales y del tour de locales (0160); borrar las dos claves
de Geoapify en Vercel.

**Hallazgos abiertos:** PARQUEADO #74, #75, #77, #78, #79; H4 de la 0155.

**Gotchas:** un rojo que sale SOLO dentro del pre-push no es flake hasta leer la salida entera (guardarla:
`git push … > log 2>&1`). No hay `gh` ni `vercel` en el PATH: el estado del deploy se lee con
`curl -s https://api.github.com/repos/maxhost/check-point/commits/<sha>/statuses`.

**Prompt para retomar:** «Lee docs/estado/claude.md: revisor independiente de la 0163».

## ⇥ ESTADO HISTORICO (2026-10-05, noche) — 0165 IMPLEMENTADA CON PASS (`8ab9e73`), PUSHEADA DESDE LA RAMA `sin-gate-email`; FASE 1 DE UI PARQUEADA (ES DE GPT)

**Hecho (verificado):**
- **0164** (Fase 0c) en `origin/main` (`5eb47af`, push `--no-verify` con OK del owner por el flake #74).
- **ADR 0125 + spec 0165** (N2): todo `/api/catalog/*` (IA incluida) y retirar/cancelar el retiro del programa sin
  email verificado; borrados duros y retiro siguen solo del owner. Implementacion `8ab9e73`; `pnpm verify` ok en la
  rama; revisor PASS (`8ad441a`) con M1–M3 rojas por la asercion esperada y revertidas. Reproducido por mi: inventario
  `SinGateDeEmail` = 7 archivos, unidad 181/181, sin `MUTATION`. Riesgo aceptado por el owner: gasto de IA acotado
  solo por el cupo por comercio.
- **Prompt de Fase 1 para GPT dado** (sin push: un solo push al final de todas las pantallas; GPT numera specs desde
  **0170**, Claude usa **0165–0169**).

**Como se trabaja ahora:** GPT commitea la Fase 1 en local sobre `main` del arbol principal, sin pushear. Claude trabaja
en worktrees desde `origin/main` (`tools/worktree-new.sh`) y pushea con `git push origin <rama>:main`; el `main` local
de GPT queda atras y rebasa al final. El worktree necesita `apps/merchant/.env.local` enlazado (el script solo enlaza
los `.env*` de la raiz).

**Siguiente:**
1. QA del owner de la 0165 cuando el deploy de Vercel de `checkpass.club` este `READY` con el sha del push: con una
   cuenta sin verificar, cargar catalogo (manual e IA) y retirar/cancelar el retiro del programa.
2. Parqueado del arco UI (ADR 0123): piezas del kit que pida GPT; PARQUEADO #79; Cierre (borrar `@layer legacy`, guard
   absoluto, oscuro). Para GPT: el copy `email_not_verified` de catalogo/programa quedo muerto (0165).
3. 0163 sin PASS independiente (sesion valida/vencida, rebotes sin ciclo).

**Pendientes del owner:** QA de la 0165; QA del buscador de lugares y del tour de locales (0160); borrar las dos
claves de Geoapify en Vercel; QA del alta/locales/programa.

**Hallazgos abiertos:** PARQUEADO #74, #75, #77, #78, #79; H4 de la 0155. `docs/design-system.md` §Form dice
«Pendiente» sobre `validationErrors` (resuelto por la 0162).

**Prompt para retomar:** «Lee docs/estado/claude.md: QA de la 0165».

## ⇥ ESTADO HISTORICO (2026-10-05, noche) — 0164 (FASE 0c) IMPLEMENTADA (`5eb47af`), SIN PUSHEAR: `verify` ROJO SOLO POR #74

**Hecho (verificado):**
- **0164** (Fase 0c, cierra la parte de Claude antes de la Fase 1): spec `6da1e6d` (pusheada), implementacion `5eb47af`
  (local). `tools/ui-guard.ts` (+ `ui-guard-counts.ts`, `ui-guard-tsx.ts`): trinquete por archivo cambiado de
  `apps/merchant/src`, 17 categorias, gate `ui-guard` en `pnpm verify`; `--report` = linea de partida de la Fase 1
  (257 nativos, 193 handlers, 122 `type-scale`, 1491 selectores y 480 colores en CSS). `tools/zone-audit.ts` en hook
  `SessionStart`. `postcss` 8.5.26 devDep de la raiz. Docs: AGENTS.md, TRABAJO-EN-PARALELO §5, design-system §Guardia,
  PARQUEADO #79 (`type` de `TextField`). 37 tests de tools; M1–M3 rojas por la asercion esperada y revertidas. Sobre el
  repo real: `<button onClick>` temporal en el mostrador → exit 1 con lineas; revertido → exit 0.
- **`pnpm verify` → ROJO solo en `neon (full)`**: 1 de 3362, `catalog-import-reconcile` = PARQUEADO #74; ese archivo
  solo → `8 passed`. Todo lo demas ok.
- Antes, en esta sesion: prompt de Fase 1 para GPT dado (mostrador primero).

**Siguiente, en orden:**
1. **Push de `5eb47af` + este estado**: pedir OK del owner para `--no-verify` (como en 0160/0161) o reintentar `verify`.
2. Tras el push: `node tools/zone-audit.ts` → sin salida (el ancla queda en `origin/main`). Avisarle a GPT que el guard
   ya corre en `verify` (el prompt ya lista las reglas).
3. **0163 sin PASS independiente** (spec `cerrada`): sesion valida/vencida y rebotes del guard sin ciclo.
4. Lo que queda del arco ADR 0123: Fase 1 (GPT) → piezas del kit que pida → Cierre (Claude: borrar `@layer legacy`,
   guard absoluto, oscuro con capturas). PARQUEADO #79 cuando marketing pase a `DateTimeField`.

**Pendientes del owner:** QA del buscador de lugares (alta y locales) y del tour de locales (0160). Borrar las dos claves
de Geoapify en Vercel; QA del alta/locales/programa.

**Hallazgos abiertos:** PARQUEADO #74 (otra vez hoy), #75, #77, #78, #79; H4 de la 0155. `docs/design-system.md` §Form
todavia dice «Pendiente» sobre `validationErrors` (resuelto por la 0162).

**Gotchas:** el hook `file-size.sh` corta en 300 lineas (partir antes de escribir). `document.createElement` y los
selectores `[data-tour=…]` son falsos positivos ya excluidos del guard. `pnpm verify` deja `next-env.d.ts` modificados
(build): `git checkout` antes de commitear.

**Prompt para retomar:** «Lee docs/estado/claude.md: push de la 0164».

## ⇥ ESTADO HISTORICO (2026-10-05, noche) — 0161 Y 0163 EN `origin/main` (`42f1516`, CI verde); PROMPT DE FASE 1 PARA GPT DADO; SIGUE LA FASE 0c

**Hecho (verificado):**
- `main` = `origin/main` = `42f1516`; `pnpm ci:status` → VERDE. Ahi estan la 0161 (`fede9d2`) y la 0163 (GPT,
  `bc8f3fd`: `business.checkpass.club/` sin sesion → 307 a `/es/business/onboarding`). No hubo push en esta sesion:
  ya estaba todo arriba.
- **Prompt de GPT para la Fase 1 dado en la sesion** (owner lo pidio ahora, antes de la 0c: cambia el orden «GPT
  recien despues de la 0c»). Primera pantalla: **mostrador** (orden del ADR 0123), solo forma; kit 0159–0162; las
  reglas de la 0c van escritas en el prompt porque el guard todavia no existe.

**Siguiente, en orden:**
1. **Fase 0c** (guardias, `tools/ui-guard.ts`): spec nueva. Al aterrizar, avisarle a GPT que el guard corre en
   `verify`. Ahi tambien el `type` de `TextField` (8 `datetime-local` en marketing) o a la Fase 1.
2. **0163 sin PASS independiente** (la spec sigue `cerrada`): el handoff pide probar sesion valida/vencida y que los
   rebotes del guard no hagan ciclo. Decidir quien la revisa.

**Pendientes del owner:** QA del buscador de lugares (alta y locales) y del tour de locales paso «Busca la
direccion» (0160). Borrar las dos claves de Geoapify en Vercel; QA del alta/locales/programa.

**Hallazgos abiertos:** PARQUEADO #74, #75, #78, #77 (diferido); H4 de la 0155. `docs/design-system.md` §Form
todavia dice «Pendiente» sobre `validationErrors` (texto viejo, ya resuelto por la 0162).

**Gotchas:** los de la 0161 estan en el bloque historico de arriba de `claude-historico.md`.

**Prompt para retomar:** «Lee docs/estado/claude.md: spec de la Fase 0c».

## ⇥ ESTADO HISTORICO (2026-10-05, noche) — 0161 IMPLEMENTADA (`fede9d2`), SIN PUSHEAR; SIGUE LA FASE 0c, DESPUES GPT

**Hecho (verificado):**
- **0161** (Fase 0b, rebanada 3, cierra la 0b): spec `8354f93`, implementacion `fede9d2`. Decisiones del owner
  ANTES de la spec (enmienda del ADR 0123): fecha/hora con **segmentos de React Aria + calendario**, color con
  **muestra + hex editable**, busqueda con **lupa + borrar**. El kit suma `TimeField`, `DateTimeField`,
  `SearchField`, `ColorField`, `Slider` y `FileButton`; fecha/hora fijan `es-419` y 24 h y conservan los valores de
  texto nativos (`HH:mm`, `YYYY-MM-DDTHH:mm`). `@internationalized/date` 3.12.4 como dependencia directa del
  merchant. Rojo primero (6 exports faltantes); M1–M4 rojas por la asercion esperada y revertidas. Kit `58 passed`;
  `CI=1` `17 passed`/`41 skipped`. Capturas (16): https://claude.ai/artifact/URDEy2rxoDyLGF8U8ywoo2 . Desvios en la
  seccion «Implementacion» de la spec (el mas importante: `FileButton` arma su input propio porque `FileTrigger`
  descarta el `aria-label` que usan los e2e).
- **`pnpm verify` → ROJO, dos corridas**, solo en `neon (full)`: el flake PARQUEADO #74 (`catalog-import-guard`
  201 vs 409, `catalog-import-reconcile` polls 1 vs 0). La Neon completa suelta sobre el mismo arbol: `381 passed`,
  exit 0. Corre `full` porque cambio el lockfile. Todo lo demas `ok`.

**Siguiente, en orden:**
1. **Push de `fede9d2` + docs**: el pre-push va a dar rojo por #74; **pedir OK del owner** para `--no-verify` (como
   en la 0160) o reintentar el `verify`.
2. **Fase 0c** (guardias): spec nueva. Ahi tambien restringir el `type` de `TextField` (hoy 8 `datetime-local` en
   marketing) o dejarlo a la Fase 1 (anotado en «No entra» de la 0161).
3. **Recien despues GPT** (owner, 2026-10-05). Al terminar la 0c se rehace un solo prompt con 0160 + 0161 + 0c.
   Avisarle: los e2e que hoy usan `setInputFiles` por id/etiqueta, `searchbox`, `slider` «Zoom» y el hex de Marca
   se migran con cada pantalla (lista en «Medido para el diseño» de la 0161); con segmentos no se usa `fill`.

**Pendientes del owner:** QA del buscador de lugares (alta y locales) y del tour de locales paso «Busca la
dirección» (de la 0160). Borrar las dos claves de Geoapify en Vercel; QA del alta/locales/programa; deploys de
`b1ab123` y `d797c21`.

**Decidido por el owner (2026-10-05):** `.env.example` queda como esta. Las tres decisiones de la 0161 (arriba). No
volver a pedirlas.

**Hallazgos abiertos:** PARQUEADO #74 (2 veces mas hoy, en `verify`), #75, #78, #77 (diferido); H4 de la 0155.
`docs/design-system.md` §Form todavia dice «Pendiente» sobre `validationErrors` (texto viejo, sin tocar).

**Gotchas de esta sesion:** `FileTrigger` de RAC 1.21.1 no pasa `aria-label` al input. Los segmentos de fecha
llevan marcas U+2066..U+2069 en `textContent`. Un estilo de «hoy» en una captura necesita `page.clock`. El CSS
`legacy` de `input` se cuela en inputs internos del kit: neutralizar con utilidades. Una pagina del harness mas larga
puede dejar el puntero sobre un boton de un modal (hover en el oraculo de color). `/private/tmp/x` es un archivo
ajeno: no tocar.

**Prompt para retomar:** «Lee docs/estado/claude.md: push de la 0161 y spec de la Fase 0c».

## ⇥ ESTADO HISTORICO (2026-10-05, noche) — 0160 EN `origin/main` (`c2e40ac`); SIGUE LA 0161, DESPUES LA 0c, RECIEN AHI GPT

**Hecho (verificado):**
- **0160** (Fase 0b, rebanada 2): spec `ca18ef4`, implementacion `c335035`. El kit suma `Dialog`/`ConfirmDialog`,
  `Combobox`, `Tabs`/`TabList`/`Tab`/`TabPanel`, `SegmentedControl`, `Switch`, `ProgressBar` y `Link`.
  `places-search.tsx` pasa a `Combobox` (alta y locales): roles `combobox`/`option`, e2e de Places migrados en el
  mismo commit; 9 reglas `.places-search*` borradas de `globals.css`; excepcion de pointer-events para el popover en el
  paso de direccion del tour de locales. Rojo primero (harness sin exports; Places sin `combobox`); M1–M4 rojas por la
  asercion esperada y revertidas. Kit `40 passed`; `CI=1` `12 passed`/`28 skipped`; `pnpm verify` → `verify: ok`
  (e2e `160 passed`) en la segunda corrida (la primera: Prettier en 3 archivos + flake #78). Capturas (16):
  https://claude.ai/artifact/BxFSXFFqCUUd3e8YHxUmy4 . Desvios medidos en la seccion «Implementacion» de la spec
  (lo mas importante: React Aria no abre la lista cuando las opciones llegan async → `OpenWhenItemsArrive`; al elegir
  escribe el texto de la opcion → guardia + test con `details` lento).
- **Pusheada** `3177450..c2e40ac` con `--no-verify` (OK explicito del owner, 2026-10-05: «hace el push saltando el
  verify»); el `verify` completo ya habia dado `ok` sobre `c335035`.

**Siguiente, en orden:**
1. **0161** (campos `file`/`color`/`time`/`datetime-local`/`range`/`search`): se escribe al empezar, mismo harness.
2. **Fase 0c** (guardias).
3. **Recien despues GPT** (owner, 2026-10-05: «cuando acabemos esto y fase 0c recien pondre a gpt a trabajar»). El
   prompt para GPT de la 0160 se dio en la sesion; al terminar la 0c se rehace uno solo con 0160 + 0161 + 0c.

**Pendientes del owner:** QA del buscador de lugares en el alta y en locales (aspecto del kit, flechas + Enter), y del
**tour de locales** paso «Busca la dirección»: escribir y elegir una direccion con el tour abierto (excepcion de CSS sin
e2e). Borrar las dos claves de Geoapify en Vercel; QA del alta/locales/programa; deploys de `b1ab123` y `d797c21`.

**Decidido por el owner (2026-10-05):** `.env.example` queda como esta (todavia lista Geoapify). No volver a pedirlo.

**Hallazgos abiertos:** PARQUEADO #74, #75, **#78 (nuevo: teardown de `loyaltyHarness` > 30 s, visto 2 veces)**, #77
(diferido por el owner); H4 de la 0155. `docs/design-system.md` §Form todavia dice «Pendiente» sobre `validationErrors`
(lo resolvio la 0162): texto viejo, sin tocar.

**Gotchas de esta sesion:** en un e2e, `fill`/`click` sobre un `Combobox` lejos en la pagina hace scroll DESPUES de la
primera tecla y React Aria cierra la lista y repone el texto («cu» → «u»): scroll antes + dos rAF. La `listbox` del
`Combobox` mide 10 px menos que el input (el ancho es del `Popover`). `rg -nw MUTATION` encuentra la caché de `.next`:
excluirla. `next dev` del e2e reescribe los `next-env.d.ts` (revertir).

**Prompt para retomar:** «Lee docs/estado/claude.md: spec 0161».

## ⇥ ESTADO HISTORICO (2026-10-05, noche) — 0162 Y E2E EN 3100-3102 EN `origin/main` (`3177450`); SIGUE LA 0160

**Hecho (verificado):**
- **0162** implementada en `deb8cc5`, pusheada a `origin/main` (`464ef0c..deb8cc5`) CON el pre-push: `pnpm verify`
  completo en verde (typecheck, lint, format, test, build, e2e, neon merchant). Los cinco campos pasan a
  `isInvalid={props.isInvalid ?? (errorMessage ? true : undefined)}`; harness `?case=server-errors` + tests
  «Form: validationErrors del servidor llegan a los campos» (soft, un caso por campo) y «errorMessage marca el
  campo», en Chromium y WebKit; capturas de la 0159 sin cambios. Rojo primero en los cinco; M1 (`choice-group`)
  y M2 (`text-field`) rojas por la asercion esperada y revertidas. Detalle en la seccion «Implementacion».
  #76 resuelto en PARQUEADO. Deploy de Vercel de `deb8cc5` sin verificar (sin cambio visible esperado).
- El primer `pnpm verify` dio `test:e2e` ROJO por `EADDRINUSE :3002`: el `next dev` de `sintetica/apps/panel`
  lo lanza OTRA sesion de Claude y lo relanza a los ~30 s. Con OK del owner se mato (kill pegado al arranque).

**Siguiente, en orden:**
1. **0160** (Dialog, Combobox + `places-search.tsx`, Tabs, SegmentedControl, Switch, ProgressBar, Link): se escribe
   al empezar, sumando piezas al final de la pagina por defecto de `ui-kit-entry.tsx`. Despues la 0161.
2. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`.

**Pendientes del owner:** borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar; deploys de `b1ab123` y `d797c21` sin verificar.

**Decidido por el owner (2026-10-05):** `.env.example` queda como esta (todavia lista Geoapify): «dejalo, no hace
falta sacarlos». La clave real `GOOGLE_MAPS_API_KEY` esta en `apps/merchant/.env.local`. No volver a pedirlo.

**Hallazgos abiertos:** PARQUEADO #74, #75 (flakes del pre-push), #77 (diferido por el owner); H4 de la 0155.

- **E2E en 3100/3101/3102** (`3a79c22`, N0, owner: «si hacemos que e2e tenga 3100»): `tests/e2e/support/ports.ts`
  es la unica fuente; `playwright.config.ts` levanta `next dev --port 31xx` por app; health, onboarding y los
  `*-authenticated` leen de ahi. `pnpm run test:e2e` → `139 passed`, `21 skipped`, exit 0, con el 3002 libre para
  sintetica. Los `localhost:3001` de `apps/**` son tests con `Request` en memoria (sin servidor): no se tocaron.
  Pusheado con `edfa9ee` y su estado: `deb8cc5..3177450`, pre-push `verify: ok` (e2e en 31xx).

**Gotchas de esta sesion:** `next dev` del `webServer` reescribe los tres `next-env.d.ts` (revertir antes de
commitear); `rg -n MUTATION` sobre `tests` choca con `E2E_LOYALTY_MUTATION_TEST` (usar `-w`); `export { x } from`
no declara `x` en el modulo (el fixture que lo usa da `ReferenceError`). Visto UNA vez con la suite completa:
`loyalty-tour-help` «cierre espera confirmación…» → «Tearing down "loyaltyHarness" exceeded 30000ms»; suelto 9/9
y la suite siguiente verde. Si se repite, va a PARQUEADO.

**Descartado:**

| Camino | Por que |
|---|---|
| Caso `server-errors` en la pagina por defecto del harness | cambia las 8 capturas de la 0159; con `?case=` quedan igual |
| `expect` duro en el bucle de campos | corta en el primero: no muestra el rojo de los cinco |

**Prompt para retomar:** «Lee docs/estado/claude.md: spec 0160».

## ⇥ ESTADO HISTORICO (2026-10-05, noche) — 0162 EN `origin/main` (`deb8cc5`); E2E EN PUERTOS 3100-3102 (`3a79c22`, LOCAL); SIGUE LA 0160

**Hecho (verificado):**
- **0162** implementada en `deb8cc5`, pusheada a `origin/main` (`464ef0c..deb8cc5`) CON el pre-push: `pnpm verify`
  completo en verde (typecheck, lint, format, test, build, e2e, neon merchant). Los cinco campos pasan a
  `isInvalid={props.isInvalid ?? (errorMessage ? true : undefined)}`; harness `?case=server-errors` + tests
  «Form: validationErrors del servidor llegan a los campos» (soft, un caso por campo) y «errorMessage marca el
  campo», en Chromium y WebKit; capturas de la 0159 sin cambios. Rojo primero en los cinco; M1 (`choice-group`)
  y M2 (`text-field`) rojas por la asercion esperada y revertidas. Detalle en la seccion «Implementacion».
  #76 resuelto en PARQUEADO. Deploy de Vercel de `deb8cc5` sin verificar (sin cambio visible esperado).
- El primer `pnpm verify` dio `test:e2e` ROJO por `EADDRINUSE :3002`: el `next dev` de `sintetica/apps/panel`
  lo lanza OTRA sesion de Claude y lo relanza a los ~30 s. Con OK del owner se mato (kill pegado al arranque).

**Siguiente, en orden:**
1. **0160** (Dialog, Combobox + `places-search.tsx`, Tabs, SegmentedControl, Switch, ProgressBar, Link): se escribe
   al empezar, sumando piezas al final de la pagina por defecto de `ui-kit-entry.tsx`. Despues la 0161.
2. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`.

**Pendientes del owner:** `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar; deploys de `b1ab123` y `d797c21` sin verificar.

**Hallazgos abiertos:** PARQUEADO #74, #75 (flakes del pre-push), #77 (diferido por el owner); H4 de la 0155.

- **E2E en 3100/3101/3102** (`3a79c22`, N0, owner: «si hacemos que e2e tenga 3100»): `tests/e2e/support/ports.ts`
  es la unica fuente; `playwright.config.ts` levanta `next dev --port 31xx` por app; health, onboarding y los
  `*-authenticated` leen de ahi. `pnpm run test:e2e` → `139 passed`, `21 skipped`, exit 0, con el 3002 libre para
  sintetica. Los `localhost:3001` de `apps/**` son tests con `Request` en memoria (sin servidor): no se tocaron.
  **Sin pushear** (junto con este estado y `edfa9ee`, al proximo push; Hobby).

**Gotchas de esta sesion:** `next dev` del `webServer` reescribe los tres `next-env.d.ts` (revertir antes de
commitear); `rg -n MUTATION` sobre `tests` choca con `E2E_LOYALTY_MUTATION_TEST` (usar `-w`); `export { x } from`
no declara `x` en el modulo (el fixture que lo usa da `ReferenceError`). Visto UNA vez con la suite completa:
`loyalty-tour-help` «cierre espera confirmación…» → «Tearing down "loyaltyHarness" exceeded 30000ms»; suelto 9/9
y la suite siguiente verde. Si se repite, va a PARQUEADO.

**Descartado:**

| Camino | Por que |
|---|---|
| Caso `server-errors` en la pagina por defecto del harness | cambia las 8 capturas de la 0159; con `?case=` quedan igual |
| `expect` duro en el bucle de campos | corta en el primero: no muestra el rojo de los cinco |

**Siguiente antes de la 0160:** pushear `edfa9ee`, `3a79c22` y este estado juntos (el pre-push corre la e2e en 31xx).

**Prompt para retomar:** «Lee docs/estado/claude.md: spec 0160».

## ⇥ ESTADO HISTORICO (2026-10-05, noche) — SPEC 0162 (#76) IMPLEMENTADA Y EN `origin/main` (`deb8cc5`); SIGUE LA 0160

**Hecho (verificado):**
- **0162** implementada en `deb8cc5`, pusheada a `origin/main` (`464ef0c..deb8cc5`) CON el pre-push: `pnpm verify`
  completo en verde (typecheck, lint, format, test, build, e2e, neon merchant). Los cinco campos pasan a
  `isInvalid={props.isInvalid ?? (errorMessage ? true : undefined)}`; harness `?case=server-errors` + tests
  «Form: validationErrors del servidor llegan a los campos» (soft, un caso por campo) y «errorMessage marca el
  campo», en Chromium y WebKit; capturas de la 0159 sin cambios. Rojo primero en los cinco; M1 (`choice-group`)
  y M2 (`text-field`) rojas por la asercion esperada y revertidas. Detalle en la seccion «Implementacion».
  #76 resuelto en PARQUEADO. Deploy de Vercel de `deb8cc5` sin verificar (sin cambio visible esperado).
- El primer `pnpm verify` dio `test:e2e` ROJO por `EADDRINUSE :3002`: el `next dev` de `sintetica/apps/panel`
  lo lanza OTRA sesion de Claude y lo relanza a los ~30 s. Con OK del owner se mato (kill pegado al arranque).

**Siguiente, en orden:**
1. **0160** (Dialog, Combobox + `places-search.tsx`, Tabs, SegmentedControl, Switch, ProgressBar, Link): se escribe
   al empezar, sumando piezas al final de la pagina por defecto de `ui-kit-entry.tsx`. Despues la 0161.
2. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`.

**Pendientes del owner:** `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar; deploys de `b1ab123` y `d797c21` sin verificar.

**Hallazgos abiertos:** PARQUEADO #74, #75 (flakes del pre-push), #77 (diferido por el owner); H4 de la 0155.

**Gotchas de esta sesion:** otra sesion (sintetica) ocupa el 3002 y lo relanza: matarlo en el MISMO comando que
lanza la e2e/el push; `next dev` del `webServer` reescribe los tres `next-env.d.ts` (revertir antes de commitear);
`rg -n MUTATION` sobre `tests` choca con `E2E_LOYALTY_MUTATION_TEST` (usar `-w`); este commit de estado queda
local hasta el proximo push (Hobby).

**Descartado:**

| Camino | Por que |
|---|---|
| Caso `server-errors` en la pagina por defecto del harness | cambia las 8 capturas de la 0159; con `?case=` quedan igual |
| `expect` duro en el bucle de campos | corta en el primero: no muestra el rojo de los cinco |

**Prompt para retomar:** «Lee docs/estado/claude.md: spec 0160».

## ⇥ ESTADO HISTORICO (2026-10-05, noche) — SPEC 0162 (N1, #76) CERRADA (`2cc6071`), SIN IMPLEMENTAR

**Hecho (verificado):**
- **Spec 0162** `docs/specs/0162-errores-del-servidor-en-los-campos-del-kit.md` (`2cc6071`, fila en INDEX): los
  cinco campos pasan a `isInvalid={props.isInvalid ?? (errorMessage ? true : undefined)}`. Numero 0162 porque la
  0160 y la 0161 estan reservadas en el ADR 0123.
- **Medido con harness temporal (Chromium), ya borrado:** codigo actual + `Form validationErrors` → nada en los
  cinco (sin mensaje, sin `aria-invalid`, descripcion vacia). Con el fix → descripcion accesible = mensaje en los
  cinco; `aria-invalid` en todos menos el boton del `Select`. Con el fix, `isRequired` vacio y email invalido en
  modo `aria` siguen sin marcarse y el envio llega (la medicion de la 0159 estaba confundida por este bug, pero
  la conclusion aguanta). `validationErrors`/`validate` no se usan en pantallas → sin cambio visible esperado.
- CI de `main` (`464ef0c`) estaba `in_progress` al arrancar; no se sondeo (regla del owner).

**Siguiente, en orden:**
1. **Implementar la 0162** (N1, sin subagentes): tests rojos primero (`?case=server-errors` + «Email»), fix en
   los cinco campos, 2 mutaciones, `pnpm verify` una vez, cerrar #76 en PARQUEADO, push.
2. 0160 (Dialog, Combobox + `places-search.tsx`, Tabs, SegmentedControl, Switch, ProgressBar, Link) y 0161: se
   escriben al empezar cada una, sumando piezas al final de `ui-kit-entry.tsx` (pagina por defecto).
3. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`.

**Pendientes del owner:** `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar; deploys de `b1ab123` y `d797c21` sin verificar.

**Hallazgos abiertos:** PARQUEADO #74, #75 (flakes del pre-push), #76 (spec 0162), #77 (diferido por el owner);
H4 de la 0155.

**Gotchas de esta sesion:** en zsh `for f in $F` no parte la variable (lista literal); `next dev` del
`webServer` de Playwright reescribe los tres `next-env.d.ts` (revertir antes de commitear); `rg -n MUTATION`
sobre `tests` choca con `E2E_LOYALTY_MUTATION_TEST` (usar `-w`).

**Descartado:**

| Camino | Por que |
|---|---|
| Caso `server-errors` en la pagina por defecto del harness | cambia las 8 capturas de la 0159; con `?case=` quedan igual |
| Capturas del caso `server-errors` | el oraculo es de accesibilidad; el aspecto ya lo cubre «Email» |

**Prompt para retomar:** «Lee docs/estado/claude.md: implementar la spec 0162».

## ⇥ ESTADO HISTORICO (2026-10-05, noche) — SPEC 0159 IMPLEMENTADA (`d797c21`), PUSH A `origin/main` SIN VERIFY; SIGUE LA N1 DE #76

**Hecho (verificado):**
- **0159** en `motor` `d797c21`, pusheada a `origin/main` con `--no-verify` (owner: «hacemos el push sin verificar
  para que no falle», por los flakes #74/#75); deploy de Vercel sin verificar: `Heading`, `Text`, `Card`, `PageHeader`, `Form`/`FormSection`/
  `FormActions` en `apps/merchant/src/ui`; `BrandTheme`/`resolveBrandTheme` borrados. Harness
  `tests/e2e/support/ui-kit-entry.tsx` + `ui-kit-checks.ts`; `ui-kit.spec.ts` (Chromium) y `ui-kit.webkit.spec.ts`:
  16/16 local; `CI=1` → 4 passed / 12 skipped. Referencias 4 + 4 `*-darwin.png` (la spec decia 8 + 8: error de cuenta).
  Capturas para el owner: https://claude.ai/artifact/L9rd4vPQoGuNNMTkkYSeZ3
- M1–M3 rojas por la asercion esperada. **M4 sobrevivio** con la tolerancia por defecto → capturas con `threshold: 0`
  (estable 2/2 sin mutar; M4 8/8 roja). Oraculo de `Form` reescrito (el de la spec era imposible con `aria`): detalle
  en la seccion «Implementacion» de la spec.
- `pnpm verify`: todo ok salvo `typecheck` ROJO por cache viejo de `.next/types/validator.ts` (rutas borradas en la
  0155); el `build` lo regenero y `pnpm typecheck` despues → 6/6. Tabla en la spec.

**Siguiente, en orden:**
1. **Spec chica N1 para #76** (owner: «añade la spec chica N1 antes de 160»): `validationErrors` del `Form` llega a
   `TextField`, `SelectField`, `NumberField`, `TextAreaField`, `ChoiceGroup` (hoy `isInvalid={props.isInvalid ??
   Boolean(errorMessage)}` pisa el error del servidor; fix candidato `errorMessage ? true : undefined`). Rojo primero
   en el harness del kit (`ui-kit-checks.ts`), un caso por campo; correr los e2e de wizard/programa/Staff (usan esos
   campos). Si cambia el aspecto, regenerar capturas mirandolas.
2. 0160 (Dialog, Combobox + `places-search.tsx`, Tabs, SegmentedControl, Switch, ProgressBar, Link) y 0161: se
   escriben al empezar cada una, sumando piezas al final de `ui-kit-entry.tsx`.
3. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`.

**Pendientes del owner:** `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar; deploy de `b1ab123` sin verificar.

**Hallazgos abiertos:** PARQUEADO #74, #75 (flakes del pre-push), #76 (siguiente), #77 (diferido por el owner: «quizas lo
cambiamos»); H4 de la 0155.

**Gotchas de esta sesion:** Tailwind del harness solo genera clases usadas en `apps/merchant` (layout del harness
inline); un `next dev` de otro proyecto en el 3001 cuelga el `webServer` de Playwright (se mato con OK del owner);
el hook `foreign-staged.sh` exige los paths borrados con `git rm` escritos literales en el `git commit --`.

**Descartado:**

| Camino | Por que |
|---|---|
| Tolerancia de captura por defecto | M4 (sombra) pasaba verde |
| Oraculo «requerido vacio → `aria-invalid`» en `Form` | con `aria` React Aria no lo marca ni frena el envio |
| Arreglar `isInvalid` de los campos en la 0159 | cambia campos en uso: fuera de alcance (#76) |
| Capturas de Linux / en CI | owner: sus usuarios usan Windows y Mac |

**Prompt para retomar:** «Lee docs/estado/claude.md: spec chica N1 de #76».

## ⇥ ESTADO HISTORICO (2026-10-05, tarde) — SPEC 0159 (FASE 0b, REBANADA 1: TIPOGRAFIA, SUPERFICIES, FORMULARIOS) CERRADA, SIN IMPLEMENTAR

**Hecho (verificado):**
- **0158** en `origin/main` `b1ab123` (push con `--no-verify`, OK del owner por los flakes #74/#75). Deploy de Vercel
  sin verificar.
- Rama `motor` (worktree `check-point-wt/motor`) adelantada por fast-forward a `ui-sistema` `78d1829`; ahora es el
  punto de trabajo. `764718b`: spec 0159 `cerrada` + enmienda del ADR 0123 (particion de la 0b en 0159/0160/0161;
  capturas solo de Mac, owner: «no me interesa linux, me interesa que se vean en windows y mac») + fila en INDEX.
  Sin push.

**Siguiente, en orden:**
1. **Implementar la 0159** (N1, sesion principal, sin subagentes): `docs/specs/0159-kit-tipografia-superficies-y-formularios.md`.
   Primero el rojo (harness sin piezas), despues piezas, capturas `--update-snapshots` mirandolas + Artifact para el
   owner, M1–M4, `pnpm verify` una vez al final. Ojo: el pre-push puede caer por los flakes #74/#75.
2. 0160 (Dialog, Combobox + `places-search.tsx`, Tabs, SegmentedControl, Switch, ProgressBar, Link) y 0161 (campos
   file/color/time/datetime-local/range/search): se escriben al empezar cada una.
3. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`.

**Pendientes del owner:** `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar.

**Hallazgos abiertos:** PARQUEADO #74 y #75 (flakes que bloquean el pre-push; spec chica pendiente); H4 de la 0155.
Rama `ui-sistema` (worktree `motor-wt/onboarding-google`) queda detras de `motor`.

**Descartado:**

| Camino | Por que |
|---|---|
| Trinquete con `tools/ui-baseline.json` | se puentea subiendo el JSON: se compara contra el merge-base con git |
| Guardias antes de completar el kit | obliga a hacer a mano lo que el kit no tiene (paso con `places-search.tsx`) |
| Pagina de muestra en `/backoffice/_ui` | en Next una carpeta `_x` no se rutea: va como harness de e2e |
| `driver.css` sin capa (como decia la spec) | sus reglas sin capa le ganan a `legacy`: rompio los tours |
| No reindentar `globals.css` | `format:check` lo exige dentro de `@layer` |
| Capturas de Linux / en CI | owner: sus usuarios usan Windows y Mac; sin Docker no se generan aca |
| La 0b en una sola spec | ~13 piezas: se parte en tres rebanadas N1 |

**Prompt para retomar:** «Lee docs/estado/claude.md: implementar la 0159».

## ⇥ ESTADO HISTORICO (2026-10-04, noche) — ALTA CON GOOGLE PLACES (0155) + PERMISO DE ALTA BORRADO Y PROGRAMA SIN EMAIL (0156): PASS, ESPERA LA UI DE GPT

**Que paso:** el owner rediseño el alta del comercio (ADR 0121): (1) negocio buscado en Google Places, (2) email que
crea la cuenta, (3) confirmacion; programa y QR salen del wizard; Google reemplaza a Geoapify en todo el merchant
(Essentials, sin horarios ni Time Zone API). Despues decidio borrar el permiso de alta, forzar emails en minusculas en
la base y que el programa (ver, crear, editar, sello, plantillas, QR) no exija email verificado (ADR 0122).

**Donde esta:** worktree `motor-wt/onboarding-google`, rama `onboarding-google` desde `origin/main` `1927742` (que ya
trae la 0153 + UI 0154 de GPT). Spec 0155 `07e345e` (PASS `0c9e151`; smoke contra Google real ok). Spec 0156
`3411fab` + `931fa2b` (PASS `26f60b6`), docs `5b90b5d`. Migracion `0065_borrar_permiso_de_alta.sql` aplicada SOLO a
`ci-integration`. **Sin push, a proposito:** la UI vieja llama a `/api/merchant/auth/start` y `/api/onboarding/business`
(404 desde la 0155).

**Siguiente:** GPT escribe su spec de UI sobre `docs/specs/0155-contratos-de-api.md`, hace `git rebase onboarding-google`
y UN push con todo. Despues: deploy READY en Vercel; en PROD `select count(*) from merchant_auth."user" where email <>
lower(email)` → 0; migracion 0065 a PROD (owner aprueba la llamada); **desde ahi no hay rollback de codigo anterior a
`3411fab` sin reponer la columna**. Probar la regla de Vercel «Places por IP» (61 requests a `/api/places/` → 429) y
cerrar PARQUEADO #70 con su ADR corto. QA del owner: alta con comercio real, con «santa maria y puerto de palos», con
email ya registrado, local nuevo en el backoffice, programa con cuenta sin verificar.

**Pendientes del owner:** `.env.example` (las dos de Geoapify → `GOOGLE_MAPS_API_KEY=`; el agente no tiene permiso
sobre `.env*`); borrar `GEOAPIFY_API_KEY` y `NEXT_PUBLIC_GEOAPIFY_API_KEY` en Vercel despues del deploy.

**Hallazgos abiertos:** PARQUEADO #74 (flake de catalogo en la Neon completa); H4 de la 0155 (un 400 de Google por clave
invalida en Details se ve como `place_not_found`). Lo anterior a este arco (0153/0154 en PROD con la UI de GPT, QA del
owner de 0143–0149, lote `pass_refresh`, PARQUEADO #69) sigue como estaba.

**Prompt para retomar:** «Lee docs/estado/claude.md: 0155 y 0156 con PASS en `onboarding-google`, esperan la UI de GPT».

## ⇥ ESTADO HISTORICO (2026-10-04, tarde) — 0153 (EL SISTEMA VALIDA EL CUPON) IMPLEMENTADA EN `motor`, PASS. ESPERA LA UI DE GPT

**Que paso:** QA del owner sobre la 0148/0149: «el merchant no tiene que validar el cupon manualmente lo tiene que hacer
el sistema». Decision en el ADR 0120 (sin «Validar»; veredicto verde/rojo al escanear; la venta consume; «Quitar»
siempre; extras con la venta; producto gratis/2x1 se agrega solo al carrito). Servidor: spec 0153 (renumerada: el 0152
es de GPT en `origin/main`), contrato `docs/specs/0153-contratos-de-api.md`.

**Donde esta:** rama `motor` rebasada sobre `origin/main` (`1ea1e5e`): `526db75` ADR+spec, `432f680` renumeracion,
`2adc79b` codigo (PASS del revisor; `pnpm verify` verde; R3 sin oraculo de carrera, en `TASKS.md`), `40291da` y
`f834ac1` docs, `d9f6a88` limpieza pedida por el owner (`buildCouponBody` y la visita redundante del canje; `pnpm
verify` verde). **Sin push, a proposito:** sin la UI de GPT un cupon no-descuento elegido bloquea la venta.

**Siguiente:** el owner le pasa a GPT el sha de `motor` (el ultimo commit de este estado); GPT escribe su spec 0154,
hace `git rebase motor` en su `main`, implementa la UI y hace UN push con todo. Despues: deploy READY en Vercel y QA
del owner (Panaderia, «Cafe americano gratis»: verde sin validar → salir sin consumir → venta con el cafe agregado solo;
vencido → rojo → «Quitar»). Si `motor` cambia antes, GPT tiene que re-rebasear.

**Hallazgos a decidir (owner), de la 0153:** un cupon en rojo no se aplica y la venta sale sin el (consecuencia de
diseño, no la dijo el owner);
el push de la orden no menciona las unidades extra del cupon.

**En PROD (`24ce0df`):** 0148 + 0149 + 0150 (falta `QA_LOGIN_ENABLED=true` en Vercel merchant). Skills temporales de
QA: `qa-cupones-prueba`, `qa-cupon-valido`, `delete-user`.

**Pendientes:** los de la 0151 (en `claude-historico.md`); QA del owner (0143/0146/0147/0148/0149); lote
`pass_refresh` (0146); PARQUEADO #69; Postgres local para tests; test de carrera del limite diario (R3, `TASKS.md`).

**Prompt para retomar:** «Lee docs/estado/claude.md: la 0153 espera la UI de GPT».

## ⇥ ESTADO HISTORICO (2026-10-04, cierre) — 0151 (ARNES NUEVO) COMMITEADA. PUSH PENDIENTE DEL OWNER

**Al retomar:** `git fetch && git merge --ff-only origin/main` (rama `motor`, sin upstream). Si `origin/main` no tiene
todavia `f4c2919`, el push no se hizo: lo corre el owner (`GH_TOKEN= git push origin HEAD:main` desde este worktree; el
clasificador de auto mode le bloquea el push a Claude). El `main` local de GPT se adelanto por fast-forward hasta el
commit de este estado: su proximo push tambien lo arrastra.

**Desde ahora rige el arnes de la 0151:** niveles N0/N1/N2 de `CLAUDE.md` (N0 directo, sin spec ni subagentes; subagentes
solo en N2), Stop hook con huella (46 s → 0 s sin cambios, reproducido), `tasks-fresh` solo avisa, un solo bloque de
estado (el viejo va a `claude-historico.md`; la skill `handoff` ya lo dice).

**En PROD (`24ce0df`):** 0148 (cupon elegido, Claude) + 0149 (UI, GPT) + 0150 (login de QA: API + botones, decision del
owner; falta `QA_LOGIN_ENABLED=true` en Vercel merchant). Skills temporales de QA: `qa-cupones-prueba`,
`qa-cupon-valido`, `delete-user`; productos «Prueba» en Panaderia/Barberia/Gym. Se borran al cerrar las pruebas.

**Hallazgos a decidir (owner), de la 0151:** revisor independiente (no corrido); bajar `claude-md-size.sh` a 100
lineas/6 KB; la huella no incluye HEAD (un pull no re-corre gates; lo cubren pre-push y CI).

**Pendientes:** QA del owner (0143/0146/0147/0148/0149); lote `pass_refresh` (0146); PARQUEADO #69 (Vercel Hobby);
Postgres local para tests (medir antes/despues, informe «Flujo agil con Claude Code»); revisor de la 0149.

**Prompt para retomar:** «Lee docs/estado/claude.md y seguimos con el QA».

## ⇥ ESTADO HISTORICO (2026-10-04) — 0148 + 0149 (UI de GPT) EN PROD (`3006a2f`). TOCA QA DEL OWNER

**Al retomar:** `git fetch` + `git merge --ff-only origin/main` (rama `motor` sin upstream). `origin/main` = `3006a2f`:
el push unico de GPT con la 0148 (Claude) y la 0149 (UI de GPT). **Deploy verificado** (status del commit por la API de
GitHub, 2026-10-04 14:43 UTC): merchant, customer y public `success` en `3006a2f`. 0064 en PROD desde el 2026-10-03.

**0150 commiteada (`b83134e`), SIN PUSHEAR:** API `qa-login` (implementador, cortado por Claude con la API completa;
unidad 27/27, typecheck/lint/prettier ok; sin revisor por decision del owner) + botones en el login (Claude, zona GPT por
decision del owner → avisar a GPT). El push lo bloqueo el clasificador de auto mode: lo corre el owner. Despues: deploy
`READY` y `QA_LOGIN_ENABLED=true` en el proyecto merchant de Vercel (owner).

**Pendiente:**
- **QA del owner de 0148/0149** (pasos en la spec 0148 §«QA del owner») y los de antes: 0143, 0146, 0147.
- **La 0149 no tiene revisor independiente** (su spec lo deja «posterior»; presupuesto de mutaciones 0). Ofrecido al owner.
- `docs/estado/gpt.md` en `3006a2f` todavia dice «No se ha pusheado» (zona de GPT: avisar).
- Lote `pass_refresh` de la 0146 (OK del owner); PARQUEADO #69 (Vercel Hobby); build Turbopack rojo en el entorno de GPT.
- **QA con datos de prueba en PROD** (pedido del owner, 2026-10-04): 17 productos en la categoria «Prueba» de Panaderia,
  Barberia y Gym, y la skill TEMPORAL `.claude/skills/qa-cupones-prueba/` (habilitar hoy / resetear canjes por MCP).
  Las dos cosas se borran cuando el owner cierre las pruebas.

## ⇥ ESTADO HISTORICO (2026-10-03, noche, 3) — 0148 IMPLEMENTADA (`b937eb5`) Y 0064 EN PROD. SIN PUSH: LO HACE GPT

**Al retomar:** `motor` = `origin/main` (`afa6e77`) + `9197529` + **`b937eb5`** (codigo 0148) + commits de estado. **El
`main` LOCAL (checkout de GPT) se adelanto por fast-forward hasta este commit**: GPT trabaja encima y su push arrastra
todo (decision del owner, 2026-10-03: «cuando GPT haga el push arrastre todo su trabajo y el tuyo para tener un solo
push»). **Claude no pushea la 0148.**

**0064 en PROD** (owner: «vamos a aplicar la migracion pero no el push», 2026-10-03), por `run_sql_transaction` en la
rama default `br-curly-silence-ax8acywm`. Verificado por SQL: 5 columnas, 5 constraints (check de una via), 2 indices,
fila 65 de `drizzle.__drizzle_migrations` con hash `f99cc2b96ca7…` = `shasum -a 256` del `.sql`; `core`/`consumer`/
`merchant_auth` intactos. Es aditiva: el codigo viejo de PROD sigue andando.

**Hecho y verificado (0148):** PASS del revisor independiente; Neon completo verde (implementador); `coupon-scope.neon` 3/3
y R1–R3 rojas medidas por el orquestador. Contrato y spec ajustados; spec `implementada`.

**Siguiente:** cuando GPT pushee: `pnpm ci:status` no se espera; verificar deploy `READY` de merchant y customer con su
sha. Avisos ya en el prompt de GPT (contrato 0148, «Puntos +0 coupon», `stages.tsx` 337 lineas, `.counter-coupon`
huerfano, `types.test.ts:96`). Para el owner: deadlock posible declarado en la spec; quitar un validado no revierte
`last_visit_at`.

**Siguen abiertos de antes** (bloques de abajo): QA del owner de 0143/0146/0147, lote `pass_refresh`, PARQUEADO #69.

## ⇥ ESTADO HISTORICO (2026-10-03, cierre 2) — SPEC 0148 CERRADA Y EN `main` (`afa6e77`). SIGUE: LANZAR EL IMPLEMENTADOR

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `afa6e77` (+ el commit de este
estado). Sin codigo tocado en esta sesion.

**Hecho (sesion del canje de cupones):**
- El owner probo el canje de cupon en el mostrador y lo declaro inservible. Investigacion (6 notas + informe):
  `reports/Canje de cupones en mostrador móvil.md` y `research_notes/Canje de cupones en mostrador móvil/`.
- **ADR 0119** (`c91d989`): las 16 decisiones del owner — el cliente elige el cupon en la PWA, el mostrador lo valida
  o lo aplica en la venta, se ata a la venta con puntos sobre el neto, quitable, 1 por cliente + comercio + dia.
- **Spec 0148 `cerrada`** + contrato `specs/0148-contratos-de-api.md` (`afa6e77`), pusheados (`verify: ok`, solo docs).

**Siguiente (Claude):** lanzar UN `implementador` sobre la spec 0148 (migracion 0064 primero, en rama Neon efimera con
`tools/neon-test.sh`, nunca contra `DATABASE_URL`) y despues UN `revisor` con el presupuesto de la spec (10 mutaciones;
el lock de `business_customer` declarado sin mutacion). Al PASS: pedir OK del owner para la 0064 en PROD, avisar a GPT
(contrato 0148: pantallas del mostrador y de la PWA) y al owner que el mostrador queda sin cupones hasta esa UI.

**Prompt para retomar:** «Lee docs/estado/claude.md y lanza el implementador de la spec 0148».

**Siguen abiertos de antes** (bloque de abajo): QA del owner de 0143/0146/0147, lote `pass_refresh`, avisos a GPT,
PARQUEADO #69 (Vercel Hobby: cada push = 3 deploys).

## ⇥ ESTADO HISTORICO (2026-10-03, cierre) — 0143, 0144, 0146 Y 0147 EN `main` (`e667005`). TOCA QA DEL OWNER

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `e667005` (mas el commit de este
handoff). Arbol limpio (salvo `.pnpm-store`, ignorable).

**Hecho hoy (todo con PASS de revisor independiente y `pre-push` `verify: ok`):**
- **0143** venta cruzada por la compra (`ab5e62e`) + migracion **0063 en PROD** (verificada por SQL).
- **0144** atraso de la loteria por comercio (`fdb4e42`); decisiones del owner en ADR 0117 «Cerrado despues».
- **0146** icono de la PWA en el pase Apple (`5c855c7`); `PASS_BRAND_UPDATED_AT` = `2026-10-03T22:00:00Z`.
- **0147** `sourceFileName` en el DTO de la importacion con IA (`a8a66ba`), en las 9 respuestas.
- Rama Neon `bench-clientes-comercio` (4,4 GB) borrada con OK del owner.
- Deploy: merchant y customer `success` en `e667005`; public con rate limit de Vercel Hobby (no le toca nada de esto).

**QA del owner (lo que hay para probar):**
1. **0143:** dos comercios de rubros distintos a < 2 km, cruzada activa en B con fecha de fin, cliente con notificaciones
   de la PWA; acreditar en A entre 7:00 y 17:40 → cupon de B en «Mis beneficios» y push «🎁 Tenés un regalo» 3–13 min
   despues («Run now» en cron-job.org para no esperar).
2. **0146:** pase de QA firmado con el certificado real en iPhone → la notificacion del pase muestra la «c» de la PWA;
   logo, strip, nombre y QR iguales; anotar version de iOS.
3. **0147:** importar un PDF con IA en el merchant, recargar mientras analiza → la tarjeta conserva el nombre real.

**Siguiente (Claude, despues del QA):**
- **Lote `pass_refresh` de la 0146 a PROD** (con OK del owner): comprobar las variables APNs del worker de merchant, excluir
  pases solo-hash, muestra y despues lote una vez (`docs/wallet/apple-wallet-design-and-release.md` §«Pasar a vivo»).
- **Avisar a GPT**: C1/C2 → 404 y `endsAt` obligatorio (la 0145 de GPT ya lo consume); `sourceFileName` viene siempre.
- **PARQUEADO #69** (owner): Vercel Pro y/o «Ignored Build Step». Mientras siga en Hobby: juntar los commits de docs en el
  push del trabajo (cada push = 3 deploys; tope 100/dia, ventana movil).

**Pendientes de antes:** CI de `main` sin mirar con `pnpm ci:status`; los de la 0138; `AGENT-WORKFLOW.md`/agentes con
bitacora a `TASKS.md`; `.prettierignore` con `docs/`; #68; borrar `motor-wt/fix-notices-mock`; `CRON_SECRET` rotable.

## ⇥ ESTADO HISTORICO (2026-10-03, noche, 2) — SPEC 0147 IMPLEMENTADA (`a8a66ba`), `sourceFileName` EN EL DTO DE IMPORTACION

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `a8a66ba` + este commit de estado.

**Hecho:** spec **0147** (`sourceFileName` en las 9 respuestas de `toImportDTO`: PDF → `original_name`, imagenes → `null`;
lector `catalog-import/source-file.ts` por `import_id` + `business_id`; DTO en `dto.ts`). PASS del revisor (M1, M3 rojas; R1
sobrevive → declarado en la spec). El orquestador re-corrio contract/routes 17/17 y la suite Neon nueva 5/5. Timeout 60 s en
`catalog-import.neon…:143` (el intermitente conocido, sin tocar aserciones).

**Siguiente:** avisar a GPT que `sourceFileName` viene siempre (su UI ya lo acepta; no cambia nada). Pendientes del owner de
antes: QA en iPhone de la 0146 y el lote `pass_refresh`; QA de la 0143.

## ⇥ ESTADO HISTORICO (2026-10-03, noche) — 0143, 0144 Y 0146 EN `main` (`5c855c7`). PENDIENTES DEL OWNER: QA IPHONE Y LOTE `pass_refresh`

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `5c855c7` (mas este commit de estado).

**Hecho:** 0143 (venta cruzada por la compra) y 0144 (atraso por comercio) desplegadas (`61c067e`); 0063 en PROD. **0146**
(icono de la PWA en el pase Apple) en `main` (`5c855c7`): solo `icon*` cambia (logo/strip byte a byte iguales),
`PASS_BRAND_UPDATED_AT` = `2026-10-03T22:00:00Z`, Google sin tocar. PASS del revisor (R1–R3 rojas); el orquestador sumo el
caso «pase instalado bajo la revision anterior → 200» y lo midio rojo con la fecha vieja (`expected 304 to be 200`).
`pre-push`: `verify: ok`. La 0145 es de GPT (UI de la venta cruzada).

**Deploy (2026-10-03, 22:4x UTC):** merchant `success` con `981662e` (incluye la 0146 y el `e61e3d5` de GPT). customer y
public `failure` por «rate limited — retry in 24 hours» en `981662e`, pero siguen en `5c855c7`, y desde ahi solo cambiaron
archivos de merchant y docs: el codigo que sirven es el actual. Rama Neon `bench-clientes-comercio` (4,4 GB) BORRADA con OK
del owner. Este commit de estado no se pusheo (para no gastar builds de Hobby).

**Pendiente del owner para la 0146:** QA en iPhone (notificacion con el icono nuevo) y OK para el lote `pass_refresh` de
produccion (muestra primero; excluir pases solo-hash; variables APNs del worker), segun la spec §«Declarado AFUERA».

**Siguiente (venta cruzada):** avisar a GPT (C1/C2 → 404, `endsAt` obligatorio; la 0145 de GPT ya consume la 0143); QA del
owner de la 0143.

**Hallazgos a decidir (owner), del revisor:** `R` cuenta solo `issued` (en `coupon_conflict` la campaña tambien salio
elegida); F/R se cuentan por campaña (si un comercio recrea su campaña a mitad de mes, su atraso vuelve a cero). Bajo
riesgo, no bloquean.

**Pendientes:** CI de `main` sin mirar en `76ce724`; intermitente de `catalog-import` (timeout 5 s, visto otra vez); los de la
0138; `AGENT-WORKFLOW.md`/agentes con bitacora a `TASKS.md`; `.prettierignore` con `docs/`; #68; borrar
`motor-wt/fix-notices-mock`; `CRON_SECRET` rotable por el owner.

## ⇥ ESTADO HISTORICO (2026-10-03, tarde, 2) — SPEC 0143 CERRADA, CRON-JOB.ORG ANDANDO (`459cfd4`). SIGUIENTE: IMPLEMENTAR LA 0143

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `459cfd4` (mas este commit).

**Hecho:** spec **0143** (Venta cruzada por la compra; migracion **0063** a PROD ANTES del deploy) y **ADR 0118**. El
owner creo el job de cron-job.org (cada 10 min, horas 7–17, `America/Guayaquil`); verificado: «Run now» → HTTP 200 y
**7 `reminder` `sent` en PROD a las 18:24:31 UTC** (SQL). `wallet-push-cron.yml` borrado y el job documentado en
`docs/notificaciones/README.md` §5bis (`459cfd4`). URL del worker: `https://business.checkpass.club/api/internal/wallet-push`.

**Siguiente:** despachar implementador + revisor de la 0143 (7 mutaciones; el item de cron de la DoD ya esta hecho, el
revisor lo tilda). Avisar a GPT del contrato (C1/C2 404, `endsAt` obligatorio en M1). El owner puede rotar
`CRON_SECRET` (no lo tiene anotado): si lo hace, Vercel + redeploy, GitHub (lo usan `marketing-tick` y
`catalog-import-reconcile`) y el header de cron-job.org.

**Pendientes:** CI de `main` sin mirar desde `0b5073a`; intermitente de `catalog-import-guard`; los de la 0138;
`AGENT-WORKFLOW.md`/agentes con bitacora a `TASKS.md`; `.prettierignore` con `docs/`; #68; borrar `motor-wt/fix-notices-mock`.

## ⇥ ESTADO HISTORICO (2026-10-03, tarde) — SPEC 0143 CERRADA (`4c50397`)

Reemplazado por el bloque de arriba el mismo dia.

## ⇥ ESTADO HISTORICO (2026-10-03) — ADR 0117 ACEPTADA (VENTA CRUZADA). SIGUIENTE: ESCRIBIR LA SPEC 4 DEL ADR 0115

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `fd971fe` (mas este commit).

**Hecho:** ADR 0117 aceptada con 15 decisiones del owner: la cruzada se dispara al escanear en A, UN cupon ya emitido de
un comercio cercano de otro rubro, push «regalo misterio» ~3 min despues del de mostrador, loteria H4 (igual por
oportunidad + bono al comercio sin clientes nuevos en el mes) con 20 % de azar editable en `limits.ts`, registro de
cada decision desde el dia uno, exito = canje, sin grupo de control por ahora, una vez por campaña por cliente, la
lista «a pedido» se apaga. Investigaciones en `docs/notificaciones/venta-cruzada-{criterio,algoritmo,equidad}.md` +
`sim_equidad.py`. `.githooks/pre-push` ejecutable en git (`2589922`); **el checkout de GPT lo tiene sin el bit**
(avisado al owner con el `chmod +x` para GPT).

**Siguiente:** escribir la spec 4 (TEMPLATE grande: migracion de las tablas de decision y candidatos). Medir antes:
el disparo desde el escaneo (`persistGrant`/`counter/orders.ts`), la emision del cupon cruzado (`claimCrossOffer`),
el apagado de la lista a pedido (`listCrossOffers` en «Mis beneficios»), y el hallazgo del §«Para la spec» del 0117
(`ends_at` nulo en `cross`). Contrato HTTP para GPT si cambia «Mis beneficios».

**Pendientes:** CI de `main` con el intermitente de `catalog-import-guard` (sin confirmar); los de la 0138; `AGENT-WORKFLOW.md`/agentes con
bitacora a `TASKS.md`; `.prettierignore` con `docs/`; #68; borrar `motor-wt/fix-notices-mock`.

## ⇥ ESTADO HISTORICO (2026-10-02, noche) — SPEC 0141 IMPLEMENTADA Y EN `main` (`d6178b1`). SIGUIENTE: SPEC 4 DEL ADR 0115

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `d6178b1` (mas este commit).

**Hecho hoy:** spec 0139 (canales por la PWA + avisos en Actividad, migracion 0062 en PROD) y spec 0141 (limites de
notificaciones en `packages/domain/src/server/notifications/limits.ts`, sin cambiar valores; mapa en
`docs/notificaciones/README.md`; PASS del revisor, 7 mutaciones rojas; push con el hook completo, `verify: ok`).
Mock de `listConsumerNotices` para la 0140 de GPT en `main` (`0a66bc8`).

**Pendiente:**
- **`.githooks/pre-push` esta en git como `100644`:** en un worktree nuevo el hook NO corre (el push de `0a66bc8` se
  lo salteo). Arreglo: `git update-index --chmod=+x .githooks/pre-push`. Espera el OK del owner.
- **CI de `main` roja en `001b6f0`** segun el agente del mock: `catalog-import-guard.neon…:103` (`expected 201 to be 409`),
  intermitente conocido de `catalog-import`. Sin confirmar por `ci:status`.
- **LECCIONES:** dos specs seguidas con filas del plan de pruebas falsas contra el arbol (0139 M3 sin `sent_at`; 0141
  M1, ruta del test en `packages/`, centinelas 1/1). La regla ya existe; falta el caso en `LECCIONES.md`.
- Spec 4 del ADR 0115 (aviso de la Venta cruzada): el como lo cierra el owner ANTES de escribirla.
- De antes: los de la 0138 (`audience-preview`, `rewards/results`, `balance-push`), `AGENT-WORKFLOW.md`/agentes con
  bitacora a `TASKS.md`, `.prettierignore` con `docs/`, #68. Worktree `motor-wt/fix-notices-mock` del agente del mock
  (borrable).

## ⇥ ESTADO HISTORICO (2026-10-02, noche) — SPEC 0139 IMPLEMENTADA Y EN `main` (`d6368c8`). SIGUIENTE: SPEC 3 DEL ADR 0115

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `d6368c8` (mas este commit).

**Hecho:** ADR 0116 + spec 0139 (spec 2 del 0115). `campaign`/`transactional` solo por Web Push, nunca Wallet; sin
suscripcion cierran `suppressed`/`no_channel` sin gastar presupuesto; `latest_message` solo del `reminder`;
`GET /api/public/consumer/notices` + `listConsumerNotices` para Actividad; migracion `0062` (GRANT SELECT de 6
columnas al rol del cliente). PASS del revisor; M1-M9 rojas (M9 la agrego el orquestador, `8297ae6`). **Push con
`--no-verify` AUTORIZADO por el owner** (2026-10-02, «Push con --no-verify»): el e2e no podia correr, puerto 3000
ocupado por el dev server de `central-hill`; `check-numbers` corrido a mano, ok.

**La 0062 esta en PROD** (owner, 2026-10-02; verificada por SQL). **Pendiente:** `test:e2e` sin correr en este
arbol (correrlo cuando el 3000 este libre). **GPT tiene que conectar Actividad** a `listConsumerNotices` (contrato en la
spec 0139 §3; avisar al owner). Siguiente spec: **3 del ADR 0115 (limites centralizados)**. Pendientes de antes: los de
la 0138 (`audience-preview`, `rewards/results`, `balance-push`), `AGENT-WORKFLOW.md`/agentes con bitacora a
`TASKS.md`, `.prettierignore` con `docs/`, #68.

## ⇥ ESTADO HISTORICO (2026-10-03) — 0138 IMPLEMENTADA Y EN `main` (`aefc21c`, push `07c7a37`). SIGUIENTE: SPEC 2 DEL ADR 0115

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. `motor` = `origin/main` en `07c7a37` (mas este commit de
estado). Arbol limpio.

**Hecho:** spec 0138 (solo Bienvenida y Venta cruzada; compositor, valle, reactivacion, saldo y paso 4 apagados
desde `packages/domain/src/server/marketing/enabled-campaigns.ts`). Codigo `aefc21c` + `f693e08` (revierte
`next-env.d.ts`). PASS del revisor independiente (5 mutaciones rojas, reescrituras y salteados revisados). Neon
completo con el arbol de la spec: 2891 passed / 248 skipped / 0 failed en ~5 min (antes ~10). `pre-push` del push:
`verify: ok` (Neon relacionado; e2e salteado, sin UI). **La #67 queda resuelta** (el paso 4 no corre); falta
cerrarla en `PARQUEADO.md`. `ci-integration`: borrados los 99 turnos historicos y los 3 residuos de billing (OK
del owner).

**Siguiente:** cerrar #67 en PARQUEADO; spec 2 del ADR 0115 (canales: campañas y mostrador por PWA o solo en la app,
recordatorio por Wallet con respaldo PWA). Pendientes de la 0138 (sin riesgo hoy): `audience-preview` abierto,
`rewards/results` sin medir, condicion `||` de `balance-push`. Avisado al owner: vitest vuelca la cadena de conexion
de `ci-integration` en errores (redactada en el scratchpad; queda en transcripciones de agentes en `~/.claude/`).

**Medido en la corrida Neon completa (2026-10-02 22:00 UTC, ~10 min):** 6 failed / 3119 passed — `marketing-valley`
(timeout, #67), **3 NUEVOS en `marketing-refresh`** (`expected [] to have a length of 1`, causa sin medir) y 2
intermitentes de `catalog-import`. No dejo turnos vivos nuevos (total sigue 99).

**Pendientes chicos:** `docs/AGENT-WORKFLOW.md` y `.claude/agents/*` aun mandan la bitacora a `docs/TASKS.md`;
`.prettierignore` excluye `docs/`; #68; borrar el worktree `motor` cuando el owner lo pida.

## ⇥ ESTADO HISTORICO (2026-10-02, noche) — PLAN 2 IMPLEMENTADO (ADR 0114 / spec 0135); SPEC 0112 DE LA OFERTA CRUZADA → 0136

**0135** (`099b409`): `docs/TRABAJO-EN-PARALELO.md`, `AGENTS.md` (GPT), `.githooks/pre-push` (check-numbers + `pnpm
verify`, modo solo-docs) **instalado** (`core.hooksPath=.githooks`, comun a los dos arboles), estado por agente
(`docs/estado/`). Verificado por el orquestador: el hook **bloquea** un push a main con una spec duplicada (exit 1,
nombra el numero) y `check-numbers` da exit 0 en el repo. **`ef05b1a`**: la spec 0112 de la oferta cruzada y su
contrato se renumeraron a **0136** (0112 queda para la PWA de GPT); lista de excepciones de `check-numbers` vacia.
**El push de estos commits va con `--no-verify` AUTORIZADO por el owner** (2026-10-02, «opcion 1»): `package.json`
dispara Neon completo y en local fallan `marketing-valley` (#67, timeout 180 s; en GitHub pasa) y un intermitente de
`catalog-import-guard` (en solitario verde). Fast gates + e2e 106/106 verdes. **Al pushear:** `pnpm ci:status`.
Pendiente: mensaje del owner a GPT (leer `AGENTS.md`); `docs/AGENT-WORKFLOW.md` y los agentes aun mandan la bitacora a
`TASKS.md`; prettier ignora `docs/` (el modo solo-docs no revisa nada); **#67 bloquea localmente todo push con Neon
completo** → prioridad.

## ⇥ ESTADO HISTORICO (2026-10-02, noche) — `pnpm verify` EN MAIN (ADR 0113 / spec 0133)

**Desde ahora el gate es `pnpm verify`** (gates segun lo que cambio) y cada sesion empieza con `pnpm ci:status`.
Medido por el orquestador: `pnpm verify --files apps/merchant/src/server/marketing/template-store.ts` = **2 min 20 s**
(Neon selectivo 11 suites en 92 s) contra ~20 min de Neon completo. Las 4 suites Neon que tenian roja la CI de `main`
(#69) se arreglaron en la spec **0134** (`623eb4d`, solo tests; 21/21 re-corridas). **Verificado: `pnpm ci:status` → CI de
`main` VERDE en `46eb63d`** (run 37039670082, Neon completo + e2e incluidos). #67 y #68 siguen anotados en PARQUEADO. Pendiente
del handoff: `docs/AGENT-WORKFLOW.md` y skills que todavia citen «los 6 gates». **Siguiente con el owner: Plan 2.**

## ⇥ ESTADO (2026-10-02, noche) — PLAN 1 CERRADO: `main` ALINEADO, TAG `baseline-2026-10-02` (= `49c7c9e`)

Unica rama remota: `main`. 0131 (Claude, tests de servidor) y 0132 (GPT, e2e `437e7a2`) en main. **Los 6 gates verdes
en `49c7c9e` con Node 24** (medido por Claude): typecheck, lint, test (2272), format:check, build, **test:e2e 106
passed / 0 failed / 5 skipped**. **NO corridas** las suites `.neon.integration` completas (~20 min; el owner decidio
no correrlas ahora): rojos conocidos ahi #67 (`marketing-valley`) y #68 (intermitente en `push-enable`). El tag lo
declara en su mensaje. **Siguiente: Plan 2 (trabajo en paralelo Claude/GPT) con el owner.** Al cerrar esta sesion se
borra el worktree `motor` (identico a main).
