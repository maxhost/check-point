# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-10) — SPEC 0189 (PLANES PAGOS, PRUEBA 90 DIAS) IMPLEMENTADA EN `dev` (`327016f`); PROD sin cambios

**En PROD:** sin cambios, `main` = `origin/main` = `9405c93`. **La migracion 0069 NO esta aplicada en PROD.**

**En `dev` (sin pushear):**
- `327016f` merge de la rama `spec-0189` (ADR 0134, spec 0189 `implementada`, `7b6e91d`). Muere `free`; alta en
  `trial` con `trial_ends_at` +90 d; planes `base` ($20/$200) y `plus` ($49/$490); eje de acceso que bloquea con
  402 panel, mostrador, POS, login del personal, inscripcion, Bienvenida y Venta cruzada; barrido diario
  `/api/internal/billing-sweep`; skill `/extender-prueba`.
- Verificacion: implementador `pnpm verify` ok (Neon 409 archivos); revisor FAIL ronda 1 (H1 bucle del layout de
  `/backoffice` para el owner bloqueado; H2 campañas en `plan_downgraded` tras un evento `incomplete`), corregidos;
  PASS ronda 2 con `pnpm verify` ok sobre `1ba7ef7`. Reproducido por mi: unit acceso/catalogo/plan-change 31/31,
  M1 y MH1 rojas, `billing-incomplete.neon` 1/1, `layout-guard` 5/5. N1 del revisor (hueco de cobertura) cerrado
  por mi en `f5daf5e`: `billing-sweep.neon` 3/3 limpio y rojo bajo R4 («expected {paused:0,resumed:0} to deeply
  equal {paused:0,resumed:1}»). `pnpm verify` NO se corrio sobre el merge con `dev` (sin solapamiento de archivos
  con la landing de GPT, `merge-tree` sin conflictos): lo corre el pre-push.
- GPT: landing 0188 en `dev` (`84df923`, `b34e6bd`) y cambios suyos sin commitear en `apps/public`.
- Worktree `check-point-wt/spec-0189` todavia existe (borrar cuando no haga falta).

**QUE SIGUE (para salir a live, todo con OK del owner):**
1. Owner: 4 precios de Stripe (test y live) y las 8 env `STRIPE_PRICE_{BASE,PLUS}_{MONTHLY,YEARLY}_{TEST,LIVE}`.
2. GPT: UI de cobro con el contrato §D10 (la consola actual llama a checkout sin `plan` → 400) y textos «Free».
3. Snapshot + migracion 0069 a PROD justo antes del push; `merge --ff-only dev` a `main`, probar local, push.

**Hallazgos a decidir (owner):** regla de `/extender-prueba +N` (hoy: desde el fin actual o desde hoy si vencio,
la puso el implementador); #3 transitorio (pago `incomplete` → 1 local sin campañas hasta el `active`). Resto de
hallazgos menores en `docs/handoff-0189-implementacion.md` y `docs/revision-0189.md`.

**Decisiones del owner, no volver a preguntar:** las del ADR 0134 (2026-10-10).
