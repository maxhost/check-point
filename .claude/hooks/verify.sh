#!/usr/bin/env bash
# Stop hook — corre cuando el agente quiere terminar su turno.
# exit 2 bloquea el fin del turno y manda stderr de vuelta al agente.
#
# Por que Stop y no PostToolUse: PostToolUse ya no puede deshacer la escritura,
# solo comenta. Stop es el unico punto donde "no terminas hasta que esto pase"
# es cierto. PreToolUse es el unico veto real, pero es por-llamada, no por-turno.
#
# Este hook es el harness: corre fuera de la ventana de contexto, cuesta cero
# tokens, y el agente no puede ignorarlo. Todo lo que se pueda chequear con un
# comando va aca, no en CLAUDE.md.
#
# PROPORCIONAL (spec 0151): antes corria typecheck+lint+test (~91 s medidos) al final de CADA
# respuesta, hubiera o no cambios. Ahora calcula una HUELLA de los cambios de codigo
# (`git diff HEAD` sin `docs/` + el contenido de los no trackeados bajo apps/, packages/,
# tools/) y si es igual a la del ultimo verde sale 0 sin correr nada. La huella se guarda
# SOLO si los tres gates dieron verde: un rojo nunca queda "aprobado" por la corrida
# siguiente. Vive dentro de `.git` (`git rev-parse --git-path`), asi que git la ignora y
# cada worktree tiene la suya. Para forzar los gates: borrar ese archivo.
#
# LIMITE DECLARADO: la huella no incluye HEAD. Un `pull`/`merge` que trae codigo ajeno con
# el arbol limpio da la misma huella (diff vacio) y no re-corre: eso lo cubren el
# `pre-push` y `pnpm ci:status`.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

# Proyecto todavia sin scaffold: no bloquear.
[ -f package.json ] || exit 0

code_fingerprint() {
  {
    git diff HEAD --binary -- . ':(exclude)docs' 2>/dev/null
    printf '\n--untracked--\n'
    while IFS= read -r -d '' f; do
      printf '%s %s\n' "$(git hash-object -- "$f" 2>/dev/null)" "$f"
    done < <(git ls-files --others --exclude-standard -z -- apps packages tools 2>/dev/null)
  } | shasum | cut -d' ' -f1
}

GREEN_FILE=$(git rev-parse --git-path verify-last-green 2>/dev/null) || GREEN_FILE=""
fp=$(code_fingerprint)
if [ -n "$GREEN_FILE" ] && [ -f "$GREEN_FILE" ] && [ "$(cat "$GREEN_FILE")" = "$fp" ]; then
  exit 0
fi

# Spec 0064 §4.b — ANTES DE CUALQUIER GATE. `stale-validator.sh` borra
# `apps/merchant/.next/types/validator.ts` cuando quedo referenciando una ruta que ya no
# existe; si corriera DESPUES, el `typecheck` de abajo ya habria fallado con un
# "Cannot find module .../route.js" que apunta a un archivo borrado a proposito, y el turno
# quedaria bloqueado por un error que no es un error.
#
# VA ACA Y NO COMO ENTRADA SUELTA DEL ARRAY `Stop` de settings.json porque asi el orden esta
# garantizado POR CONSTRUCCION (mismo proceso, secuencial) en vez de depender de que el
# runner respete el orden del array — algo que no se puede medir desde adentro de un turno,
# porque el evento `Stop` dispara despues del ultimo mensaje. Ademas evita la carrera de dos
# hooks en paralelo, uno borrando el validator mientras el otro corre `tsc` sobre el.
# Su salida (cuando borra) va a stderr y llega igual al agente.
_sv="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/stale-validator.sh"
[ -x "$_sv" ] && bash "$_sv"

# El shell del hook arranca en el Node del SISTEMA (22), no en el que pide el
# repo (.node-version, hoy 24). Correr los gates en otro runtime que el de CI y
# produccion es verificar otra cosa: el verde de aca no dice nada del verde de
# alla. Lo destapo el guard de pines de la spec 0049, que fallo justamente aca
# con "expected '22' to be '24'" — el hook llevaba corriendo en 22 sin que nadie
# lo notara.
#
# Si nvm no esta, o la version pedida no esta instalada, NO se silencia: se
# sigue con el Node que haya y el guard de pines falla, que es la señal correcta.
if [ -s .node-version ]; then
  _nvm="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [ -s "$_nvm" ]; then
    set +u
    # shellcheck disable=SC1090
    . "$_nvm" >/dev/null 2>&1
    nvm use "$(cat .node-version)" >/dev/null 2>&1
    set -u
  fi
fi

fail=0
out=""

have_script() { node -e "process.exit(require('./package.json').scripts?.['$1']?0:1)" 2>/dev/null; }

if have_script typecheck; then
  if ! r=$(pnpm run --silent typecheck 2>&1); then
    out+=$'\n=== typecheck FALLA ===\n'"$(printf '%s' "$r" | tail -30)"
    fail=1
  fi
fi

if have_script lint; then
  if ! r=$(pnpm run --silent lint 2>&1); then
    out+=$'\n=== lint FALLA ===\n'"$(printf '%s' "$r" | tail -20)"
    fail=1
  fi
fi

if have_script test; then
  if ! r=$(pnpm run --silent test 2>&1); then
    out+=$'\n=== tests FALLAN ===\n'"$(printf '%s' "$r" | tail -30)"
    fail=1
  fi
fi

if [ "$fail" -ne 0 ]; then
  printf 'No podes terminar el turno todavia.%s\n' "$out" >&2
  printf '\nArreglalo. No edites ni borres tests para que pasen.\n' >&2
  exit 2
fi

# Solo un verde completo deja la huella (spec 0151).
[ -n "$GREEN_FILE" ] && printf '%s\n' "$fp" > "$GREEN_FILE"
exit 0
