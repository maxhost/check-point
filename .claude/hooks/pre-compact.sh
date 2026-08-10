#!/usr/bin/env bash
# PreCompact — ultima linea de defensa antes de que la compactacion borre estado.
#
# Este es el unico hook que dispara con la señal REAL en vez de una heuristica:
# el sistema ya decidio que el contexto se lleno. Si TASKS.md no esta al dia en
# este momento, se pierde.
#
# Que borra la compactacion: lo que vive solo en la conversacion. Que sobrevive:
# lo que esta en disco (CLAUDE.md se re-inyecta, TASKS.md se re-lee).
#
# No bloquea (exit 0): bloquear la compactacion deja la sesion sin salida.
# Inyecta la instruccion para que el resumen la arrastre.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

stale=""
if [ -f docs/TASKS.md ]; then
  # ¿Hay codigo tocado mas nuevo que TASKS.md?
  newer=$(find src -newer docs/TASKS.md -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | head -3)
  [ -n "$newer" ] && stale="si"
else
  stale="falta"
fi

{
  echo "COMPACTACION INMINENTE — el contexto de esta conversacion se va a resumir."
  echo
  echo "Lo que vive solo en este chat se pierde. Lo que esta en disco vuelve."
  if [ "$stale" = "falta" ]; then
    echo
    echo "!! docs/TASKS.md NO EXISTE. Crealo ahora con el estado real antes de continuar."
  elif [ -n "$stale" ]; then
    echo
    echo "!! Tocaste codigo despues de la ultima actualizacion de docs/TASKS.md."
    echo "   Actualizalo AHORA o el proximo turno no va a saber que quedo hecho."
  fi
  echo
  echo "Preserva en el resumen: archivos modificados, comandos de test, decisiones"
  echo "tomadas y su motivo, y lo que fallo (los caminos descartados importan: sin"
  echo "ellos se reintentan los mismos errores)."
} >&2

exit 0
