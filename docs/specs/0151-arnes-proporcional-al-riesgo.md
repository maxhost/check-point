---
spec: 0151
fecha: 2026-10-04
estado: cerrada
resumen: Arnes proporcional al riesgo (informe «Flujo ágil con Claude Code»). Niveles N0/N1/N2 en CLAUDE.md y poda a ≤100 lineas (lo demas va a skills/LECCIONES), Stop hook que no re-corre gates sin cambios de codigo, arranque sin leer INDEX ni TASKS enteros, subagentes solo en N2.
disjunta: si
archivos: CLAUDE.md, .claude/hooks/{verify,tasks-fresh}.sh, .claude/settings.json, .claude/agents/{implementador,revisor}.md, .claude/skills/{protocolo-de-verificacion,gotchas-del-repo}/SKILL.md, docs/AGENT-WORKFLOW.md, docs/estado/claude.md, docs/LECCIONES.md
---

# 0151 — Arnes proporcional al riesgo

## Problema (medido el 2026-10-04)

- **Stop hook:** `.claude/hooks/verify.sh:59-80` corre `npm run typecheck`, `lint` y `test` al final de CADA respuesta,
  haya o no cambios. Medido corriendo los mismos comandos: typecheck 1 s (cache de turbo), lint 12 s, test 78 s →
  **~91 s por respuesta**. Usa `npm` en un repo `pnpm`.
- **Arranque:** `CLAUDE.md` manda «Empeza aca» en `docs/INDEX.md` (~57,7k tokens, `wc -c`/4) y leer `docs/estado/claude.md`
  (~5,5k, casi todo bloques historicos). `.claude/agents/implementador.md:20` manda leer `docs/TASKS.md` (~163k tokens) y
  `:49` escribe ahi la bitacora.
- **Sin camino corto:** `CLAUDE.md` §Flujo exige spec + implementador + revisor para todo cambio. La guia de Anthropic
  dice lo contrario para cambios chicos: «If you could describe the diff in one sentence, skip the plan»
  (code.claude.com/docs/en/best-practices) y quedarse en la conversacion principal para «un cambio rapido y dirigido»
  (docs de subagentes). Caso: 3 botones de login, ~10 min.
- **`tasks-fresh.sh`** bloquea el fin de turno si el codigo es mas nuevo que el estado: cada turno con codigo fuerza un
  commit `docs: estado` (46 de los ultimos 300 commits).
- `CLAUDE.md`: 199 lineas / ~14,3 KB (el hook corta en 200), con casos historicos, cifras sin fuente («0% / ~50%» de
  reward hacking) y numeros vencidos («105 suites»; hoy 168).

**Fuera por medicion:** el informe proponia que `neon-test.sh` migre solo si cambian las migraciones. Medido: migrar +
arrancar vitest = **4 s** por corrida. No compensa; no se hace.

## Alcance

**Entra:** C1–C4 de abajo. **No entra:** Postgres local para tests (proyecto aparte, con medicion antes/despues); tocar
codigo de producto; cambiar `pnpm verify` ni el `pre-push`.

## Diseño

**C1 — Niveles en `CLAUDE.md`** (reemplaza §Flujo pasos 2 y 7):

| Nivel | Cuando | Como |
|---|---|---|
| **N0 directo** | el diff se describe en una oracion, sin esquema/SQL nuevo, sin auth/dinero | en la conversacion principal, sin spec ni subagentes; typecheck + lint + tests del archivo; commit |
| **N1 rebanada** | un endpoint o un cambio de servidor acotado | spec CHICA = contrato HTTP para GPT + su test negativo; sin subagentes; `pnpm verify`; push en el dia |
| **N2 completo** | dinero, auth/sesiones, aislamiento entre comercios, migraciones, DTOs con datos internos | flujo actual: spec, UN implementador, UN revisor (acotado a correctitud + 1–3 mutaciones sobre lineas cambiadas) |

Si dudas entre dos niveles, el mas alto. Una feature grande se parte en rebanadas N1 pusheables solas.

**Poda de `CLAUDE.md` a ≤100 lineas y ≤6 KB.** Nada se pierde: cada bloque va a su lugar.

| Bloque actual | Destino |
|---|---|
| Cabecera, mapa de docs, «donde va cada cosa» | queda, corto. INDEX: «buscalo con `rg`, no lo leas entero» |
| §Flujo 1 (estado + `ci:status`), 3 (ADR), 4 (fila INDEX), 6 (`hecho` solo con verificacion) | quedan, una linea cada uno |
| §Flujo 2 y 7 | reemplazados por C1 |
| §Flujo 5 (estado en dos commits) | queda para N1/N2; en N0 el estado se actualiza al cerrar la sesion |
| §Estado (archivo > chat, handoff + `/clear`, nunca compact) | queda (decision del owner) |
| §Verificacion: regla madre, imposibilidad/costo se intentan, hallazgos de subagentes se reproducen | queda, 3 lineas |
| §Verificacion: mecanismo medido hasta el final, ejemplo de invariante, tabla de mutaciones, etiqueta MUTATION, presupuesto y corte | a la skill `protocolo-de-verificacion` (ya tiene casi todo; se agrega lo que falte) |
| No esperar CI + deploy `READY` antes del QA; lo que el owner no dijo / ya dijo; `.env` sin valores | quedan, condensados |
| «Las reglas verificables van en hooks», cifra «0% / ~50%» sin fuente | se cortan |
| §Codigo: `file-size` (lo dice el hook), arco del alta «UI la hace el owner» (vencido: hoy GPT, ADR 0114) | se cortan; queda una linea de zonas (ADR 0114) |
| §Codigo: UI vieja se borra, no editar tests, nada de andamiaje, sin `*ObjectKey` al navegador | quedan, una linea cada una |
| §Gotchas: Node 24 (`nvm use`), Neon nunca contra `DATABASE_URL` | quedan, una linea cada uno |
| §Gotchas: `pnpm verify` detalle, suites Neon, scripts de root, zsh, `pnpm install` offline, worktrees, `git push`/`GH_TOKEN` | a la skill `gotchas-del-repo` (lo que no este ya) |

Los casos con fecha siguen en `docs/LECCIONES.md` (no se leen al arrancar). Se agrega ahi el caso de esta spec.

**C2 — Stop hooks proporcionales.**
- `verify.sh`: calcula una huella de los cambios de codigo (`git diff HEAD` + archivos no trackeados bajo `apps/`,
  `packages/`, `tools/`, sin `docs/`), la compara con la del ultimo verde (archivo ignorado por git) y **si es igual sale 0
  sin correr nada**. Si cambio: typecheck + lint + test como hoy, con `pnpm` (y el allow-list de permisos a `pnpm`).
  Guarda la huella solo si todo dio verde.
- `tasks-fresh.sh`: pasa a **aviso** (stdout, exit 0), no bloquea. El estado se escribe al cerrar la sesion (`handoff`).

**C3 — Arranque liviano.**
- `CLAUDE.md`: leer solo el bloque `⇥ ESTADO` de arriba de `docs/estado/claude.md`; INDEX se consulta con `rg`.
- `docs/estado/claude.md`: los bloques `ESTADO HISTORICO` se mueven a `docs/estado/claude-historico.md` (no se lee).
- `implementador.md` / `revisor.md`: sin `docs/TASKS.md`; leen la spec y lo que ella enlace; la bitacora va al handoff
  (y a un archivo del scratchpad si es larga).

**C4 — Subagentes solo en N2.** `CLAUDE.md` (C1), `docs/AGENT-WORKFLOW.md` y la `description` de `implementador` y
`revisor`: «solo para specs N2».

## Definition of Done

- [ ] `wc -l CLAUDE.md` ≤ 100 y `wc -c` ≤ 6144; `claude-md-size.sh` sale 0.
- [ ] Tabla de destinos cumplida: por cada bloque «a la skill X», `rg` encuentra la regla en X.
- [ ] `verify.sh`: corrido dos veces seguidas sin cambios → la segunda sale 0 en < 3 s sin correr gates; tocar un `.ts` →
      corre los gates; un `.ts` con error de tipos → exit 2.
- [ ] `tasks-fresh.sh` con codigo mas nuevo que el estado → exit 0 con el aviso.
- [ ] `rg -n "TASKS" .claude/agents/` → vacio. `rg -n "Empeza aca" CLAUDE.md` → vacio.
- [ ] `docs/estado/claude.md` ≤ 60 lineas; el historico intacto en `claude-historico.md` (mismas lineas, `diff`).

## Mutaciones — presupuesto: 2. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `verify.sh` guarda la huella aunque un gate falle | DoD: tras un rojo, la corrida siguiente sin cambios tiene que volver a correr y dar exit 2 |
| 2 | la huella ignora los archivos no trackeados | DoD: crear un `.ts` nuevo con error → exit 2 |

## Declarado AFUERA

- Si los niveles quedan bien trazados se valida con el uso; el dato pendiente es en cuantas specs el revisor cazo algo
  que los gates no (informe, §Falta medir).

## Handoff

N2 por tocar el arnes: implementa el orquestador (Claude) y UN revisor independiente verifica la DoD y las 2 mutaciones,
y que ninguna regla de `CLAUDE.md` se perdio sin destino. Decision del owner (2026-10-04): «arma un spec para aplicar los
5 primeros cambios. luego si necesitamos usar un agente para que compruebes esto de forma independiente».

## Abierto

Nada.
