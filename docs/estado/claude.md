# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; el historico, en `../TASKS.md`.
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-02, cierre) — SIGUIENTE: PARQUEADO #67 (EL TICK DE MARKETING SIN ALCANCE). HANDOFF + `/clear`

**Al retomar:** `git pull --ff-only` + `pnpm ci:status`. El ultimo push (`2d8f4cb`, Plan 2 + renumerado 0112→0136) fue
con `--no-verify` AUTORIZADO por el owner; su CI quedo CORRIENDO al cerrar (no se espero): mirarla primero. Arbol
limpio, `motor` = `origin/main`. Los gates de `ef05b1a` (ultimo commit con codigo) dieron typecheck/lint/format/test verdes.

**La tarea: corregir la #67 por su CAUSA DE FONDO, y recien despues el test** (decision del owner, PARQUEADO #67:
«no tiene sentido arreglar el test»). Lo medido el 2026-10-02 (no re-medido desde entonces):
- `apps/merchant/src/server/marketing/tick.ts:248-255`: despues del trabajo por campaña (que SI respeta
  `businessIds`), `loadBusinessTurnStats(db)` y `placeConsumers(db, …)` corren SIN alcance de negocio.
- `placeConsumers` (`marketing/placement.ts:175`) recorre cada consumidor de `loadPlacementConsumerIds`
  (`placement-store.ts:40`: los con turno `queued|active` ∪ los con fila en `consumer.pass_placement`) y por cada uno
  hace varias consultas (`lockConsumer`, `loadActiveTurns`, `loadQueuedTurns`, …) dentro de UNA transaccion.
- En `ci-integration`: 79 consumidores en ese conjunto (consulta 374 ms); un tick ~80 s; `marketing-valley` V4 hace 3
  ticks y corta a 180 s **en local** (en GitHub pasa: la latencia desde el owner pesa). El test no pasa `consumerIds`.
- Otras suites dejan filas de `pass_placement` sin limpiar (por eso crece el conjunto).
- **No medido:** el reparto del tiempo entre fases del tick. Es lo PRIMERO a medir (instrumentar o cronometrar cada
  fase contra `ci-integration`) antes de escribir la spec.
- Por que importa ya: con el hook `pre-push` (ADR 0114), todo push que dispare Neon completo (esquema, migraciones,
  `package.json`) queda BLOQUEADO en local por esta suite. Y en PROD el costo crece lineal con los clientes reales.

**Pendientes chicos (no bloquean):** `docs/AGENT-WORKFLOW.md` y `.claude/agents/*` aun mandan la bitacora a
`docs/TASKS.md`; `.prettierignore` excluye `docs/`, asi que el modo solo-docs de `pnpm verify` no revisa nada;
#68 (intermitente `push-enable`) y un intermitente de `catalog-import-guard` en corrida completa; borrar el worktree
`motor` cuando el owner lo pida (esta sesion vive ahi).

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
