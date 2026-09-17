---
spec: 0066
fecha: 2026-09-16
estado: implementada
resumen: Repara el harness antes del arco de alta (ADR 0069): poda `CLAUDE.md` de 696 a <=200 lineas mudando —no borrando— las lecciones a skills y a `docs/LECCIONES.md`; deja en `docs/TASKS.md` solo lo que esta en ejecucion y manda lo parqueado y los encargos de fases cerradas a `docs/archivo/`; define `.claude/agents/` con el protocolo de mutaciones y el presupuesto de verificacion adentro; y hace los worktrees usables instalando su `node_modules` propio 100% offline desde el `.pnpm-store` del repo.
disjunta: si
archivos: CLAUDE.md, docs/LECCIONES.md, docs/TASKS.md, docs/archivo/*, .claude/skills/*, .claude/agents/*, tools/worktree-new.sh, tools/context-budget.test.ts
---

# 0066 — Reparacion del harness

## Problema

Medido el 2026-09-16, con los comandos transcriptos:

- `wc -l -c CLAUDE.md` → **696 lineas, 60.953 bytes**. Se carga entero en **cada** request.
- `wc -l -c docs/TASKS.md` → **7.197 lineas, 712.293 bytes**. Es «el punto de retorno» que
  una sesion fresca lee primero, y su cabecera ya quedo mintiendo **dos veces** (documentado
  en el propio archivo y en `CLAUDE.md`).
- `ls .claude/agents/` → **no existe**. Cada encargo a un implementador o a un revisor
  reescribe a mano el protocolo de mutaciones, y basta un renglon olvidado para que aparezca
  una mutacion abandonada — que es indistinguible de un bug real.
- `ls docs/` → **~10 archivos de encargos y revisiones de fases ya cerradas**
  (`encargo-fase-d2.md`, `revision-fase-a-0064.md`, `barrido-d1-fase-d1.md`, …) mezclados
  con los documentos vivos.
- Los worktrees estan documentados como trampa: `pnpm run`/`pnpm exec` adentro de uno
  intentan purgar el `node_modules` symlinkeado. Paso dos veces (spec 0053).

El efecto compuesto esta cuantificado en el ADR 0069: la cola de revisiones de la spec 0065
corrio cuatro revisores, produjo 14 hallazgos y **uno solo** cambio codigo de produccion.

## Alcance

**Entra:**

1. Poda de `CLAUDE.md` a **<= 200 lineas**, mudando todo lo demas sin perder una linea.
2. Reorganizacion de `docs/TASKS.md` (solo lo que esta en ejecucion) y de `docs/`.
3. `.claude/agents/` con `implementador` y `revisor`.
4. Worktrees usables: `node_modules` propio, instalado offline.
5. Un guard que impida que `CLAUDE.md` vuelva a crecer.

**No entra** (explicito, para que no se lo coma el scope creep):

- Tocar los 10 hooks existentes salvo el agregado del punto 5. Son la parte que funciona.
- Cualquier cosa del arco de alta: wizard, entitlements, identidad, sello. Eso es el ADR
  0070 y su spec, que todavia no existe.
- Paralelizar por slices y el patron oraculo-primero. Se habilitan con esto, pero son
  practica de uso, no archivos que esta spec cree.

## Diseño

### 1. La poda: tres destinos, ninguno es «borrar»

El criterio de corte es el de la documentacion oficial: *«¿quitar esta linea haria que
Claude cometa un error?»*. Aplicado a este repo, cada linea de `CLAUDE.md` cae en uno de
cuatro destinos:

| Destino | Que va | Por que |
|---|---|---|
| **Queda en `CLAUDE.md`** | comandos que no se pueden inferir (los gates, `nvm use`, scripts de root), el flujo de trabajo, y las gotchas de entorno que **rompen el turno en curso** (zsh sin comillas, `pnpm` bajo sandbox, Node 24) | cambia una decision en **toda** sesion |
| **`.claude/skills/`** | el protocolo de verificacion (mutaciones, presupuesto, oraculos, limites declarados) y las gotchas por dominio (drizzle, Stripe, Vercel, Neon, wallet) | **la doc oficial lo dice literal**: lo que solo hace falta a veces va en una skill, que se carga on demand y no infla cada conversacion |
| **`docs/LECCIONES.md`** | el registro historico completo de mistake→rule, con su caso y su fecha | es memoria del proyecto, no instruccion operativa |
| **Un hook** | lo que se pueda chequear con un comando | ya es la regla de la casa: *«las reglas verificables van en hooks, no aca»* |

**Trampa que hay que evitar, y es la que arruinaria el ejercicio entero:** `CLAUDE.md`
soporta `@path/to/import`, y un archivo importado asi **se carga igual que si estuviera
pegado**. `docs/LECCIONES.md` se referencia **como texto plano** («cuando pase X, leé
`docs/LECCIONES.md`»), nunca con `@`. Si se importa, la poda no ahorra un solo token.

### 2. `docs/TASKS.md`: solo lo que esta en ejecucion

Decision del owner: *«en TASKS.md solo vive lo que se esta por trabajar»*.

- **`docs/TASKS.md`** → el arco en curso y nada mas. Arranca con el bloque `ESTADO`
  reescrito entero contra los hechos del momento, como ya exige la regla de la casa.
- **`docs/PARQUEADO.md`** → lo diferido, parado o pospuesto, una fila por item con su origen
  (spec/ADR) y por que se paro. Es el unico lugar donde buscar pendientes.
- **`docs/archivo/`** → los encargos, revisiones y barridos de fases ya cerradas que hoy
  estan sueltos en `docs/`. Se **mueven con `git mv`**, no se borran.

`docs/INDEX.md` gana una fila para `PARQUEADO.md` y otra para `archivo/`.

### 3. `.claude/agents/`

Dos definiciones, cada una con frontmatter (`name`, `description`, `tools`, `model`) y el
protocolo del repo adentro:

- **`implementador.md`** — implementa una spec cerrada. Lleva escrito: registrar el `shasum`
  **antes** de mutar; `git status --short` para saber si el archivo es `??` (ahi
  `git checkout` no existe como salvavidas y hay que copiar a `/tmp`); abrir la fila de la
  bitacora **antes** de medir, no despues; etiquetar toda mutacion con `MUTATION`; revertir
  con `diff` contra la copia limpia.
- **`revisor.md`** — revisa contra la spec en contexto fresco. Lleva escrito **el
  presupuesto y la condicion de corte como parte del encargo**: cuantas mutaciones y que
  clase de error tiene que cazar; lo que quede afuera se **declara**; un hallazgo que no es
  riesgo de produccion se declara y se sigue, no se persigue.

Esto es el ADR 0062 y la instruccion del owner del 2026-09-13 convertidos en configuracion:
**el corte deja de depender de que el orquestador se acuerde de escribirlo**.

### 4. Worktrees usables

`tools/worktree-new.sh <nombre>`:

1. `git worktree add` de la rama nueva.
2. Copia/enlaza `.pnpm-store` (ya vive dentro del repo desde la spec 0035).
3. `pnpm install --offline` **dentro del worktree**, con su `node_modules` propio.
4. Verifica que `pnpm run typecheck` corre ahi **sin** tocar el `node_modules` del repo
   principal.

El punto 4 no es cosmetico: es lo que convierte la muerte de un agente en un problema de su
worktree y no del arbol de todos.

### 5. El guard de tamaño

Un hook que falla si `CLAUDE.md` supera las 200 lineas. **Y como manda la casa: un guard sin
prueba de que MUERDE es peor que ninguno** — se verifica corriendo contra un estado que
debe bloquear y leyendo el `exit 2` **y** el mensaje, no solo que salga 0 cuando todo esta bien.

## Archivos

| Archivo | Accion |
|---|---|
| `CLAUDE.md` | editar (696 → <=200 lineas) |
| `docs/LECCIONES.md` | crear |
| `docs/PARQUEADO.md` | crear |
| `docs/archivo/` | crear + `git mv` de los encargos/revisiones de fases cerradas |
| `docs/TASKS.md` | editar (queda solo el arco en ejecucion) |
| `docs/INDEX.md` | editar (filas nuevas) |
| `.claude/skills/protocolo-de-verificacion/SKILL.md` | crear |
| `.claude/skills/gotchas-del-repo/SKILL.md` | crear |
| `.claude/agents/implementador.md` | crear |
| `.claude/agents/revisor.md` | crear |
| `.claude/hooks/claude-md-size.sh` | crear |
| `.claude/settings.json` | editar (registrar el hook) |
| `tools/worktree-new.sh` | crear |

### Disjunta?

**Si.** No comparte un solo archivo con codigo de `apps/`. Puede correr entera sin tocar el
producto — de hecho, ese es el punto.

## Definition of Done

- [ ] `wc -l CLAUDE.md` <= **200**.
- [ ] **Ninguna linea se perdio**: un script demuestra que cada regla que salio de
      `CLAUDE.md` aparece en una skill o en `docs/LECCIONES.md`. La evidencia es la salida
      del script, no una lectura.
- [ ] `CLAUDE.md` **no** usa `@` para importar `LECCIONES.md` — verificado por `grep`.
- [ ] `docs/TASKS.md` contiene **solo** el arco en ejecucion, y su bloque `ESTADO` esta
      reescrito entero contra los hechos del dia.
- [ ] `docs/PARQUEADO.md` existe y contiene **todo** lo diferido que hoy vive en `TASKS.md`,
      incluida la deuda declarada de la spec 0065.
- [ ] Los encargos y revisiones de fases cerradas estan en `docs/archivo/`, movidos con
      `git mv` (el historial se conserva).
- [ ] `.claude/agents/implementador.md` y `revisor.md` existen, y el de revisor **exige**
      presupuesto y condicion de corte.
- [ ] Un worktree nuevo creado con `tools/worktree-new.sh` corre `pnpm run typecheck` en
      verde **y** el `node_modules` del repo principal queda intacto (`shasum` de
      `node_modules/.modules.yaml` antes y despues).
- [ ] El hook de tamaño **muerde**: exit 2 + mensaje con un `CLAUDE.md` de 201 lineas, y
      exit 0 con uno de 200.
- [ ] Los 5 gates en verde sobre el arbol final.

## Plan de pruebas y verificación

- [ ] **Guard de tamaño, las dos direcciones.** Un archivo de 201 lineas → `exit 2` y el
      mensaje nombra el limite. Uno de 200 → `exit 0`. Sin el caso que bloquea, el hook
      podria estar saliendo 0 por no mirar nada — que es la leccion de `tasks-fresh.sh`.
- [ ] **No se perdio nada.** El script de cobertura corre sobre el `CLAUDE.md` viejo
      (`git show HEAD:CLAUDE.md`) y el nuevo + los destinos. Se prueba que **detecta** una
      perdida: se borra a proposito una regla de la skill y el script tiene que ponerse rojo.
      Sin esa mutacion el script no prueba nada.
- [ ] **Worktree.** Crear uno, correr `pnpm run typecheck`, y aseverar por `shasum` que
      `node_modules/.modules.yaml` del repo principal no cambio. **Este es el DoD que mas
      importa** y el unico que no se puede declarar sin ejecutarlo.
- [ ] **Comandos exactos:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use` y
      despues `pnpm run typecheck && pnpm run lint && pnpm run test`.
- [ ] **Verificacion manual:** abrir una sesion nueva, correr `/context` y confirmar que
      `CLAUDE.md` carga y pesa menos; despachar un encargo de prueba al agente `revisor` y
      confirmar que el presupuesto viaja sin que el orquestador lo escriba.

**Presupuesto de verificacion de esta spec** (se declara aca, que es justamente lo que la
spec instaura): **tres mutaciones**, una por guard nuevo — el hook de tamaño, el script de
cobertura y el aislamiento del worktree. La clase de error a cazar son **los plausibles**:
un guard que sale 0 sin mirar nada, y una regla que desaparecio en la mudanza. Lo que quede
afuera se declara, no se persigue.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. Como esta spec **no toca codigo de producto**, el PASS
del revisor se concentra en dos cosas: que ninguna regla se haya perdido en la mudanza, y
que los dos guards nuevos muerdan de verdad.

## Abierto

Nada que bloquee. Dos cosas a resolver durante la implementacion, ninguna de las cuales
cambia el alcance:

- El corte exacto de que gotcha es «rompe el turno en curso» (queda en `CLAUDE.md`) y cual
  es «por dominio» (va a skill). Ante la duda, queda en `CLAUDE.md`: el costo de dejar una
  linea de mas es menor que el de perder una que evita un error.
- Si `.pnpm-store` se copia o se enlaza en cada worktree. Lo decide la medicion de espacio
  al hacerlo.
