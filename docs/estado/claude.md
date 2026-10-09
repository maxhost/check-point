# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.


## ⇥ ESTADO (2026-10-08, noche) — MESAS DEL LOCAL (spec 0182, ADR 0131) IMPLEMENTADAS EN `dev` (`cc1eb17`)

**En PROD (`main` = `origin/main` = `3e26701`):** sin cambios desde el handoff anterior (POS con migracion 0066).

**En `dev`, sin pushear (van con el proximo push, con OK):**
- `cc1eb17` **mesas del local** (L2). Migracion **0067** (`core.dining_table` + `pos_order.dining_table_id` con unico
  parcial de mesa abierta), CRUD `/api/locations/:id/tables` (permiso `locations`, archivar, nunca borrar),
  `GET /api/pos/tables` con `openOrderId`, `tableId` en crear/editar orden POS (nombre fotografiado, local de la
  mesa, 409 `table_occupied`), `tableId` en `PosOrder` y en el listado. Seed local: 4 mesas en el Café.
  Medido: typecheck/lint 0; Neon `tables` 9/9 + `pos-orders` 7/7 + `pos-close` 6/6; M1/M2 rojas y revertidas.
  Migracion 0067 aplicada en la base LOCAL y en la rama Neon de CI; **NO en PROD**.
- `838a33d` (catalogo POS sin productos sin precio) y `8660441` (scripts 100755) siguen sin pushear.
- GPT: specs 0179–0181 commiteadas; en el arbol hay cambios de GPT sin commitear (`pos-console.tsx`,
  `pos-editor.tsx`, `ui/tokens.css`): no son de Claude, no tocar.

**Pendiente / abierto:**
- UI de mesas (administrarlas y elegirlas en el POS): es de GPT, contrato en la spec 0182 §Diseño.
- Migracion 0067 a PROD: con OK del owner, en el proximo pase a live (snapshot antes).
- Staging en proyectos separados: plan en `docs/plan-staging-2026-10-08.md`, PARQUEADO #82.
- Deuda declarada: test del `no_program` en `accrualContext` (R3 de la 0169). `pnpm verify` completo nunca corrio
  en verde (14 e2e de tours/onboarding sin causa; `ci:status` del 2026-10-08 sigue rojo por esos e2e).
- Arbol: `.claude/skills/gotchas-del-repo/SKILL.md` y `docs/LECCIONES.md` de otra sesion, sin commitear.
- Ambiente local: Colima (no Docker Desktop): `colima start` antes de `pnpm dev:local`. El mensaje de `up.sh`
  todavia dice «abri Docker Desktop» (ofrecido cambiarlo, sin respuesta).

**Decisiones del owner, no volver a preguntar:** las de antes (ADR 0126/0127, spec 0169 §Decisiones, canje solo en
mostrador, PARQUEADO #81, staging separado, POS sin productos sin precio) y las de mesas (ADR 0131 §Decisiones:
POS con texto libre de respaldo, permiso `locations`, solo nombre + plazas + orden, una orden abierta por mesa,
plazas opcionales).
