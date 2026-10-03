# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; el historico, en `../TASKS.md`.
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-02, noche) — SPEC 0141 (spec 3 del ADR 0115, LIMITES) CERRADA; IMPLEMENTADOR EN CURSO

**Al retomar:** `ListAgents` (puede haber un implementador vivo en `motor`: no tocar sus archivos) + `git status`.
`origin/main` = `001b6f0` (spec 0141 reservada). La spec 3 quedo **0141** porque GPT reservo la **0140** («avisos de
mostrador en Actividad», `daf9bac`) en paralelo.

**En curso:** spec 0141: limites de notificaciones a `packages/domain/src/server/notifications/limits.ts` sin cambiar
valores, re-exportados desde los archivos de hoy, + `docs/notificaciones/README.md` (pedido del owner). 6 mutaciones.
**Arbol sin commitear, del implementador (no tocar):** `push-budget.ts`, `push.ts`, `cross-rules.ts`,
`placement-plan.ts`, `templates.ts`, `valley-rules.ts`, `reminder.ts` modificados; nuevos
`packages/domain/src/server/notifications/`, `apps/merchant/src/server/notifications/`, `docs/notificaciones/`.
Puede haber una mutacion puesta: medirla antes de revertir (skill `protocolo-de-verificacion`).

**Siguiente:** reporte del implementador → reproducir evidencia → revisor independiente → push → INDEX implementada.
Despues: spec 4 del ADR 0115 (aviso de la Venta cruzada; el como lo cierra el owner antes de escribirla).

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
