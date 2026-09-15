#!/usr/bin/env bash
# Spec 0064 §4.b — EL ERROR FANTASMA DEL TIPO GENERADO.
#
# `apps/merchant/.next/types/validator.ts` lo GENERA Next con un bloque por ruta, y cada
# bloque hace `import("../../src/app/.../route.js")`. `tsconfig` lo incluye, asi que `tsc` lo
# typechequea. Si alguien borra una ruta y el validator todavia tiene SU bloque,
# `pnpm typecheck` falla con `Cannot find module '.../route.js'` APUNTANDO A UN ARCHIVO QUE SE
# BORRO A PROPOSITO — y alguien se pone a perseguir un error que no es un error.
#
# LO QUE SE BORRA ES EL VALIDATOR, NO LA RUTA. El validator se deriva del arbol de archivos:
# el proximo `next build`/`dev` lo regenera SIN el bloque de la ruta borrada. La ruta no
# vuelve. Es un artefacto de build puro (`.next/` esta gitignoreado), asi que borrarlo no
# destruye nada — y por eso este guard puede ARREGLAR en vez de solo avisar.
#
# POR QUE NO EXPLOTA EN CI NI EN VERCEL: alla se buildea de cero y el validator viejo no
# existe. El fantasma es SOLO de una maquina con `.next` tibio — la del owner o la de un
# agente — que es justo el unico lugar donde alguien lo va a perseguir a mano.
#
# DONDE SE INVOCA, y por que no es una entrada suelta en el array `Stop` de `settings.json`:
# este chequeo TIENE que correr ANTES de `verify.sh`, porque si corriera despues, `verify.sh`
# ya fallo con el fantasma y bloqueo el turno por un error inexistente. No pude verificar
# desde adentro de un turno que el orden del array de `Stop` se respete (el evento `Stop`
# dispara DESPUES del ultimo mensaje, asi que su resultado no es observable en el mismo turno
# que lo mediria), y afirmar que se respeta sin haberlo medido seria exactamente la clase de
# invariante declarado y no verificado que este repo ya pago caro. La spec autoriza el
# fallback explicitamente, asi que se toma el camino cuyo orden esta garantizado POR
# CONSTRUCCION: `verify.sh` lo llama en su PRIMERA linea util, en el mismo proceso y de forma
# secuencial. Ademas evita una carrera real: dos hooks en paralelo, uno borrando el validator
# mientras el otro corre `tsc` sobre el.
#
# SIGUE SIENDO UN SCRIPT PROPIO (y no tres lineas pegadas adentro de `verify.sh`) para que se
# pueda correr solo y probar que MUERDE y que DISCRIMINA, que es lo que la spec exige.
#
# COMO SE PRUEBA (las dos corridas estan transcritas en `docs/implementacion-fases-bc-0064.md`):
#   CLAUDE_PROJECT_DIR=<arbol falso con una ruta inexistente> bash stale-validator.sh  -> borra + mensaje
#   CLAUDE_PROJECT_DIR=<arbol falso sano>                     bash stale-validator.sh  -> no toca nada (shasum igual)
# Un hook que borra siempre es tan inutil como uno que no borra nunca.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

VALIDATOR="apps/merchant/.next/types/validator.ts"

# Sin `.next` tibio no hay fantasma posible. Salir en 0 aca es "no habia nada que mirar", que
# es el caso normal en CI.
[ -f "$VALIDATOR" ] || exit 0

dir=$(dirname "$VALIDATOR")

# Los paths salen del `import(...)` y son RELATIVOS al directorio del validator
# (`../../src/app/...` = `apps/merchant/src/app/...`). Se leen del import y no del comentario
# `// Validate ...` de arriba: el import es lo que `tsc` resuelve de verdad, y el comentario
# es texto que nadie compila.
stale=""
count=0
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  base="$dir/${rel%.js}"
  # Si existe CUALQUIERA de las ortografias que Next acepta, la ruta esta viva.
  if [ -f "$base.ts" ] || [ -f "$base.tsx" ] || [ -f "$base.js" ]; then
    continue
  fi
  stale="$stale  $rel"$'\n'
  count=$((count + 1))
done < <(grep -oE 'import\("[^"]*/route\.js"\)' "$VALIDATOR" |
  sed -E 's/^import\("//; s/"\)$//' | sort -u)

[ "$count" -gt 0 ] || exit 0

rm -f "$VALIDATOR"
{
  printf 'stale-validator: BORRE %s\n\n' "$VALIDATOR"
  printf 'Referenciaba %s ruta(s) que ya no existen en el arbol:\n' "$count"
  printf '%s' "$stale"
  printf '\n'
  printf 'Por que se puede borrar: es un archivo GENERADO por Next (.next/ esta gitignoreado).\n'
  printf 'Lo que se regenera con el proximo build/dev es EL VALIDATOR, ya sin esos bloques.\n'
  printf 'LA RUTA BORRADA NO VUELVE.\n\n'
  printf 'Si no se borraba, `pnpm typecheck` fallaba con "Cannot find module .../route.js"\n'
  printf 'apuntando a un archivo que se borro a proposito — un error que no es un error.\n'
} >&2
exit 0
