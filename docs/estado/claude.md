# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-11) — EN PROD `3fe2ad6`: LOGIN POR CODIGO, PWA DEL POS, IMPRIMIR POR NEGOCIO, VENCIMIENTO

**En PROD:** `origin/main` = `3fe2ad6` (push con OK del owner; pre-push `verify: ok` en worktree limpio: e2e ok, neon 419
archivos / 3375 tests). Deploys de merchant/customer/public/admin `success` (status de GitHub del commit). Smoke: `/api/health`
200 en `business.` y `my.`, `/negocios` 200, `manifest.webmanifest` 200 (CheckPass POS), `POST /api/merchant/auth/login/verify`
con codigo corto → 400 `invalid_code`. Incluye 0202 (login por codigo, API + UI), PWA del POS (`adb723c`), 0195 U4
(vencimiento en el wizard), 0205 (entrada en login), 0206 (imprimir si/no, apagado por defecto), landing 0197–0204.
**Migracion 0072 aplicada en PROD** (antes del push; snapshot previo `snap-late-water-ax6pc362`): 73 en
`drizzle.__drizzle_migrations`, hash del ultimo = sha256 del `.sql`, columna `NOT NULL DEFAULT false`; 3 negocios / 3 usuarios.

**En `dev`, sin pushear:** `f354673` blindaje de e2e (URLs de entrada en `tests/e2e/support/merchant-entry-urls.ts`; la
landing compara contra `onboardingUrl` de site-config y precalienta Next — en frio el primer `goto /negocios` pasaba 30 s).
Medido en frio: 37 passed. Va en el proximo push (owner decide).
Despues entraron a `dev` (2026-10-12): `075f6f0` nota libre en la orden del POS (OTRA sesion de Claude; **migracion 0073**
`core.pos_order.note` + check 1..1000, aditiva, **NO aplicada en PROD**: aplicarla ANTES del proximo push, como la 0072;
el commit dice L1 pero una migracion a PROD tiene piso L2) y las reservas de GPT 0207/0208 (wallet Club cotidiano, con
cambios suyos sin commitear en `apps/consumer`). INDEX y specs 0197–0206 marcados «en PROD `3fe2ad6`».

**QUE SIGUE:** QA del owner en iPhone (instalar el panel como app → login por codigo con sugerencia del teclado → POS;
Ajustes → «Imprimir tickets»; vencimiento en el wizard). Hallazgo a decidir: el alta con email existente sigue mandando LINK.
Parqueados: #91 analitica, #92 papel 58/80. Ramas `spec-0190`, `motor`, `sin-gate-email`: decision del owner pendiente.

**Decisiones del owner, no volver a preguntar:** ADR 0134–0137; 0206 (apagada para todos, ocultar boton); U5/U6 descartadas
(lecturas para el cliente conservadas, TASKS); POS quita el cupon solo de la venta (0183); precio de la landing «dejalo asi».
