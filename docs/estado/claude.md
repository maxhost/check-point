# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-16) — GASTOS/NEGOCIO/ANALÍTICAS REDISEÑADOS CON EL OWNER; EVENTOS ENCENDIDOS EN PROD

**Sesión de diseño, sin código de producto de Claude.** Fuente de verdad: **`docs/plan-margen-ganancia-2026-10-14.md`**
→ tabla de etapas (filas EV, N, G, AN nuevas) y secciones «F rediseñada — Gastos, Medios y Analíticas», «Revisión de la
0231», «Decisiones del owner sobre la revisión», prompts de encendido y de Negocio (0235/0150).

**Hecho y verificado:**
- **EV:** `MODULE_EVENTS_ENABLED` encendido en PROD (GPT + owner). `origin/main` = `5b834ca0` (incluye fix retry Stock
  `036615c0`). SQL de solo lectura en PROD (autorizado por el owner): 1 `sale.closed` v2, 2 entregas, venta de prueba
  en F5 (comercio de prueba del owner). Cron de reintentos cada 1 h.
- **N:** GPT escribió spec 0235 + ADR 0150 (`209f5937`). Claude NO los revisó todavía.

**Decisiones del owner (2026-10-15/16, en el plan):** módulo «Rentabilidad» → **Gastos** (`expenses`), solo gastos,
criterio de caja, sueldos como nombre libre, tablas nuevas (se borra la 0231). Medios de pago → **core**, espacio
**«Negocio»** (con Regional y Fiscal, mudados de Marca; permiso `business`). Toda la info → **Analíticas core** (opción
C: resúmenes por día). Menú sin agrupar hasta tener 2–3 rubros. Orden: N → G → AN, en serie.

**Qué sigue:** revisar 0235/0150 contra las respuestas del owner; implementación de N (GPT); prompt de G; ADR de AN.
Abiertos: 1.3-B (costo en ficha de Catálogo), 6 (merma), estimar recurrentes en Gastos (sugerencia de Claude sin
confirmar). Spec 0231 sigue con `estado: cerrada`.

**Gotchas:** F5 Futbol Evolution es del owner (prueba en PROD). Maduro de F5 sin costo (Bolón con Seco sale
«incompleto»). No se puede anular una venta cobrada. Escribir en PROD solo por la app, nunca por SQL.
