# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-04, tarde) — 0151 (ARNES) COMMITEADA (`f4c2919`). EN PROD: 0148/0149/0150 (`24ce0df`)

**Al retomar:** `motor` = `origin/main` (`24ce0df`) + commits locales SIN PUSHEAR: skill `delete-user`, investigacion
«Flujo agil con Claude Code» (`reports/`), spec 0151 y su implementacion `f4c2919`, este estado. Push = el owner (el
clasificador de auto mode bloquea `git push` a `main`).

**0151 (arnes proporcional al riesgo):** `CLAUDE.md` 199 → 77 lineas; niveles N0/N1/N2; `verify.sh` con huella
(reproducido por el orquestador: 46 s → 0 s sin cambios); `tasks-fresh` solo avisa; estado historico aparte. Sin revisor
todavia. Hallazgos a decidir (owner): bajar `claude-md-size.sh` a 100 lineas/6 KB; la huella no incluye HEAD (un pull no
re-corre gates); la skill `handoff` desactualizada (`npm`, no mueve el bloque viejo al historico).

**QA en PROD con datos de prueba (owner):** botones de login de QA (0150, falta `QA_LOGIN_ENABLED=true` en Vercel
merchant); skills temporales `qa-cupones-prueba`, `qa-cupon-valido`, `delete-user`; productos «Prueba» en Panaderia,
Barberia, Gym. Todo se borra al cerrar las pruebas.

**Pendientes de antes:** QA de 0143/0146/0147/0148; lote `pass_refresh` (0146); PARQUEADO #69; Postgres local para tests
(medir antes/despues); revisor de la 0149 (UI de GPT).
