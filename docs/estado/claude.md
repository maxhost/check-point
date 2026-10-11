# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-10) — 0189 EN `dev`; 0190 (PANEL) Y 0195 (VENCIMIENTO) EN RAMAS; PROD sin cambios

**En PROD:** sin cambios, `main` = `origin/main` = `9405c93`. **Migraciones 0069, 0070 y 0071 NO aplicadas en PROD.**

**En `dev` (sin pushear):** spec 0189 (planes pagos, prueba 90 dias; merge `327016f`), ADR 0135 + spec 0190 (docs
`77514b7`), tunel `dev-admin.checkpass.club` (`280e6c5`). Stripe test: los 4 precios verificados contra la API
(20/200 Conecta, 49/490 Impulso, USD, sin prueba propia) y `STRIPE_ENVIRONMENT`/clave/webhook presentes en el
`.env.local` del merchant (owner 2026-10-10).

**Ramas sin mergear (worktrees en `check-point-wt/`):**
- `spec-0190` (`cdb3ec9`): panel de plataforma `apps/platform`, migracion 0070. Implementada y verificada; login por el
  tunel probado por el owner («ok, funciona»). Bloqueo del merge a `dev`: GPT tiene `pnpm-lock.yaml` sin commitear en
  el arbol principal y esta rama tambien lo cambia.
- `spec-0195` (`e33a3cf`, sobre `spec-0190` por la 0070): ADR 0136 + vencimiento del saldo, migracion 0071. Unit 23/23,
  Neon 5/5, M1–M3 ROJAS por la propiedad y revertidas; `pnpm verify` verde salvo `format:check` (7 archivos propios,
  formateados y re-chequeados despues). Mergear DESPUES de `spec-0190`.
- `spec-0189`: ya mergeada; worktree a borrar.

**UI pendiente para GPT:** `docs/PARQUEADO.md` §«UI pendiente para GPT» (U1–U3 cobro de la 0189, U4–U6 vencimiento de
la 0195), pedido del owner: se encarga cuando GPT termine lo suyo.

**QUE SIGUE:**
1. Cuando GPT commitee `pnpm-lock.yaml`: merge `spec-0190` y despues `spec-0195` a `dev`; sumar platform a
   `tools/dev-local/up.sh`; noindex del panel (spec 0194 de GPT lo pide).
2. Salir a live (todo con OK del owner): precios live + `STRIPE_PRICE_*_LIVE` en Vercel (owner), proyecto Vercel
   `admin.checkpass.club`, snapshot + migraciones 0069/0070/0071, `merge --ff-only dev` a `main`, probar local, push.
3. Siguiente funcionalidad elegida por el owner: el **reporte de retorno / analitica** (valor percibido).

**Hallazgo a decidir (owner):** la landing de GPT (`closing-sections.tsx`) muestra Impulso a $45 y «local adicional
$12»; Stripe y el ADR 0134 dicen $49 y sin local adicional.

**Decisiones del owner, no volver a preguntar:** ADR 0134, 0135 y 0136 (2026-10-10).

