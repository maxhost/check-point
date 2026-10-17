# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-17) — SPEC 0237 DE ANALÍTICAS (AN) EN BORRADOR; ESPERA H1–H6 DEL OWNER

**Sesión de documentos, sin código de producto.** Commits en `dev` (sin push): `af9230d7`, `285823d5`.

**Hecho:** spec **0237** (`docs/specs/0237-analiticas-inbox-y-resumenes-diarios.md`, L3) con las decisiones del owner
del 2026-10-17 (plan, «AN — decisiones del owner para la spec»): una spec en 3 etapas (AN-1 resúmenes + inbox +
histórico + contexto externo, tarjetas 1, 2, 3, 4, 7, 13; AN-2 stock 5, 6, 8, 9; AN-3 10–12), inbox en el Dashboard e
histórico en ítem «Analíticas» con permiso `analytics`, ventas = solo POS, tarjeta 10 = tickets abiertos anulados.
Cruzada con la 0236 por `module_event`: el evento de gasto trae `expenseId` + `revision`; el chequeo de pendientes del
conteo de Stock (`stock/count.ts`) filtra `sale.closed` de cualquier suscriptor → la 0237 §2.4 lo limita a suscriptores
de stock.

**ADR 0153 aceptado** (owner): todo dato de Analíticas nace como evento en la tx de su origen; traductores puros;
Analíticas no lee tablas. La 0237 suma `sale.closed` v3, `sale.commission.frozen`, `recipes.consumption.applied`,
`recipes.product_cost.changed`, `visit.recorded`, `coupon.redeemed`.

**Siguiente:** el owner decide H1–H6 (al final de la spec); con eso la spec pasa a cerrada. AN-1 se implementa después
de G (0236) y N (0235) integradas.

**Pendiente del owner:** push del fix de CI (`origin/main` rojo; arreglo con QA PASS en `main` local); cuenta y clave de
Visual Crossing (H4).

**Gotchas:** F5 Futbol Evolution es del owner (prueba en PROD). No se puede anular una venta cobrada. Escribir en PROD
solo por la app, nunca por SQL. `MODULE_EVENTS_ENABLED` en PROD: verificar antes de AN-1.
