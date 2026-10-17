# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-17, madrugada) — ADR 0152 (ANALÍTICAS) ACEPTADO; G LISTA PARA GPT; SIGUE SPEC DE AN

**Sesión de diseño con el owner, sin código de producto.** Commits en `dev` (sin push): `95967d1e`, `bc4fbbad`,
`3d7ff4e6`, `45a3f226`, `26bde4c1`.

**Hecho:** ADR **0152** aceptado (`docs/adr/0152-analiticas-inbox-accionable.md`): inbox de hasta 5 tarjetas (13 en la
v1) con peso = plata en juego × urgencia × novedad, histórico en números con filtro mes/3/6/9/12 y comparativa anual
construida; resúmenes diarios con vocabulario de métricas del core alimentados por `module_event`; contexto externo
por **ciudad** (`eventos_clima` pronóstico + observado con Visual Crossing gratis, `eventos_calendario` con alcance país/provincia/zona/ciudad y
tipo deportivo preparado), guardado sin acción; escala medida en Postgres local (no Neon). Decisiones y citas en
`docs/plan-margen-ganancia-2026-10-14.md` (secciones «AN — …»); investigación en
`docs/analisis-analiticas-mercado-2026-10-16.md`. Parqueado (proyecciones, cuadre de caja, dueño como fuente) en
`docs/PARQUEADO.md`.

**G:** prompt ajustado al ADR 0152 en el plan («Prompt — Gastos»): meses pasados NO congelados, «todo el negocio» sin
local (null también en `module_event`), `source_id` por edición. El owner lo lanza a GPT (spec 0236 + ADR 0151).

**Siguiente: spec de AN (L3), la escribe Claude** (owner: no se la dejamos a GPT), en sesión nueva. Leer el ADR 0152
entero y solo las secciones «AN — …» del plan. Al terminar, cruzarla con la spec 0236 de G por `module_event`.

**Pendiente del owner:** push del fix de CI (`origin/main` rojo en `5b834ca0`; arreglo con QA PASS en `main` local).

**Gotchas:** F5 Futbol Evolution es del owner (prueba en PROD). No se puede anular una venta cobrada. Escribir en PROD
solo por la app, nunca por SQL.

