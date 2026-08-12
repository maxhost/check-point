# CLAUDE.md

> Instalado por GlaDOS (plantilla del arnes v1). Es tuyo: editalo con el uso —
> cada error observado del agente deberia volverse una linea aca o un hook (mistake→rule).

Directrices del proyecto. Se cargan siempre y cuestan tokens en cada request — aca va
solo lo que cambia una decision. Lo derivable del codigo no va: leelo del arbol.

- **`docs/INDEX.md`** — mapa de ADRs y specs. **Empeza aca**, no leas todo.
- **`docs/TASKS.md`** — estado actual. El punto de retorno si esta sesion se cae.
- `.claude/settings.json` — lo que esta enforced (hooks + permisos).

## Flujo de trabajo

1. **Leer `docs/TASKS.md` antes de empezar.** Es el estado real, no lo que diga el chat.
2. **Ninguna tarea toca codigo sin su spec cerrada** (`docs/specs/`, plantilla en
   `TEMPLATE.md`). La subespecificacion es el gatillo medido del exito fingido: en tareas
   resolubles y bien definidas el reward hacking cae a 0%; en tareas vagas, ~50%.
3. **Toda decision de diseño genera un ADR** (`docs/adr/`) con fecha y `resumen` de una
   linea en el frontmatter. El resumen es lo que se lee sin abrir el archivo.
4. **Agregar la fila a `docs/INDEX.md` en el mismo commit.** Un indice viejo es peor que
   ninguno.
5. **Actualizar `docs/TASKS.md` al terminar.** Hay un hook `Stop` que lo exige si quedo
   viejo respecto del codigo tocado.
6. **Marcar `hecho` solo con verificacion real** — test que pasa, comando corrido, cosa
   vista en pantalla. Nunca "deberia andar".
7. **Implementar con el protocolo de `docs/AGENT-WORKFLOW.md`.** Una spec cerrada se
   entrega a implementador y después a revisor independiente; solo un PASS verificable
   permite marcarla como implementada.

## Estado

**Lo que tiene que sobrevivir va a un archivo, no a la conversacion.** La compactacion
borra lo que vive solo en el chat; el disco se re-lee. Un plan que es un mensaje no es
un plan.

**Handoff SIEMPRE seguido de `/clear`.** El handoff baja el estado a disco pero NO libera
la ventana de contexto. Orden sagrado: handoff PRIMERO (a disco), clear DESPUES. Nunca
compact: comprime con perdida.

## Verificacion

**Ninguna afirmacion de exito vale sin una señal que el modelo no genero** — tests,
typecheck, exit code. La auto-revision sin oraculo es negativa neta.

**Mistake→rule:** cada error observado del agente se convierte en un fix estructural
permanente — un hook si se chequea con un comando, una linea aca si es advisory. Nunca
la misma correccion dos veces a mano.

**Las reglas verificables van en hooks, no aca.** Los hooks corren fuera del contexto,
cuestan cero tokens y son deterministas; este archivo es advisory. Si una regla se puede
chequear con un comando, es un hook — no la escribas aca tambien.

## Codigo

- Si un archivo supera el limite de tamaño (hook `file-size`): dividir, no extender.
- No editar ni borrar tests para que el gate pase: un test rojo se arregla o se discute.
- Nada de andamiaje sin su tarea: codigo que no se usa hoy va con su fila en
  `docs/TASKS.md` que lo va a consumir, o se borra.

## Gotchas

- **`pnpm install`/`pnpm add` bajo codex + Auto fallan por DNS, aunque `git commit` ande
  (analogo al fix de GlaDOS ADR-0046/spec 0035, pero para paquetes en vez de `.git`).**
  Dos bloqueos independientes, apilados, NINGUNO es bug — son el sandbox
  `workspace-write` de codex haciendo lo que promete: (1) **red bloqueada por default**
  (el `approvalPolicy`/autoApprove NO da red — es otra dimension; GlaDOS ademas nunca
  concede la enmienda de red, ni en manual: MCP-only por diseño); (2) **el store global
  de pnpm** (`~/Library/pnpm/store`) **queda fuera del workdir writable** — mismo
  mecanismo que `.git/` fuera de `writable_roots`. Bajo Auto, codex no puede distinguir
  "sandbox lo bloqueo" de "internet caido": reporta el sintoma (DNS) y pide correrlo a
  mano en una terminal real.
  - **Fix: store de pnpm DENTRO del repo, pre-cargado.** `.pnpm-store` gitignored +
    `storeDir: .pnpm-store` en `pnpm-workspace.yaml`. **OJO: pnpm 11 lee `storeDir` de
    `pnpm-workspace.yaml`, NO de `.npmrc`** (`store-dir` en `.npmrc` se ignora en
    silencio — `pnpm config get store-dir` sigue devolviendo el global aunque el
    `.npmrc` este ahi; solo `pnpm-workspace.yaml` lo aplica, verificado con `pnpm store
    path`). Con el store adentro del workdir, `pnpm install --offline` no necesita red
    NI escritura fuera del sandbox — verificado end-to-end: `node_modules` borrado y
    reconstruido 100% offline (268 paquetes, `downloaded 0`) + `pnpm run typecheck`
    real, 3/3 paquetes verdes.
  - **Operatoria hacia adelante: cuando se agreguen dependencias nuevas, correr `pnpm
    fetch` (puebla el store DESDE el lockfile, sin tocar `node_modules`) en una terminal
    normal (con red) ANTES de la proxima sesion de codex bajo Auto.** Sin ese re-warm,
    el store local queda desactualizado y el offline install vuelve a fallar (con
    "paquete no encontrado", no DNS).
  - **`pnpm fetch` purga `node_modules` sin preguntar salvo `CI=true`** (falla con
    `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` sin TTY, p.ej. corrido por un agente).
