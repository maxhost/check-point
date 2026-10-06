# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-06, tarde) — 0163 Y 0166 EN `origin/main` (`c69751d`, pre-push `verify: ok`); ENCARGO PARA GPT ESCRITO

**Hecho (verificado):**
- **0163** (GPT): `implementada` con PASS del revisor; la rama con sesion la cubre `page.neon.integration.test.ts`.
- **0166** (N2, decision del owner: con sesion, `business.checkpass.club/` lleva al panel): `/` sin `?e=` → sesion valida a
  `/backoffice`, sin sesion al alta; con `?e=` nunca redirige; el guard cierra la sesion sin negocio (`!row`), asi no
  hay ciclo `/` ↔ `/backoffice`. Implementacion `2e45d0f`; revisor PASS (barrio todos los `redirect` a `/`); R2 (que
  quedaba verde) cerrada por mi con el caso `?e=` vacio → panel, medida roja y revertida. Reproducido por mi: unitario
  13/13, Neon 7/7. Comentario vencido de `magic-link/route.ts` corregido.
- **Push** `17cac99..c69751d` desde `sin-gate-email`, pre-push `verify: ok` (tabla en el hook). El `main` del arbol
  principal se adelanto con `--ff-only` a `c69751d` (no tenia commits de GPT). **Vercel: sin statuses al consultar justo
  despues del push** — confirmar `success` antes de pedir QA.
- **Owner (2026-10-06):** una sesion sin negocio no se puede crear (medido en PROD: 15 usuarios, 15 membresias) y NO va a
  PARQUEADO; al desactivar un staff su sesion se cierra (ya lo hace `staff.ts:258`).
- **`docs/encargo-gpt-2026-10-06.md`**: lo que GPT tiene que cerrar — (1) pantalla del motivo de `?e=` (despues de la
  0166, mismo `page.tsx`), (2) fechas de marketing al `DateTimeField` (#79), (3) estado de la 0157 en INDEX.

**Siguiente, en orden:**
1. Statuses de Vercel de `c69751d` en `success` → pedir QA al owner: logueado, `business.checkpass.club/` → panel; sin
   sesion → alta.
2. Flakes que bloquean pushes: PARQUEADO #74 primero, despues #75 y #78.
3. Chicos: H4 de la 0155; `docs/design-system.md` §Form «Pendiente» sobre `validationErrors` (resuelto por la 0162).
4. Cuando GPT pushee la Fase 1 con las fechas migradas: restringir el `type` de `TextField` (#79).
5. Arco UI (ADR 0123): piezas del kit que pida GPT, #77, Cierre.

**Como se trabaja:** GPT commitea la Fase 1 en local sobre `main` del arbol principal sin pushear. Claude trabaja en
worktrees desde `origin/main` (`tools/worktree-new.sh <nombre>`; enlazar `apps/merchant/.env.local` a mano) y pushea con
`git push origin <rama>:main`. El worktree `sin-gate-email` sigue en uso; este commit de estado esta solo ahi.

**Pendientes del owner:** decidir el boton de cada codigo de `?e=` (propuesta en el encargo de GPT) o dejarlo a la spec
de GPT; QA de la 0165 y de la 0166; QA del buscador en locales y del tour de locales (0160); borrar las dos claves de
Geoapify en Vercel.

**Hallazgos abiertos:** PARQUEADO #74, #75, #77, #78, #79; H4 de la 0155.

**Gotchas:** un rojo que sale SOLO dentro del pre-push no es flake hasta leer la salida entera (guardarla:
`git push … > log 2>&1`). No hay `gh` ni `vercel` en el PATH: el estado del deploy se lee con
`curl -s https://api.github.com/repos/maxhost/check-point/commits/<sha>/statuses`.

**Prompt para retomar:** «Lee docs/estado/claude.md: flake #74» (el owner pidio seguir con #74; QA de la 0166 pendiente de su lado).
