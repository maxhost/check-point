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

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

# Proyecto todavia sin scaffold: no bloquear.
[ -f package.json ] || exit 0

fail=0
out=""

have_script() { node -e "process.exit(require('./package.json').scripts?.['$1']?0:1)" 2>/dev/null; }

if have_script typecheck; then
  if ! r=$(npm run --silent typecheck 2>&1); then
    out+=$'\n=== typecheck FALLA ===\n'"$(printf '%s' "$r" | tail -30)"
    fail=1
  fi
fi

if have_script lint; then
  if ! r=$(npm run --silent lint 2>&1); then
    out+=$'\n=== lint FALLA ===\n'"$(printf '%s' "$r" | tail -20)"
    fail=1
  fi
fi

if have_script test; then
  if ! r=$(npm run --silent test 2>&1); then
    out+=$'\n=== tests FALLAN ===\n'"$(printf '%s' "$r" | tail -30)"
    fail=1
  fi
fi

if [ "$fail" -ne 0 ]; then
  printf 'No podes terminar el turno todavia.%s\n' "$out" >&2
  printf '\nArreglalo. No edites ni borres tests para que pasen.\n' >&2
  exit 2
fi

exit 0
