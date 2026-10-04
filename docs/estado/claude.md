# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-04, cierre) — 0151 (ARNES NUEVO) COMMITEADA. PUSH PENDIENTE DEL OWNER

**Al retomar:** `git fetch && git merge --ff-only origin/main` (rama `motor`, sin upstream). Si `origin/main` no tiene
todavia `f4c2919`, el push no se hizo: lo corre el owner (`GH_TOKEN= git push origin HEAD:main` desde este worktree; el
clasificador de auto mode le bloquea el push a Claude). El `main` local de GPT se adelanto por fast-forward hasta el
commit de este estado: su proximo push tambien lo arrastra.

**Desde ahora rige el arnes de la 0151:** niveles N0/N1/N2 de `CLAUDE.md` (N0 directo, sin spec ni subagentes; subagentes
solo en N2), Stop hook con huella (46 s → 0 s sin cambios, reproducido), `tasks-fresh` solo avisa, un solo bloque de
estado (el viejo va a `claude-historico.md`; la skill `handoff` ya lo dice).

**En PROD (`24ce0df`):** 0148 (cupon elegido, Claude) + 0149 (UI, GPT) + 0150 (login de QA: API + botones, decision del
owner; falta `QA_LOGIN_ENABLED=true` en Vercel merchant). Skills temporales de QA: `qa-cupones-prueba`,
`qa-cupon-valido`, `delete-user`; productos «Prueba» en Panaderia/Barberia/Gym. Se borran al cerrar las pruebas.

**Hallazgos a decidir (owner), de la 0151:** revisor independiente (no corrido); bajar `claude-md-size.sh` a 100
lineas/6 KB; la huella no incluye HEAD (un pull no re-corre gates; lo cubren pre-push y CI).

**Pendientes:** QA del owner (0143/0146/0147/0148/0149); lote `pass_refresh` (0146); PARQUEADO #69 (Vercel Hobby);
Postgres local para tests (medir antes/despues, informe «Flujo agil con Claude Code»); revisor de la 0149.

**Prompt para retomar:** «Lee docs/estado/claude.md y seguimos con el QA».
