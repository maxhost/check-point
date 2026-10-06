# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-06, mañana) — 0163 IMPLEMENTADA CON PASS (`f124e2d`), SIN PUSHEAR, EN LA RAMA `sin-gate-email`

**Hecho (verificado):**
- **0163** (GPT, N1: la raiz del merchant sin sesion abre el onboarding): revisor independiente **PASS**. La rama con
  sesion (DoD 2) quedo cubierta por un test nuevo, `apps/merchant/src/app/page.neon.integration.test.ts` (4 casos,
  `4 passed` reproducido por mi con `tools/neon-test.sh`). La M2 (`redirect("/backoffice")` con sesion) la reproduje:
  2 rojos con `expected 'redirect:/backoffice' to be 'portada'`, restaurado con `shasum` `1d418096…` identico. El e2e
  commiteado NO mata M1 ni M2: solo las mata el test Neon. Typecheck y eslint del test con exit 0. Spec a `implementada`
  + fila de INDEX en `f124e2d`. **`pnpm verify` completo no se corrio**: corre en el pre-push.
- `f124e2d` y este commit estan en la rama `sin-gate-email` (worktree `check-point-wt/sin-gate-email`), **sin pushear**
  (Hobby: juntar cambios). `origin/main` = `17cac99`; el `main` local (`df88144`) es ancestro de la rama.
- Sigue de antes: 0165 en prod (`17cac99`), QA del owner pendiente.

**Hallazgos a decidir (de la revision de la 0163, no son decision del owner):**
- `/?e=<codigo>` sin sesion pierde el motivo: un staff con `staff_disabled` termina en el wizard de alta de dueño.
  La portada vieja tampoco mostraba el motivo; lo nuevo es el destino.
- Una sesion valida SIN negocio que abre el onboarding salta a `/backoffice` (`restoredStage` solo mira
  `authenticated`), rebota a `/` y queda en la portada sin salida. Previo a la 0163.

**Siguiente, en orden:**
1. Pushear `sin-gate-email` a `main` cuando se junte con lo siguiente (`git push origin sin-gate-email:main`, pre-push
   con `verify`; guardar la salida en un log). Despues, `git merge --ff-only origin/main` en el arbol principal si GPT
   no tiene commits locales, y recien ahi se puede borrar el worktree.
2. Flakes que bloquean pushes: PARQUEADO #74 primero, despues #75 y #78.
3. Chicos: H4 de la 0155; `docs/design-system.md` §Form «Pendiente» sobre `validationErrors` (resuelto por la 0162).
4. Arco UI (ADR 0123), cuando toque: piezas del kit que pida GPT, #79, #77, Cierre.

**Como se trabaja:** GPT commitea la Fase 1 en local sobre `main` del arbol principal sin pushear. Claude trabaja en
worktrees desde `origin/main` (`tools/worktree-new.sh <nombre>`; enlazar `apps/merchant/.env.local` a mano) y pushea con
`git push origin <rama>:main`.

**Pendientes del owner:** QA de la 0165; QA del buscador en locales y del tour de locales (0160); borrar las dos claves
de Geoapify en Vercel; decidir los dos hallazgos de arriba.

**Hallazgos abiertos:** PARQUEADO #74, #75, #77, #78, #79; H4 de la 0155.

**Gotchas:** un rojo que sale SOLO dentro del pre-push no es flake hasta leer la salida entera. No hay `gh` ni `vercel`
en el PATH: el estado del deploy se lee con `curl -s https://api.github.com/repos/maxhost/check-point/commits/<sha>/statuses`.
El `.env.local` del merchant en worktrees: una cookie de sesion basura en `next dev` da 500 (Auth sin env valido); el e2e
de la raiz pasa por el atajo `getSessionCookie`, no porque el env este completo.

**Prompt para retomar:** «Lee docs/estado/claude.md: pushear sin-gate-email y seguir con el flake #74».
