#!/usr/bin/env bash
# PreToolUse(Bash): bloquea un `git commit` cuando el index YA tiene archivos staged que el
# comando no nombra.
#
# POR QUE EXISTE (2026-09-27, LECCIONES.md): otro agente (GPT) trabajaba sobre el MISMO working
# tree y dejo 66 archivos de UI en el index con `git add`. El orquestador corrio
# `git add docs/TASKS.md && git commit -m "docs: …"`, que commitea el index ENTERO: la UI ajena
# entro a `f61b163` con un mensaje de docs y se pusheo. `git add X && git commit` no significa
# «commitea X».
#
# QUE MIRA: el index ANTES de que corra el comando. Lo que el propio comando agrega todavia no
# esta staged, asi que todo lo que ya este ahi lo puso otra mano (u otro turno). Si alguno de
# esos paths no aparece en el texto del comando, bloquea y los lista. La salida es nombrarlos:
# `git commit -- <paths>` (commitea solo esos) o agregarlos a proposito en el mismo comando.
#
# FALLA CERRADO: sin python3 no puede leer el JSON del tool y sale 2 con el motivo, en vez de
# dejar pasar sin mirar (el caso de `file-size.sh` sin node, TASKS 2026-09-27).

set -uo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo "foreign-staged.sh: python3 no esta en el PATH; no puedo revisar el commit." >&2
  exit 2
fi

input="$(cat)"
command="$(printf '%s' "$input" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("command", ""))
except Exception:
    print("__UNPARSEABLE__")')"

if [ "$command" = "__UNPARSEABLE__" ]; then
  echo "foreign-staged.sh: no pude leer el comando del tool." >&2
  exit 2
fi

case "$command" in
  *"git commit"* | *"git -c "*" commit"*) ;;
  *) exit 0 ;;
esac

# El index que importa es el de la carpeta donde corre el commit (un worktree tiene el suyo):
# el primer `cd <dir>` del comando, si no el `cwd` del tool, si no el proyecto.
dir="$(printf '%s' "$input" | python3 -c 'import json,re,shlex,sys
d = json.load(sys.stdin)
m = re.match(r"\s*cd\s+(\S+)", d.get("tool_input", {}).get("command", ""))
print(shlex.split(m.group(1))[0] if m else d.get("cwd", ""))')"
cd "${dir:-${CLAUDE_PROJECT_DIR:-.}}" 2>/dev/null || cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

foreign=()
while IFS= read -r path; do
  [ -z "$path" ] && continue
  case "$command" in
    *"$path"*) ;;
    *) foreign+=("$path") ;;
  esac
done < <(git diff --cached --name-only)

[ "${#foreign[@]}" -eq 0 ] && exit 0

{
  echo "BLOQUEADO: el index ya tiene ${#foreign[@]} archivo(s) staged que este commit no nombra."
  echo "\`git commit\` commitea el index ENTERO, no lo que agregaste en el mismo comando."
  echo "Probablemente son de otro agente trabajando en este arbol. Staged ajenos:"
  printf '  %s\n' "${foreign[@]:0:20}"
  [ "${#foreign[@]}" -gt 20 ] && echo "  … y $(( ${#foreign[@]} - 20 )) mas"
  echo "Commitea solo lo tuyo con: git commit -- <tus paths>   (o nombralos a proposito)."
} >&2
exit 2
