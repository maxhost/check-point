# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-13, tarde) — SIGUE LA FASE 2 (POS Y MESAS COMO MODULOS); UN UNICO PUSH AL TERMINARLA

**Decision del owner (2026-10-13, no volver a preguntar): «hacemos clear y vas vos con la fase 2. cuando acabemos pos y
mesas recien hacemos un unico push para todo».** No se pushea a `main` antes de terminar POS y Mesas.

**En PROD:** codigo `origin/main` = `4208714` (Stock, Recetas, dictado, pantallas de GPT del 12/10). **Base PROD hasta la
0078** (79 migraciones): 0074-0077 el 13/10 madrugada, **0078 el 13/10 tarde** (snapshot `snap-soft-sound-ax72gkfp`; CHECK
de permisos de forma; 4 membresias = 4 owners sin permisos). Todo compatible con el codigo de PROD.

**`main` local = `792d7ed`; `dev` = `main` + docs.** Sin pushear, esperando el unico push: Fase 1 de modulos (ADR 0139,
specs 0216 Claude + 0217 GPT, **revisor adversarial PASS**, regla 1b agregada `9204c30`), ingreso del equipo (spec 0218,
`f534604`, servidor solo), iconos de modulo de GPT (`3e33436`). Gate al cerrar: typecheck 6/6, lint 0, `pnpm run test`
275 archivos / 2677 tests verdes. El ultimo pre-push (`792d7ed`) dio todo verde (Neon completa incluida) salvo
`landing.spec.ts` en frio (1/371): **GPT tiene el prompt para arreglarlo** (no depender de que cargue la imagen del hero en
`next dev` frio). El owner eligio esperar ese arreglo, sin `--no-verify`.

**Documentos de referencia:** `docs/MODULOS.md` (como se trabaja un modulo), ADR 0138/0139, plan
`docs/plan-modulos-plugin-2026-10-13.md` (decisiones del owner de la Fase 2: tablas del POS al esquema `pos`, permisos
declarados por modulo, rutas bajo `/api/modules`, pantallas por GPT con encargo, Mesas modulo propio `requires: ["pos"]`),
ADR 0140 + spec 0218 (ingreso del equipo por `staff.`).

**QUE SIGUE (Claude):**
1. **Fase 2, spec + ADR** (L3): ampliar el contrato con los puntos de enganche que pide el POS (pantalla completa,
   `startPage` de la PWA, `locationActions` para el boton Mesas en Locales, `canDisable` «no se apaga con ordenes
   abiertas», aviso de la prueba gratis) — cada uno generico, por ADR. Inventario medido de los 26 archivos del core que
   nombran al POS: en el plan. Despues implementador + encargo a GPT + revisor adversarial (acoplamiento, regresiones del
   POS, migracion de datos). La migracion de mudar tablas va JUNTO con el deploy (rompe al codigo viejo).
2. Decisiones del owner pendientes de la 0218: integrante sin permisos efectivos (hoy → `/backoffice`); bloquear
   `GET /api/onboarding/state` con PIN temporal (Claude recomienda si); `mustChangePin` en `GET /api/merchant/session`
   (Claude recomienda si).
3. Antes del push unico: `/acceso-equipo` (GPT, prompt dado), landing estable (GPT), dominio `staff.checkpass.club` +
   DNS + `STAFF_ORIGIN` + `BETTER_AUTH_TRUSTED_ORIGINS` (owner, o Claude con OK). Push desde worktree limpio
   (`tools/worktree-new.sh`): `.impeccable/` sin rastrear de GPT rompe el format:check del pre-push en la carpeta.

**Gotchas de esta sesion (ya en skills/lecciones):** 8 suites Neon a la vez dan falsos rojos (correr de a 1-2); un
`git add` de un doc compartido (`INDEX.md`) arrastra cambios sin commitear de GPT (pasó en `9204c30`, inocuo).

| Descartado | Por que |
|---|---|
| Refactor de modulos antes del push del 12/10 | ~1-2 dias; el owner priorizo la prueba con el comercio real |
| `--no-verify` en el push del 13/10 tarde | owner: esperar el arreglo de la landing |
| Analisis de tickets/fotos para Stock | owner: el dictado lo reemplaza |