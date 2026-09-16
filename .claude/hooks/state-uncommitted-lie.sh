#!/usr/bin/env bash
# Stop — el bloque ESTADO de docs/TASKS.md dice "SIN COMMITEAR" con el arbol LIMPIO.
#
# Por que existe (2026-09-16, fase C de la spec 0065): el orquestador escribio
# "C esta SIN COMMITEAR" en el bloque ESTADO y despues commiteo — en el MISMO
# commit. O sea que el archivo que la sesion fresca lee como punto de retorno
# describia un arbol que ese mismo commit acababa de invalidar. Paso igual con
# B3 y arrastraba lo mismo en las secciones de B1 y B2.
#
# No es el drift entre sesiones que ya cubre CLAUDE.md ("el bloque ESTADO se
# reescribe entero en el handoff"): es mas fino y mas facil de cometer — el doc
# se escribe ANTES del commit, y nadie lo vuelve a mirar DESPUES. La regla
# advisory no lo evito dos veces seguidas, asi que pasa a hook.
#
# Chequeo deterministico: si `git status --short` esta VACIO (no hay nada sin
# commitear) y las primeras PRIMERAS lineas de docs/TASKS.md dicen "SIN
# COMMITEAR", el doc miente. Solo mira el encabezado — las secciones historicas
# de mas abajo hablan de arcos viejos y son legitimas.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f docs/TASKS.md ] || exit 0
command -v git >/dev/null 2>&1 || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Solo aplica con el arbol limpio: con cambios pendientes, "SIN COMMITEAR" es cierto.
[ -z "$(git status --short)" ] || exit 0

HEAD_LINES=${TASKS_HEAD_LINES:-40}
if head -n "$HEAD_LINES" docs/TASKS.md | grep -qi 'SIN COMMITEAR'; then
  printf 'docs/TASKS.md dice "SIN COMMITEAR" en sus primeras %s lineas, pero el arbol esta LIMPIO.\n' "$HEAD_LINES" >&2
  printf 'Una sesion fresca lee ese bloque como el estado real y va a buscar trabajo que ya esta commiteado.\n' >&2
  printf 'Reescribi el bloque ESTADO con el sha real (git log --oneline -1) antes de cerrar.\n' >&2
  exit 2
fi
exit 0
