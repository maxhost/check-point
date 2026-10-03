# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; el historico, en `../TASKS.md`.
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-02, noche) — 0138 EN IMPLEMENTACION (implementador vivo en este arbol, segunda vuelta)

**Al retomar:** `ListAgents` PRIMERO — si el implementador de la 0138 sigue vivo, no tocar el arbol. `motor` en
`7e99d5f` + trabajo SIN COMMITEAR del implementador (`enabled-campaigns.ts`, `template-list.ts`, los stores de
marketing, `tick.ts`, `cross-offers.ts`, `valley-offers.ts`, `marketing-disabled.neon…`) y la enmienda §6-bis de la
spec, tambien sin commitear.

**Hecho:** owner dio OK a implementar la 0138 + revisor, y a borrar los turnos de `ci-integration`: **borrados,
99 → 0** (28 negocios `int-*` via `dropCampaigns`+`dropBusiness`, 0 errores). Primera vuelta del implementador:
paro por §6 — con el codigo cambiado, Neon completo = 90 failed / 3039 passed en 29 archivos, 367,86 s (verificado
sobre su log `scratchpad/neon-pre.clean.log`); 63 de tema apagado, 26 de mecanismo VIVO con fixture apagado.
Decision del orquestador (§6-bis de la spec): los 26 se REESCRIBEN con fixtures `welcome`/`cross` conservando la
propiedad (salvo 5 cuyo mecanismo solo existe con turnos → se saltean); entran 3 huecos (409 antes de `readJson`,
`claimCrossOffer` de valle → 404, API de ventanas de valle → 404). Implementador reanudado con eso.

**Siguiente:** al volver el implementador, reproducir su evidencia (lista de salteados, 9 mutaciones, tabla de
`pnpm verify`, `grep '^marketing_tick ' LOG | grep -vc '"consumers":0,'` → 0); despachar UN `revisor` en contexto
fresco con presupuesto (9 mutaciones, plausibles) y corte; con PASS: commit de la enmienda + marcar `implementada` +
INDEX + push. Despues, specs 2–4 del ADR 0115.

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
