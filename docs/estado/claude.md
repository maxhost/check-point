# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-11) — CERRADO POR EL OWNER, EN PROD: 0189 + 0190 + 0195 + 0196 + landing/SEO (`main` = `origin/main` = `4c40a6a`)

**En PROD:** `4c40a6a`, deploy de merchant/customer/public `success` (status de GitHub del commit), `/api/health` 200 en
`business.` y `my.`, `/programa-de-fidelizacion` 200. **Migraciones 0069/0070/0071 aplicadas** (2026-10-11, snapshot
previo `snap-noisy-shadow-axj3i7b3`): 72 en `drizzle.__drizzle_migrations`, los 3 comercios en `trial` hasta 2027-01-09,
`platform_auth` con 5 tablas, `tools/local-db/compare.sh` = «local == PROD» (huellas commiteadas en `4c40a6a`).
Push hecho desde un worktree limpio en `4c40a6a` (verify completo verde con Neon); worktree borrado.

**En `dev`:** GPT siguio despues de `4c40a6a` (0198/0199 landing, `890a37e`) con archivos `.impeccable/` sin commitear.

**Panel `admin.checkpass.club` en PROD** (proyecto Vercel creado por el owner): `/api/health` ok, `/` → `/login`,
noindex. **Owner 2026-10-11: «todo funcionando, damos esto por cerrado e implementado»** (0189, 0190, 0195, 0196).

**QUE SIGUE:**
1. Tooling hecho (`5d5bb03`): el panel en `pnpm dev:local` (:3002, opcional) y `huellas.sql` con `platform_auth`
   (local == PROD, 19 categorias; roles del cliente sin acceso a `platform_auth` en PROD). Ramas/worktrees de Claude
   mergeados borrados (spec-0189, spec-0195, fix-notices-mock, ui-sistema, onboarding-google). **Quedan:** `spec-0190`
   (su worktree tiene el UNICO `apps/platform/.env.local`: el owner lo mueve al repo, despues se borra), y `motor`
   (spec 0163 «guardia de UI», version vieja de `tools/ui-guard.ts`; el numero 0163 en `main` es otra spec) y
   `sin-gate-email` (fix 0155 H4: clave de Google rechazada → 503; NO esta en `main`): sin mergear, decide el owner.
2. GPT: U4–U6 (vencimiento, 0195 §D6). Skill `impeccable` instalada sin commitear (lint/formato ya la ignoran, `6b10697`):
   pregunta abierta al owner de quien la commitea.
3. Siguiente funcionalidad: reporte de retorno. Inventario en `docs/analisis-producto-2026-10-10.md` §Inventario.
   Pregunta abierta al owner: registrar cada escaneo como evento.

**Decisiones del owner, no volver a preguntar:** ADR 0134, 0135, 0136 (2026-10-10). Precio de la landing (Impulso
$45 y «local adicional $12», distinto de Stripe $49): «dejalo asi» (2026-10-10).
