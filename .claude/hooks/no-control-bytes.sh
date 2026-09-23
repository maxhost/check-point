#!/usr/bin/env bash
# PostToolUse (Write|Edit) — un fuente o un doc NUNCA lleva bytes de control CRUDOS.
#
# EL CASO, medido el 2026-09-22 en la spec 0090 (dos veces en el mismo turno):
#
#   1. El implementador escribio `/[\u0000-\u001f\u007f]/g` y los escapes se
#      decodificaron a bytes crudos. `catalog-import/validation.ts` y
#      `catalog-import-extraction.test.ts` pasaron a ser BINARIOS para git:
#      `git diff --stat` decia `Bin 0 -> 9724 bytes`, o sea que los dos archivos
#      centrales de la spec NO eran revisables en un diff ni en un PR.
#   2. El ORQUESTADOR repitio el error en el informe de revision que denunciaba (1).
#
# El modo de falla NO es que algo se rompa: es que **el barrido pasa vacuo**.
# `rg -n 'sanitizeText' validation.ts` devolvia "binary file matches" con
# **exit 0 y CERO lineas** sobre un archivo que tenia 3 hits. Un criterio de DoD
# escrito como `rg ... -> vacio` pasa para siempre. Es la misma familia que el
# `'a\|b'` de la leccion del 2026-09-20: el comando no falla, miente.
#
# Va como hook porque se chequea con un comando, cuesta cero tokens y es
# determinista — CLAUDE.md: "nunca la misma correccion dos veces a mano".
#
# Es PostToolUse con exit 2 (bloquea y avisa) y no Stop, porque el arreglo es
# local al archivo recien escrito y cuanto antes se entere, menos se propaga.
#
# NO se chequea TAB (0x09) ni LF (0x0a) ni CR (0x0d): son whitespace legitimo.

set -uo pipefail

input=$(cat)
f=$(printf '%s' "$input" | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    try{const j=JSON.parse(s);process.stdout.write(j.tool_input?.file_path??"")}catch{}
  })' 2>/dev/null)

[ -n "$f" ] && [ -f "$f" ] || exit 0
case "$f" in
  *.ts|*.tsx|*.js|*.mjs|*.cjs|*.json|*.md|*.css|*.yml|*.yaml|*.sh) ;;
  *) exit 0 ;;
esac

# La deteccion es `tr -dc` + `wc -c`: BORRA todo lo que NO sea byte de control y
# cuenta lo que queda. Se eligio midiendo, y la alternativa obvia NO sirve:
#
#   LC_ALL=C grep -c '[[:cntrl:]]' <archivo con un \0>   -> no matchea NADA
#
# `grep` trata el archivo como binario y la clase no muerde, asi que un hook
# escrito con `grep` habria dado EXIT=0 para siempre — el mismo "pasa vacuo"
# que este hook existe para cazar. Medido el 2026-09-22 con tres fixtures:
# sano -> 0, uno con un \0 -> 1, el `validation.ts` real del bug -> 3.
#
# El rango excluye TAB (011), LF (012) y CR (015): son whitespace legitimo.
crudas=$(LC_ALL=C tr -dc '\000-\010\013\014\016-\037\177' < "$f" | wc -c | tr -d ' ')
crudas=${crudas:-0}

if [ "$crudas" -gt 0 ]; then
  printf '%s tiene BYTES DE CONTROL CRUDOS.\n' "$f" >&2
  printf 'git lo trata como BINARIO (no es revisable en un diff) y `rg` sin -a devuelve\n' >&2
  printf 'exit 0 con CERO lineas: todo barrido sobre el archivo PASA VACUO.\n' >&2
  printf 'Escribilos como escapes literales (\\u0000, \\u001f, \\u007f), no como el byte.\n' >&2
  # Que bytes son, exactamente. Los dos candidatos obvios se probaron y MIENTEN:
  # `grep '[[:cntrl:]]'` no matchea nada, y `od -c | grep` matchea los OFFSETS
  # octales en vez de los bytes. `cat -v | grep` da falsos positivos sobre UTF-8
  # multibyte (un em-dash sale como `M-^@M-^T`). Esto se verifico corriendolo.
  cuales=$(LC_ALL=C tr -dc '\000-\010\013\014\016-\037\177' < "$f" | od -An -c | tr -s ' ')
  printf 'Son %s byte(s):%s\n' "$crudas" "$cuales" >&2
  exit 2
fi
exit 0
