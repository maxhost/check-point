# TASKS

**Estado actual del proyecto. Este es el punto de retorno.**

Si una sesion se cae, se cierra o se compacta, se vuelve aca — no al chat. Hay un hook `Stop` que
bloquea el fin del turno si se toco codigo y este archivo quedo viejo.

Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista
en pantalla. No "deberia andar". El auto-reporte no es evidencia.

**Desde la spec 0066 este archivo contiene SOLO el arco en ejecucion.** Lo diferido, parado o
pospuesto vive en **`docs/PARQUEADO.md`** (el unico lugar donde buscar pendientes); el relato
historico completo —7.185 lineas: cada sesion, cada veredicto, cada tabla de mutaciones— esta en
**`docs/archivo/TASKS-historico-2026-09-16.md`**.

Ultima actualizacion: 2026-09-16 — **spec 0066 (reparacion del harness) IMPLEMENTADA en los tres
pasos y medida**, y commiteada por el commit que trae esta linea. Falta el PASS de un revisor
independiente antes de marcar la spec `implementada`.

## ⇥ SPEC 0066 — REPARACION DEL HARNESS: implementada, 5 gates verdes, sin PASS todavia

Punto de entrada: `docs/specs/0066-reparacion-del-harness.md` (`cerrada`) y el **ADR 0069**. Los tres
pasos se hicieron en el orden que fijo el owner (1 → 2 → 3).

### Paso 1 — Poda de `CLAUDE.md` y reorganizacion de `docs/`: **HECHO Y MEDIDO**

| Que | Evidencia ejecutada |
|---|---|
| `CLAUDE.md` **696 → 136 lineas** (techo 200) | `wc -l CLAUDE.md` |
| `docs/LECCIONES.md` (386 lineas) | la seccion `## Verificacion` entera, **verbatim** |
| `.claude/skills/gotchas-del-repo/SKILL.md` (291) | la seccion `## Gotchas` entera, **verbatim** |
| `.claude/skills/protocolo-de-verificacion/SKILL.md` (137) | version operativa condensada; los casos quedan en `LECCIONES.md` |
| **Ninguna regla se perdio** | `tools/claude-md-coverage.sh` → **46/46 bloques**, exit 0 |
| `CLAUDE.md` **no** importa nada con `@` | aseverado por `tools/context-budget.test.ts`, y probado por mutacion |
| `docs/TASKS.md` partido | este archivo + `docs/archivo/TASKS-historico-2026-09-16.md`, **7.185 lineas identicas verificadas con `diff`** |
| `docs/PARQUEADO.md` | 6 decisiones que esperan spec · 3 hallazgos a decidir · 4 deudas declaradas · pendientes del owner · el legado de la era demo |
| `docs/archivo/` | 8 encargos/revisiones movidos con **`git mv`** (el `git status` los muestra como `R`), + el `CLAUDE.md` pre-poda de 696 lineas |
| `docs/INDEX.md` | filas nuevas para `LECCIONES.md`, `PARQUEADO.md`, `archivo/` y `.claude/skills/` |

**Dos guards, no uno, y por que:** `.claude/hooks/claude-md-size.sh` (Stop) corre solo en esta
maquina y solo al cerrar un turno; `tools/context-budget.test.ts` corre en `pnpm test`, o sea
tambien en CI y para cualquiera que clone. **Miden igual en el borde** — verificado: con 200 lineas
los dos pasan, con 201 el hook da `exit 2` y el test da `expected 201 to be less than or equal to
200`. La primera version del test contaba **una linea de mas** (`split("\n").length` cuenta el
string vacio del salto final): se habria puesto rojo con el hook en verde. Cazado midiendo el
borde, no leyendo el codigo.

**Por que el hook es `Stop` y no `PostToolUse`:** `file-size.sh` es PostToolUse (Write|Edit) y por
eso es **ciego a una edicion hecha por Bash** — que es exactamente como se edito `CLAUDE.md` aca.

### Paso 2 — `.claude/agents/`: **ESCRITO, sin verificar en esta sesion (limite real, medido)**

`implementador.md` (101 lineas) y `revisor.md` (92). El de revisor **exige presupuesto y condicion
de corte** como primera linea del informe, y si el encargo no los trae, **fija el default el agente**
(4 mutaciones, clase de error PLAUSIBLE) en vez de dejarlo implicito. Es el ADR 0062 convertido en
configuracion: el corte deja de depender de que el orquestador se acuerde.

**Un limite que se declaro y resulto FALSO — queda escrito porque es el error, no el dato.** Al
despachar un encargo de prueba al agente `revisor`, la herramienta contesto `Agent type 'revisor'
not found. Available agents: claude, Explore, general-purpose, Plan, statusline-setup`, y el
orquestador escribio aca que «las definiciones de `.claude/agents/` no se cargan a mitad de
sesion». **Es falso:** unos turnos despues el harness releyo la config **en la misma sesion** y los
dos agentes aparecieron disponibles. Lo correcto era decir lo unico medido —«en el instante del
despacho todavia no estaban cargados»— y no inventar el mecanismo. Es el ADR 0054 del lado de la
causa: explicar un sintoma se siente como entenderlo.

Verificado ademas: el frontmatter de los dos archivos parsea y tiene `name`, `description`,
`tools`, `model`, con el `name` correcto.

⇒ **Pendiente (es la verificacion manual que pide la spec):** despachar un encargo SIN presupuesto
al agente `revisor` y confirmar que el presupuesto viaja igual. **Ya no hace falta sesion nueva
para eso**, pero si un turno distinto del que escribio el codigo.

### Paso 3 — `tools/worktree-new.sh`: **HECHO Y MEDIDO — el DoD que mas importa**

- Worktree real creado (`prueba-0066`): `pnpm install --offline` en **4,2 s**, `downloaded 0`
  (100% offline desde el `.pnpm-store` del repo, que se **enlaza**, no se copia: son 643 MB).
- `turbo run typecheck --force` **adentro del worktree**: 3/3 successful, **`Cached: 0 cached`**,
  6,18 s. La primera corrida habia dado `FULL TURBO` por cache compartida — un verde que no probaba
  nada; por eso va con `--force`.
- `node_modules` del worktree es **un directorio propio**, no un symlink al del repo.
- `shasum` de `node_modules/.modules.yaml` del repo principal **identico antes y despues**
  (`7ee0e96f…`). El script lo compara solo y **aborta con exit 2** si cambio.
- Enlaza tambien los `.env*` de la raiz: sin ellos los tests de integracion quedan en `skipped`
  **con el run en VERDE**, que se lee identico a un PASS.
- Los 3 worktrees de prueba fueron removidos (`git worktree list` muestra solo el principal).

## BITACORA DE MUTACIONES — spec 0066: CERRADA, 3/3 del presupuesto

**Presupuesto declarado en la spec: TRES mutaciones**, una por guard nuevo. Clase de error: **los
plausibles** — un guard que sale 0 sin mirar nada, y una regla que desaparecio en la mudanza. No se
reabrio por «quedo una preimagen mas» (ADR 0062).

| id | archivo (estado en git) | shasum limpio | invariante atacado | resultado EJECUTADO |
|---|---|---|---|---|
| M1 | `.claude/skills/gotchas-del-repo/SKILL.md` (`??` → copia en `/tmp`) | `606451b5…` | «ninguna regla se perdio en la mudanza» | **ROJO** — borrado el bloque de los 3 gotchas de drizzle/driver/apex, `claude-md-coverage.sh` paso a **45/46**, **exit 2**, nombrando el bloque exacto que faltaba |
| M2 | `CLAUDE.md` (` M` → copia en `/tmp`; `git checkout` se habria llevado toda la spec) | `20653fee…` | «el guard de 200 lineas MUERDE» | **ROJO en el borde** — 200 lineas: hook `exit 0`; 201: **`exit 2`** y el mensaje nombra el limite y el ADR |
| M2b | `CLAUDE.md` (**misma mutacion, alcance extendido** al segundo consumidor) | idem | el test tambien muerde, y por la propiedad | 201 lineas → **1 failed** (`expected 201 to be less than or equal to 200`); `@docs/LECCIONES.md` agregado → **1 failed** y **solo esa**, con las otras dos en verde |
| M3 | `tools/worktree-new.sh` (`??`) + `node_modules/.modules.yaml` (copias en `/tmp`) | `6620726e…` / `7ee0e96f…` | «el guard de aislamiento MUERDE» | **ROJO** — simulada la contaminacion del repo principal: **exit 2** + `ALARMA: … CAMBIO (7ee0e96f… -> e6f4b907…)` |

**Las cuatro revertidas y verificadas**: `diff` limpio contra la copia de `/tmp` y `shasum` identico
al baseline en los tres archivos. `grep -rn MUTATION` no devuelve ninguna viva (lo que aparece en
`protocolo-de-verificacion/SKILL.md` y en `CLAUDE.md` es prosa que **describe** la convencion).

**Limite del hook, medido hoy y DECLARADO:** `no-mutations-left.sh` solo mira `.ts`/`.tsx` bajo los
`src/`, asi que **ninguna de estas mutaciones la habria cazado** — las cuatro vivieron en `.md` y
`.sh`. Anotado en `docs/PARQUEADO.md`; no se arregla aca porque tocar los hooks existentes esta
explicitamente fuera del alcance de la 0066.

**Fuera de la tabla, encontrado al cerrar:** la spec lista `tools/context-budget.test.ts` en el
frontmatter pero **no lo menciona en el cuerpo** (ni en Alcance, ni en la tabla de Archivos, ni en
el DoD). Se implemento igual, porque cierra un hueco real —el hook es local a esta maquina y no
corre en CI— y se midio con M2b. Queda dicho que es una decision del implementador, no un pedido
escrito de la spec.

## GATES — 5/5 VERDES sobre el arbol final

```
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use     # v24.20.0
```

| Gate | Resultado |
|---|---|
| `pnpm run typecheck` | 0 |
| `pnpm run lint` | 0 |
| `pnpm run format:check` | 0 (con `tools/context-budget.test.ts` ya formateado) |
| `pnpm run test` | **183 archivos / 1298 tests / 0 failed** (986 passed + 312 skipped de integracion) — eran 182/1295 antes de esta spec |
| `pnpm exec turbo run build --force` | 3/3 successful, **`Cached: 0 cached`** (la corrida con cache daba FULL TURBO y no probaba nada) |

## LO QUE FALTA PARA CERRAR LA 0066

- [ ] **PASS de un revisor independiente.** Segun `docs/AGENT-WORKFLOW.md` la spec no se marca
      `implementada` sin el. El foco que pide la propia spec: **que ninguna regla se haya perdido en
      la mudanza, y que los dos guards nuevos muerdan de verdad**. Presupuesto sugerido para ese
      encargo: **3 mutaciones**, clase de error PLAUSIBLE.
- [ ] **Verificacion manual del owner**, en sesion nueva: correr `/context` y confirmar que
      `CLAUDE.md` carga y pesa menos; y despachar un encargo SIN presupuesto al agente `revisor`
      para confirmar que el presupuesto viaja solo.
- [ ] Marcar la spec `implementada` y actualizar su fila en `docs/INDEX.md`, recien despues del PASS.

## DESPUES DE LA 0066: EL ARCO DE ALTA DEL COMERCIO (ADR 0070)

**No se arranca hasta que la 0066 este cerrada** — decision del ADR 0069 y del owner.

**Decidido y bajado a disco (no repreguntar):** ADR 0070 — wizard de 3 pantallas, sin plan, sin
contraseña, staff por handle+PIN, sello placeholder, categoria `gcid`, entitlements en una capa, DB
desde cero. La UI la trabaja el owner por fuera (con ChatGPT); esta capa entrega endpoints. **La
spec del wizard todavia NO existe.**

**NO decidido** — los 4 hallazgos abiertos al final del ADR 0070: que bloquea la falta de
verificacion del email, las reglas del slug, la defensa del PIN, y el pais fuera de la lista. Se
resuelven al escribir la spec del wizard.

## ESTADO DEL ARBOL (bloque reescrito ENTERO el 2026-09-16)

- **Rama `main`, arbol limpio.** Todo lo de esta sesion entro en un solo commit (el anterior era
  `c654f93`, los ADRs 0069/0070 + la spec 0066). **No esta pusheado.**
- **No se toco una sola linea de `apps/`.** Sin mutaciones puestas. Sin migraciones pendientes.
- Archivos nuevos: `docs/LECCIONES.md`, `docs/PARQUEADO.md`, `docs/archivo/*` (2 nuevos + 8 movidos),
  `.claude/skills/{protocolo-de-verificacion,gotchas-del-repo}/SKILL.md`,
  `.claude/agents/{implementador,revisor}.md`, `.claude/hooks/claude-md-size.sh`,
  `tools/claude-md-coverage.sh`, `tools/worktree-new.sh`, `tools/context-budget.test.ts`.
  Modificados: `CLAUDE.md`, `docs/TASKS.md`, `docs/INDEX.md`, `.claude/settings.json`.
- La spec 0065 esta **cerrada** (implementada, revisada, corregida, pusheada, QA del owner en verde).
  Su deuda declarada esta en `docs/PARQUEADO.md`.
