#!/usr/bin/env bash
# Stop — bloquea el fin del turno si quedo una MUTACION de prueba aplicada al codigo.
#
# Por que existe: un implementador de la spec 0055 murio a mitad de correr sus
# mutaciones y dejo `counter/core.ts` con el filtro `status = 'active'` BORRADO y el
# comentario `// MUTATION (e): the status filter is gone.` todavia puesto. La suite de
# integracion daba 25/26 con un rojo que parecia un bug real del producto ("un miembro
# disabled puede operar el mostrador"). No lo era.
#
# Ese es el problema de fondo: **un rojo de mutacion y un rojo de bug son
# indistinguibles desde afuera**, y el default de quien hereda el arbol es creerle al
# sintoma — perseguir un bug que no existe, o peor, "arreglarlo" tapando la mutacion.
#
# LO QUE ESTE GUARD *NO* HACE, declarado en vez de tapado: solo ve mutaciones
# ETIQUETADAS. Una mutacion sin comentario pasa limpio. No es un detector de codigo
# mutado — es el cierre de una convencion: los encargos a implementadores exigen
# etiquetar toda mutacion con `MUTATION`, y esto hace cumplir esa etiqueta. Un
# implementador que no etiqueta ya violo el encargo antes de llegar aca.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

# Mismo criterio que tasks-fresh.sh: este es un MONOREPO, `src/` no vive en la raiz.
srcdirs=()
for d in src apps/*/src packages/*/src; do
  [ -d "$d" ] && srcdirs+=("$d")
done
[ ${#srcdirs[@]} -gt 0 ] || exit 0

hits=$(grep -rn -E '\b(MUTATION|MUTACION)\b' "${srcdirs[@]}" \
  --include='*.ts' --include='*.tsx' 2>/dev/null | head -5)

if [ -n "$hits" ]; then
  {
    echo "Quedo una MUTACION de prueba aplicada al codigo:"
    echo "$hits" | sed 's/^/  /'
    echo
    echo "Una mutacion es para probar que un test MUERDE, y se revierte siempre."
    echo "Si la dejas puesta, su rojo es indistinguible de un bug real: quien herede"
    echo "este arbol va a perseguir un bug que no existe (paso en la spec 0055)."
    echo
    echo "Restaura el codigo original y verifica con 'shasum' antes de terminar."
  } >&2
  exit 2
fi
exit 0
