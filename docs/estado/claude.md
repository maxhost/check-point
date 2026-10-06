# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-06, madrugada) — 0165 EN PROD (`17cac99`, Vercel `success` x3); SIGUE EL REVISOR INDEPENDIENTE DE LA 0163

**Hecho (verificado):**
- **0165 / ADR 0125** (catalogo entero, IA incluida, y retirar/cancelar retiro del programa sin email verificado):
  `origin/main` = `17cac99`, pre-push `verify: ok` DENTRO del hook; statuses de GitHub de `17cac99`: Vercel merchant,
  customer y public `success`. Revisor PASS (`8ad441a`), M1–M3 rojas y revertidas. **QA del owner pendiente.**
- **Incidente reparado (2026-10-05, noche):** los tests de `ui-guard`/`zone-audit` (0164), corridos por el pre-push,
  heredaron `GIT_DIR`/`GIT_INDEX_FILE` y escribieron en el repo real (`core.bare=true`, `core.filemode=true`,
  `[user] t@t`, la rama `sin-gate-email` y el HEAD del worktree movidos). Reparado a mano desde el reflog; `origin` no se
  toco. Fix `17cac99`: `gitEnv()` sin `GIT_*` + oraculo con `GIT_DIR` señuelo (rojo sin el fix por la razon correcta).
  Caso en `docs/LECCIONES.md`, regla en la skill `gotchas-del-repo`. Verificado despues del push: `.git/config` con
  `bare = false`, `filemode = false`, sin `[user]`.
- **Owner (2026-10-06):** «la 0157 ya esta cerrada, GPT ya hizo los ajustes»; «el buscador de lugar en alta esta
  probado y funcionando». No volver a pedirlo.
- Fase 1 de UI: prompt dado a GPT (sin push hasta el final; GPT numera desde **0170**, Claude **0165–0169**).

**Siguiente, en orden:**
1. **Revisor independiente de la 0163** (subagente `revisor`, N1 de GPT, `docs/specs/0163-raiz-del-merchant-abre-onboarding.md`,
   diff `1889b6d..bc8f3fd`, handoff `docs/handoff-0163-entrada-merchant-2026-10-05.md`). Lo que pide el handoff: sesion
   valida → `/` conserva la portada; sesion vencida/cookie invalida → onboarding; los rebotes del guard de
   `/backoffice` (destino `/`) no hacen ciclo; DoD abierto en la spec linea 39. Presupuesto: correctitud + 1–3 mutaciones
   sobre `apps/merchant/src/app/page.tsx`. Con PASS: la spec a `implementada` + fila de INDEX (es spec de GPT: solo el
   estado, no su contenido).
2. Flakes que bloquean pushes: PARQUEADO #74 primero (dos `--no-verify` en un dia), despues #75 y #78.
3. Chicos: H4 de la 0155 (400 de Google en Details por clave invalida se ve como `place_not_found`);
   `docs/design-system.md` §Form dice «Pendiente» sobre `validationErrors` (resuelto por la 0162).
4. Arco UI (ADR 0123), cuando toque: piezas del kit que pida GPT, #79, #77, Cierre.

**Como se trabaja:** GPT commitea la Fase 1 en local sobre `main` del arbol principal sin pushear. Claude trabaja en
worktrees desde `origin/main` (`tools/worktree-new.sh <nombre>`; enlazar `apps/merchant/.env.local` a mano) y pushea con
`git push origin <rama>:main`. El worktree `check-point-wt/sin-gate-email` ya cumplio: se puede borrar
(`git worktree remove … && git branch -D sin-gate-email`). Si el `main` local no tiene commits de GPT, se adelanta con
`git merge --ff-only origin/main`.

**Pendientes del owner:** QA de la 0165 (cuenta sin verificar: categoria/producto/imagen/stock, import con IA,
borrados, retirar y cancelar el retiro); QA del buscador en locales y del tour de locales (0160); borrar las dos claves
de Geoapify en Vercel.

**Hallazgos abiertos:** PARQUEADO #74, #75, #77, #78, #79; H4 de la 0155.

**Gotchas:** un rojo que sale SOLO dentro del pre-push no es flake hasta leer la salida entera (guardarla:
`git push … > log 2>&1`). No hay `gh` ni `vercel` en el PATH: el estado del deploy se lee con
`curl -s https://api.github.com/repos/maxhost/check-point/commits/<sha>/statuses`.

**Prompt para retomar:** «Lee docs/estado/claude.md: revisor independiente de la 0163».
