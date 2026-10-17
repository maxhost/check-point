# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-17) — SPEC 0237 (AN) CERRADA; PROMPT DE AN-1 LISTO PARA GPT

**Sesión de documentos, sin código de producto.** Commits en `dev` (sin push): `af9230d7`, `285823d5`, `b0afe557`.

**Hecho:** spec **0237** cerrada (`docs/specs/0237-analiticas-inbox-y-resumenes-diarios.md`, L3) y ADR **0153**
(todo dato de Analíticas nace como evento en la tx de su origen; traductores puros). Owner 2026-10-17: Analíticas es
**core, sin switch ni variable** → se retira `MODULE_EVENTS_ENABLED` (§2.5); AN-1 = tarjetas 1, 2, 3, 4, 6, 7, 13;
empieza limpio en su deploy; local sin ciudad sin contexto; «cuánto ahorraste» a PARQUEADO. G y N ya están en `dev`
(verificado: append genérico, `GenericEventSubscription`, local nullable).

**Siguiente:** el owner lanza a GPT el «Prompt — AN-1» de `docs/plan-margen-ganancia-2026-10-14.md`.

**Pendiente del owner:** push del fix de CI (`origin/main` rojo); cuenta y clave de Visual Crossing
(`VISUAL_CROSSING_API_KEY` en Vercel; no bloquea AN-1).

**Gotchas:** F5 Futbol Evolution es del owner (prueba en PROD). No se puede anular una venta cobrada. Escribir en PROD
solo por la app, nunca por SQL. Quitar `MODULE_EVENTS_ENABLED` de Vercel solo después del deploy de AN-1, con OK.
