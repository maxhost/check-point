#!/usr/bin/env bash
# Stop — bloquea el fin del turno si tocaste codigo y TASKS.md quedo viejo.
#
# "Acordate de actualizar TASKS.md" como frase en CLAUDE.md es advisory, y las
# reglas advisory se pierden por mecanica de contexto (compactacion, subagentes).
# Una regla que se puede chequear con un comando no va en prosa: va aca.
#
# La lista de tareas es el punto de retorno cuando la sesion se cae o se cierra.
# Una lista desactualizada es peor que no tenerla: da falsa confianza sobre el
# estado real.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

# Sin el dir de codigo todavia: nada que rastrear.
[ -d src ] || exit 0

touched=$(git status --porcelain -- src 2>/dev/null | head -1)
[ -n "$touched" ] || exit 0

if [ ! -f docs/TASKS.md ]; then
  echo "Tocaste src/ y no existe docs/TASKS.md. Creala con el estado actual antes de terminar." >&2
  exit 2
fi

newer=$(find src -newer docs/TASKS.md -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | head -5)
if [ -n "$newer" ]; then
  {
    echo "docs/TASKS.md quedo mas viejo que el codigo que tocaste:"
    printf '  %s\n' $newer
    echo
    echo "Actualizala antes de terminar: que quedo hecho, que esta a medias, que sigue."
    echo "Es el punto de retorno si esta sesion se cae. Un turno que termina sin"
    echo "actualizarla deja el estado solo en el chat, y el chat se compacta."
  } >&2
  exit 2
fi
exit 0
