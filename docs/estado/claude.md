# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-16, noche) — G CERRADA; SIGUE DISEÑAR ANALÍTICAS (AN) CON EL OWNER

**Sesión de diseño, sin código de producto de Claude.** Fuente de verdad: **`docs/plan-margen-ganancia-2026-10-14.md`**
→ tabla de etapas (al día), «Preguntas de G — respuestas del owner», «AN — visión del owner», «Prompt — Gastos».

**Próxima sesión: diseñar AN juntos con el owner** (él lo pidió; «no será tan simple como crees»). Analíticas como
base expansible por rubro (odontólogo, cafetería, barbero, taller…): lo que el dueño abre cada mañana — «hoy espero
que suceda esto, necesito preparar esto, tengo que lograr esto antes de esto». Antecedente: ADR 0021. Leer la sección
«AN — visión del owner» del plan antes de proponer nada; las 3 preguntas abiertas están ahí.

**Hecho y verificado (git, 2026-10-16):** 0, 1.1, 1.2, 2, R1, 1.3, P1, EV en PROD (`origin/main` `5b834ca0`). **N**
(spec 0235) implementada local por GPT, QA PASS, en `main` local `e2cd4544`, sin push ni migración PROD; GPT arregla
el CI rojo de `origin/main` y prepara el retiro de compatibilidad (`docs/estado/gpt.md`). S1/S2 fuera de la tabla.

**Orden:** N → ADR de AN (con el owner) → G (prompt escrito; revisarlo contra el ADR de AN: decisión 13 y
`module_event`) → AN → Smart Menu → 6. Commits de esta sesión: `1c0081fb`, `1c49279a`, `b68168a4`, `1300a07b`,
`61140bc7`.

**Gotchas:** F5 Futbol Evolution es del owner (prueba en PROD). No se puede anular una venta cobrada. Escribir en PROD
solo por la app, nunca por SQL.
