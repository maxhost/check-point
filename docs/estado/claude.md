# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-17) — ARCO AN COMPLETO EN PROD; QUEDA LO OPERATIVO

**Sesión de documentos y lectura PROD (solo SELECT por MCP), sin código.** Commit `221116ac` en `dev`: spec 0237
`implementada`, fila de INDEX y filas N/G/AN del plan al día.

**AN:** AN-1, AN-2 y AN-3 con QA PASS (`docs/factory/0237-an*-qa.md`), más ciclo del inbox, Gastos al guardar y
POS/costos L1 de GPT. Publicado por GPT: `origin/main` `90ebe18f` (push sin pre-push autorizado por el owner);
ledger PROD leído por Claude: 0096–0101 aplicadas. Deploy de Vercel no verificado por Claude.

**Pendiente:** jobs en cron-job.org (`/api/internal/analytics/evaluate` y `/context`); script de ciudades de locales
existentes; `VISUAL_CROSSING_API_KEY` en Vercel y quitar `MODULE_EVENTS_ENABLED`; QA manual del owner (POS/costos
L1); rendimiento FAIL 1.817 ms > 1 s; CI compartida con 0097 vieja; `huellas-prod.txt` sin publicar; borrar
`app/analytics.ts`. Después: Smart Menu, pieza 6. Uso PROD 17-oct: Plátano 4 ventas $38,45 antes del deploy (sin
Analíticas, esperado); TAJ sin uso.
