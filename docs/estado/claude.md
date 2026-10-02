# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; el historico, en `../TASKS.md`.
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-02, noche) — `pnpm verify` EN MAIN (ADR 0113 / spec 0133)

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
