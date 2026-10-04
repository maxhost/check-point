# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-04, tarde) — 0153 (EL SISTEMA VALIDA EL CUPON) IMPLEMENTADA EN `motor`, PASS. ESPERA LA UI DE GPT

**Que paso:** QA del owner sobre la 0148/0149: «el merchant no tiene que validar el cupon manualmente lo tiene que hacer
el sistema». Decision en el ADR 0120 (sin «Validar»; veredicto verde/rojo al escanear; la venta consume; «Quitar»
siempre; extras con la venta; producto gratis/2x1 se agrega solo al carrito). Servidor: spec 0153 (renumerada: el 0152
es de GPT en `origin/main`), contrato `docs/specs/0153-contratos-de-api.md`.

**Donde esta:** rama `motor` rebasada sobre `origin/main` (`1ea1e5e`): `526db75` ADR+spec, `432f680` renumeracion,
`2adc79b` codigo (PASS del revisor; `pnpm verify` verde; R3 sin oraculo de carrera, en `TASKS.md`), `40291da` y
`f834ac1` docs, `d9f6a88` limpieza pedida por el owner (`buildCouponBody` y la visita redundante del canje; `pnpm
verify` verde). **Sin push, a proposito:** sin la UI de GPT un cupon no-descuento elegido bloquea la venta.

**Siguiente:** el owner le pasa a GPT el sha de `motor` (el ultimo commit de este estado); GPT escribe su spec 0154,
hace `git rebase motor` en su `main`, implementa la UI y hace UN push con todo. Despues: deploy READY en Vercel y QA
del owner (Panaderia, «Cafe americano gratis»: verde sin validar → salir sin consumir → venta con el cafe agregado solo;
vencido → rojo → «Quitar»). Si `motor` cambia antes, GPT tiene que re-rebasear.

**Hallazgos a decidir (owner), de la 0153:** un cupon en rojo no se aplica y la venta sale sin el (consecuencia de
diseño, no la dijo el owner);
el push de la orden no menciona las unidades extra del cupon.

**En PROD (`24ce0df`):** 0148 + 0149 + 0150 (falta `QA_LOGIN_ENABLED=true` en Vercel merchant). Skills temporales de
QA: `qa-cupones-prueba`, `qa-cupon-valido`, `delete-user`.

**Pendientes:** los de la 0151 (en `claude-historico.md`); QA del owner (0143/0146/0147/0148/0149); lote
`pass_refresh` (0146); PARQUEADO #69; Postgres local para tests; test de carrera del limite diario (R3, `TASKS.md`).

**Prompt para retomar:** «Lee docs/estado/claude.md: la 0153 espera la UI de GPT».
