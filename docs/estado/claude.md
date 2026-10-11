# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-10) — 0190, 0195 Y 0196 MERGEADAS EN `dev` (`6fdb336`); SALIDA A LIVE EN CURSO; PROD sin cambios

**En PROD:** sin cambios, `main` = `origin/main` = `9405c93` (CI de `main` ROJO por `/private/tmp` en e2e, ya
corregido en `dev` por GPT `da78bbc`). **Migraciones 0069, 0070 y 0071 NO aplicadas en PROD.**

**En `dev` (sin pushear), todo commiteado:** 0189 (planes pagos), merge `964cc18` spec 0190 (panel de plataforma),
merge `5fbdec7` spec 0195 (vencimiento; conflicto solo en `PARQUEADO.md`, resuelto), `6fdb336` `apps/platform/vercel.json`.
De GPT: landing + paginas SEO 0191–0194 (`60590de`, e2e corregido en `da78bbc`; `landing.spec.ts` 4/4 verde contra
:3003) y UI de cobro 0196 = U1–U3 (`8611689`; contrato revisado contra las rutas `checkout`/`plan`/`resume`).

**Salida a live (owner 2026-10-10: «esperamos a GPT y hacemos todo el merge a main»):**
1. `pnpm verify` completo en `dev` — CORRIENDO al escribir esto (log en scratchpad de la sesion); resultado sin ver.
   Para correrlo se apagaron los dev servers 3200/3201/3002/3003 (`/entorno-local arrancar` los levanta).
2. Migraciones 0069/0070/0071: probar en la base local (`tools/local-db`), snapshot de PROD, `pnpm db:migrate:prod`,
   huellas (runbook `docs/runbooks/migrar-prod.md` §3) — con OK del owner en ese momento.
3. `merge --ff-only dev` a `main`, owner prueba `main` en local, push con su OK.
4. Owner crea el proyecto Vercel del panel desde GitHub (raiz `apps/platform`, dominio `admin.checkpass.club`).
   Variables que lee: `DATABASE_URL`, `PLATFORM_AUTH_SECRET`, `PLATFORM_AUTH_URL`, `PLATFORM_ADMIN_EMAILS`,
   `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`.

**Verificado:** Vercel `check-point-merchant` tiene los 8 `STRIPE_PRICE_*` (los `BASE_*` solo en production); el owner
dice que Stripe live esta completo.

**Siguiente funcionalidad:** reporte de retorno. Inventario de datos hecho (`docs/analisis-producto-2026-10-10.md`
§Inventario: PROD tiene 0 clientes/ventas; escaneos no se guardan como evento; holdout solo en push). Pregunta abierta
al owner: registrar cada escaneo como evento.

**Pendiente de GPT:** U4–U6 (vencimiento, spec 0195 §D6), API ya en `dev`.

**Decisiones del owner, no volver a preguntar:** ADR 0134, 0135, 0136 (2026-10-10). Precio de la landing (Impulso
$45 y «local adicional $12», distinto de Stripe $49): «dejalo asi» (2026-10-10).
