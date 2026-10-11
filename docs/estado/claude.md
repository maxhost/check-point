# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-11) — EN PROD: 0189 + 0190 + 0195 + 0196 + landing/SEO (`main` = `origin/main` = `4c40a6a`)

**En PROD:** `4c40a6a`, deploy de merchant/customer/public `success` (status de GitHub del commit), `/api/health` 200 en
`business.` y `my.`, `/programa-de-fidelizacion` 200. **Migraciones 0069/0070/0071 aplicadas** (2026-10-11, snapshot
previo `snap-noisy-shadow-axj3i7b3`): 72 en `drizzle.__drizzle_migrations`, los 3 comercios en `trial` hasta 2027-01-09,
`platform_auth` con 5 tablas, `tools/local-db/compare.sh` = «local == PROD» (huellas commiteadas en `4c40a6a`).
Push hecho desde un worktree limpio en `4c40a6a` (verify completo verde con Neon); worktree borrado.

**En `dev`:** GPT siguio despues de `4c40a6a` (0198/0199 landing, `890a37e`) con archivos `.impeccable/` sin commitear.

**QUE SIGUE:**
1. Owner: crear el proyecto Vercel del panel desde GitHub (raiz `apps/platform`, dominio `admin.checkpass.club`).
   Variables que lee: `DATABASE_URL`, `PLATFORM_AUTH_SECRET`, `PLATFORM_AUTH_URL`, `PLATFORM_ADMIN_EMAILS`,
   `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`.
2. Owner: QA en PROD (cobro Conecta/Impulso, dias de prueba, cancelar/reanudar, vencimiento).
3. Pendientes chicos de Claude: sumar platform a `tools/dev-local/up.sh`; `tools/local-db/huellas.sql` no mira el
   esquema `platform_auth`; borrar worktrees mergeados `spec-0189/0190/0195`.
4. GPT: U4–U6 (vencimiento, 0195 §D6). Skill `impeccable` instalada sin commitear (lint/formato ya la ignoran, `6b10697`):
   pregunta abierta al owner de quien la commitea.
5. Siguiente funcionalidad: reporte de retorno. Inventario en `docs/analisis-producto-2026-10-10.md` §Inventario.
   Pregunta abierta al owner: registrar cada escaneo como evento.

**Decisiones del owner, no volver a preguntar:** ADR 0134, 0135, 0136 (2026-10-10). Precio de la landing (Impulso
$45 y «local adicional $12», distinto de Stripe $49): «dejalo asi» (2026-10-10).
