# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-17) — AN-1 EN MAIN LOCAL (REVISADA); AN-2 CORRIENDO EN GPT; PROMPT AN-3 LISTO

**Sesión de documentos y revisión, sin código de producto.** Commit `e4ba665c` en `dev` (sin push): «Prompt — AN-3»
en `docs/plan-margen-ganancia-2026-10-14.md`.

**AN-1:** GPT la integró en `dev` y `main` local (`0f543dd8`); `origin/main` sigue en `db3175d2`. Revisada: QA
independiente PASS funcional (`docs/factory/0237-an1-qa.md`); re-medido por Claude: 32/32 unit de analytics
(Node 24), `MODULE_EVENTS_ENABLED` sin usos en código, core sin imports de módulos, una migración 0097.
Pendientes: rendimiento 2.082 ms frío contra ≤1 s (parqueado por el owner); CI compartida con el hash viejo de
0097 (el fixture fallará: antes del push hay que elegir DB de replay o reconciliar CI); ciudades existentes y cron
cron-job.org sin ejecutar; prueba real de clima diferida a AN-3; `app/analytics.ts` (demo ADR 0020) quedó sin uso.

**AN-2:** GPT corriendo en `/private/tmp/checkpass-an2/` (contrato `bc632860`); preguntó al owner por el umbral de
3 USD de la tarjeta 9 sin conversión.

**Siguiente:** lanzar AN-3 cuando AN-2 tenga QA PASS e integrada en dev.
