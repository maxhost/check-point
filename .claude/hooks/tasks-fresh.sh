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

# Donde vive el codigo. Este es un MONOREPO: `src/` NO existe en la raiz, vive en
# `apps/*/src`. La version original guardaba con `[ -d src ] || exit 0` y por eso
# salia en 0 SIEMPRE — el hook nunca bloqueo un turno en toda su vida. Un guard que
# no muerde es peor que ninguno: da la seguridad que no tiene (misma leccion que los
# tres guards rotos de la tarea 38). Se resuelve el glob en vez de asumir una ruta.
srcdirs=()
for d in src apps/*/src packages/*/src; do
  [ -d "$d" ] && srcdirs+=("$d")
done
[ ${#srcdirs[@]} -gt 0 ] || exit 0

# Lo que GIT reporta como cambiado. Antes esto miraba el mtime de TODO el arbol de
# src, y eso disparaba por archivos INTACTOS: un `git checkout -- <f>` que restaura
# un archivo le bumpea el mtime sin cambiar una linea, y el guard lo denunciaba
# igual. Un guard que acusa en falso entrena a ignorarlo, que es la otra forma de
# no servir para nada.
changed=$(git status --porcelain -- "${srcdirs[@]}" 2>/dev/null |
  sed -e 's/^...//' -e 's/.* -> //' -e 's/^"//' -e 's/"$//')
[ -n "$changed" ] || exit 0

if [ ! -f docs/TASKS.md ]; then
  echo "Tocaste codigo y no existe docs/TASKS.md. Creala con el estado actual antes de terminar." >&2
  exit 2
fi

# De lo cambiado, cuales son mas nuevos que TASKS.md. Un untracked puede venir como
# directorio (git lo colapsa), asi que se expande a archivos.
newer=""
while IFS= read -r entry; do
  [ -n "$entry" ] || continue
  if [ -d "$entry" ]; then
    while IFS= read -r f; do
      [ -n "$f" ] && [ "$f" -nt docs/TASKS.md ] && newer+="$f"$'\n'
    done < <(find "$entry" -type f \( -name '*.ts' -o -name '*.tsx' \) \
               -not -path '*/node_modules/*' 2>/dev/null)
  elif [ -f "$entry" ]; then
    case "$entry" in
      *.ts|*.tsx) [ "$entry" -nt docs/TASKS.md ] && newer+="$entry"$'\n' ;;
    esac
  fi
done <<< "$changed"

if [ -n "$newer" ]; then
  {
    echo "docs/TASKS.md quedo mas viejo que el codigo que tocaste:"
    printf '%s' "$newer" | head -5 | sed 's/^/  /'
    echo
    echo "Actualizala antes de terminar: que quedo hecho, que esta a medias, que sigue."
    echo "Es el punto de retorno si esta sesion se cae. Un turno que termina sin"
    echo "actualizarla deja el estado solo en el chat, y el chat se compacta."
  } >&2
  exit 2
fi
exit 0
