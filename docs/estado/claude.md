# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-04) — 0148 + 0149 (UI de GPT) EN PROD (`3006a2f`). TOCA QA DEL OWNER

**Al retomar:** `git fetch` + `git merge --ff-only origin/main` (rama `motor` sin upstream). `origin/main` = `3006a2f`:
el push unico de GPT con la 0148 (Claude) y la 0149 (UI de GPT). **Deploy verificado** (status del commit por la API de
GitHub, 2026-10-04 14:43 UTC): merchant, customer y public `success` en `3006a2f`. 0064 en PROD desde el 2026-10-03.

**0150 commiteada (`b83134e`), SIN PUSHEAR:** API `qa-login` (implementador, cortado por Claude con la API completa;
unidad 27/27, typecheck/lint/prettier ok; sin revisor por decision del owner) + botones en el login (Claude, zona GPT por
decision del owner → avisar a GPT). El push lo bloqueo el clasificador de auto mode: lo corre el owner. Despues: deploy
`READY` y `QA_LOGIN_ENABLED=true` en el proyecto merchant de Vercel (owner).

**Pendiente:**
- **QA del owner de 0148/0149** (pasos en la spec 0148 §«QA del owner») y los de antes: 0143, 0146, 0147.
- **La 0149 no tiene revisor independiente** (su spec lo deja «posterior»; presupuesto de mutaciones 0). Ofrecido al owner.
- `docs/estado/gpt.md` en `3006a2f` todavia dice «No se ha pusheado» (zona de GPT: avisar).
- Lote `pass_refresh` de la 0146 (OK del owner); PARQUEADO #69 (Vercel Hobby); build Turbopack rojo en el entorno de GPT.
- **QA con datos de prueba en PROD** (pedido del owner, 2026-10-04): 17 productos en la categoria «Prueba» de Panaderia,
  Barberia y Gym, y la skill TEMPORAL `.claude/skills/qa-cupones-prueba/` (habilitar hoy / resetear canjes por MCP).
  Las dos cosas se borran cuando el owner cierre las pruebas.
