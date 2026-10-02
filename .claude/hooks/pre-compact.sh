#!/usr/bin/env bash
# PreCompact — ultima linea de defensa antes de que la compactacion borre estado.
#
# Este es el unico hook que dispara con la señal REAL en vez de una heuristica:
# el sistema ya decidio que el contexto se lleno. Si el ESTADO de Claude
# (docs/estado/claude.md, spec 0135 / ADR 0114) no esta al dia en
# este momento, se pierde.
#
# Que borra la compactacion: lo que vive solo en la conversacion. Que sobrevive:
# lo que esta en disco (CLAUDE.md se re-inyecta, docs/estado/claude.md se re-lee).
#
# No bloquea (exit 0): bloquear la compactacion deja la sesion sin salida.
# Inyecta la instruccion para que el resumen la arrastre.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

stale=""
STATE=docs/estado/claude.md
if [ -f "$STATE" ]; then
  # ¿Hay codigo tocado mas nuevo que el estado?
  newer=$(find src -newer "$STATE" -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | head -3)
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
    echo "!! $STATE NO EXISTE. Crealo ahora con el estado real antes de continuar."
  elif [ -n "$stale" ]; then
    echo
    echo "!! Tocaste codigo despues de la ultima actualizacion de $STATE."
    echo "   Actualizalo AHORA o el proximo turno no va a saber que quedo hecho."
  fi
  echo
  echo "Preserva en el resumen: archivos modificados, comandos de test, decisiones"
  echo "tomadas y su motivo, y lo que fallo (los caminos descartados importan: sin"
  echo "ellos se reintentan los mismos errores)."
} >&2

exit 0
