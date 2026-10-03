# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; el historico, en `../TASKS.md`.
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-02) — SPEC 0139 (spec 2 del ADR 0115) A MEDIAS: §1-§2 COMMITEADOS, §3-§4 EN CURSO POR EL IMPLEMENTADOR

**Al retomar:** `git status` en `motor` + `ListAgents` (puede haber un implementador vivo: no tocar sus archivos ni
revertir nada sin medir). `origin/main` = `4bd4b58` (ADR 0116 + spec 0139 reservados). Local sin push: `70539b2`
(codigo §1-§2) y `891213f` (spec: suma migracion 0062, M3 con `sent_at`, M8).

**Hecho y verificado:** ADR 0116 (owner: avisos de mostrador en Actividad). Spec 0139 `cerrada`. `70539b2`:
`campaign`/`transactional` solo por Web Push, cierre `suppressed`/`no_channel` sin presupuesto, `latest_message` solo
`reminder`; `pnpm verify: ok`; M1b, M2, M3b, M4, M5 rojas (bitacora en el scratchpad de la sesion, `0139-bitacora.md`).

**A medias (sin commitear en el arbol, del implementador):** §3 `listConsumerNotices` + `GET
/api/public/consumer/notices` + test con `roleSuite`, y §4 migracion `0062_avisos_del_cliente.sql` (GRANT SELECT de 6
columnas al rol del cliente; owner OK para la spec, **NO aplicada a PROD**: necesita OK aparte). M6-M8 sin reporte.

**Siguiente:** recibir el reporte, reproducir evidencia, revisor independiente (8 mutaciones), push, `INDEX` →
implementada, contrato a GPT (Actividad). Hallazgo informado: el aviso de vencimiento de la Bienvenida es `campaign` y
sin suscripcion cierra `no_channel`. Pendientes de antes: los de la 0138 (`audience-preview`, `rewards/results`,
`balance-push`), `AGENT-WORKFLOW.md`/agentes con bitacora a `TASKS.md`, `.prettierignore` con `docs/`, #68.

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
