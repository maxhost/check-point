# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.



## ⇥ ESTADO (2026-10-13, noche) — FASE 2 (POS Y MESAS) + CENTRALIZADOR DE IA EN `dev`; GPT TOMA TODO EL TRABAJO; PUSH UNICO PENDIENTE

**Decision del owner (2026-10-13 noche):** GPT pasa a encargarse de TODO (UI y backend) y actualiza el harness y la
documentacion para eso. Este es el ultimo bloque de Claude: punto de partida para GPT = **`dev` en la etiqueta local
`handoff-claude-2026-10-13`** (`bca17ec`; el commit de este handoff va encima). `main` local = `fab728e` (merge de GPT de la
landing, sin push). `origin/main` = PROD = `4208714`. **Nada pusheado.** Owner: «no vamos a hacer como dije todavia el push,
lo vamos a hacer con el centralizador de ia tambien» → UN push unico con Fase 2 + centralizador.

**Hecho y verificado (gate al cerrar sobre `bca17ec`: typecheck exit 0, lint exit 0, `pnpm run test` 283 archivos / 2720
tests verdes):**
- **Fase 2 — POS y Mesas como modulos** (spec 0220 + 0222 GPT, ADR 0141). 2a servidor/base `52690f3`…`a46be31`, 2b
  pantallas GPT `369da93`…`78ba729`, paso final `posEnabled` fuera de la sesion `3dd195c`, frontera H2 `8ee3c02`, Locales
  H1 `c3c4ca1`. **Revisor adversarial final PASS** (tras FAIL por H1, arreglado). Migracion **0079** (tablas al esquema
  `pos`, `pos_enabled` → `core.business_module`) aplicada y probada en la base LOCAL (datos iguales, cobro con y sin pase,
  409 de apagado).
- **Centralizador de IA** (spec 0224, ADR 0143; absorbe 0142/0223 foto de ticket): `server/ai/`, cada funcion declara su
  tarea (menu en el core, Stock y Recetas en su carpeta), registro unico `core.ai_request`, **sin `AI_PROVIDER` → error,
  nunca falso**. `bdd642b` + `cebbb46`. Migraciones **0080** (crea `core.ai_request`) y **0081** (copia el historial y borra
  `stock.draft_request`, las columnas de uso de `core.catalog_import` y `draft_version`). Suite Neon de la 0081 2/2 en base
  descartable; las demas suites Neon corrieron en verde antes de que el owner recortara pruebas. 0080/0081 aplicadas en la
  base LOCAL (82 migraciones; historial copiado: 6 filas). **NO verificado (owner pidio recortar):** mutaciones, revisor
  adversarial, e2e y la **prueba real con OpenAI** (foto, receta, dictado, menu: el prompt del menu ahora va como `system`).
- Arreglo de Google Places traido de la rama `sin-gate-email` (`bb87e25`, 0155 H4; 75 tests verdes). Ramas/worktrees
  viejos borrados (`motor`, `spec-0190`, `glados/*`, `sin-gate-email`, dos en `/private/tmp`); gotchas de `motor`
  rescatados en `PARQUEADO.md`.

**Que sigue (para GPT; detalle en `docs/PARQUEADO.md` §«PARQUEADO 2026-10-13 — Fase 2 de modulos»):**
1. Pantallas de la foto (boton «Foto» en Stock y en la receta): contrato en spec 0224 §Encargo a GPT. Sin eso la foto
   solo existe por API.
2. QA local con `pnpm dev:local` (owner, en su terminal): POS y Mesas, Locales (crear/renombrar local y abrir «Mesas»
   sin recargar — el e2e usa un harness que simula `router.refresh()`), dictado y menu con OpenAI real.
3. Antes del push: `AI_PROVIDER` en Vercel Production/Preview (comparar por HUELLA `STOCK_DRAFT_PROVIDER` vs
   `CATALOG_EXTRACTION_PROVIDER`; si difieren, decide el owner); dominio `staff.` + DNS + `STAFF_ORIGIN` (spec 0218).
4. Push unico con OK del owner: `main` ← `merge --ff-only dev`, probar `main` en local, snapshot de Neon, push, deploy
   `READY`, **0079 → 0080 → 0081 en la misma ventana**, SQL de verificacion (spec 0220 y 0224 §Migracion a PROD; runbook
   `docs/runbooks/migrar-prod.md`). Rollback = snapshot de Neon + rollback de Vercel juntos.
5. Decisiones del owner abiertas: descripcion de la PWA (hoy «El punto de venta de tu negocio en CheckPass Club.»; Claude
   propuso «Tu negocio en CheckPass Club.»); las tres de la 0218.

**Gotchas de esta sesion:** e2e con harness fallan al arrancar con «Cannot find module 'vite/package.json'» → `NODE_PATH`
a `node_modules/.pnpm/node_modules` (en `PARQUEADO.md`); el hook `foreign-staged.sh` bloquea tambien `git commit -- <paths>`
cuando otro agente tiene archivos staged (su mensaje recomienda justo eso; arreglo denegado por auto-modificacion del
harness: queda para quien actualice el harness); las suites Neon se corren en una base DESCARTABLE de la rama de CI, nunca
en `neondb` (la usa la CI del codigo de PROD).

| Descartado | Por que |
|---|---|
| Foto de ticket como spec suelta (0223 commiteada tal cual) | owner: se rehace como primer uso del centralizador (0224) |
| Segundo push para la 0081 | owner: un solo push; separarla solo servia para el rollback de Vercel, que la 0079 ya impide |
| Falso por defecto sin `AI_PROVIDER` | owner: error, nunca falso |
| Mutaciones + todas las suites + entorno local en cada entrega | owner: «excesivo»; verificacion minima y enfocada |
