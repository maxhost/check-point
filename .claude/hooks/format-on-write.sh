#!/usr/bin/env bash
# PostToolUse (Write|Edit) — corre `prettier --write` sobre el archivo recien tocado.
#
# Por que existe (spec 0047): el CI corria `pnpm format:check` como PRIMER paso y
# fallaba con 20 archivos en deuda, asi que lint/typecheck/test/e2e/build NUNCA se
# ejecutaban en GitHub. El repo tenia la apariencia de un gate sin tener el gate.
# Formatear la deuda arregla el sintoma; esto arregla la causa (mistake->rule): cada
# escritura sale formateada, la deuda no se vuelve a acumular y cuesta cero tokens.
#
# Es HIGIENE, no un gate: sale 0 SIEMPRE y en silencio. Un exit 2 aca bloquearia
# ediciones perfectamente validas (archivo con un parse error transitorio a mitad de
# una edicion en varios pasos, prettier no instalado, etc). El gate sigue siendo
# `pnpm format:check` en CI.
#
# Y esta CONTENIDO a este repo: nunca escribe un archivo fuera de la raiz del
# proyecto (ver el guard de contencion mas abajo). La config de prettier de aca no
# tiene por que reescribir codigo ajeno si en una sesion se edita un archivo de otro
# proyecto o un script suelto en /tmp.
#
# Se registra DESPUES de file-size.sh en el mismo matcher para que el aviso de tamaño
# se siga viendo.

set -uo pipefail

# Mismo patron de lectura de stdin que file-size.sh, para ser consistente.
input=$(cat)
f=$(printf '%s' "$input" | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    try{const j=JSON.parse(s);process.stdout.write(j.tool_input?.file_path??"")}catch{}
  })' 2>/dev/null)

[ -n "$f" ] && [ -f "$f" ] || exit 0

# La raiz del proyecto importa: prettier resuelve .prettierignore/.gitignore desde el
# CWD. Verificado (spec 0047): con cwd fuera del repo, `prettier --write <ruta abs>`
# IGNORA .prettierignore y reescribe archivos que no debe (p.ej. settings.local.json).
# Por eso corremos siempre parados en la raiz. Y por eso NO pasamos --ignore-path: el
# default de prettier 3 es {.gitignore, .prettierignore}, y fijar uno solo perderia el
# otro — queremos exactamente el mismo criterio que `pnpm format:check`.
root="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$root" ] || [ ! -d "$root" ]; then
  d=$(cd "$(dirname "$f")" 2>/dev/null && pwd) || exit 0
  while [ -n "$d" ] && [ "$d" != "/" ]; do
    [ -f "$d/.prettierignore" ] && { root="$d"; break; }
    d=$(dirname "$d")
  done
fi
[ -n "$root" ] && [ -d "$root" ] || exit 0

# Guard de contencion: esto es higiene de ESTE repo, no una licencia para reescribir
# codigo ajeno con la config de prettier de aca. Si en una sesion se edita un archivo
# de otro proyecto o un script suelto en /tmp, el hook no lo toca. (Cazado por un
# revisor independiente en la spec 0047: con CLAUDE_PROJECT_DIR apuntando al repo, un
# file_path de /tmp/otro-proyecto quedaba reformateado.)
#
# Normalizamos ambos lados con el MISMO criterio (fs.realpathSync) antes de comparar:
# $f puede venir relativo o con "..", y tanto $f como $root pueden pasar por symlinks
# (en macOS /tmp -> /private/tmp) o traer trailing slash. Comparar sin normalizar daria
# falsos negativos y dejaria un hook decorativo que no formatea nada del repo.
# Si la normalizacion falla por lo que sea, no formateamos y salimos 0 igual.
norm=$(node -e '
  const fs = require("fs");
  process.stdout.write(process.argv.slice(1)
    .map((p) => { try { return fs.realpathSync(p) } catch { return "" } })
    .join("\n"))' "$f" "$root" 2>/dev/null)
fr=$(printf '%s' "$norm" | sed -n '1p')
rr=$(printf '%s' "$norm" | sed -n '2p')
rr=${rr%/}
[ -n "$fr" ] && [ -n "$rr" ] || exit 0
case "$fr" in
  "$rr"/*) ;;
  *) exit 0 ;;
esac

bin="$rr/node_modules/.bin/prettier"
[ -x "$bin" ] || bin=$(command -v prettier 2>/dev/null) || exit 0
[ -n "$bin" ] || exit 0

# --ignore-unknown: extensiones que prettier no parsea salen 0 sin ruido.
(cd "$rr" && "$bin" --write --ignore-unknown "$fr") >/dev/null 2>&1

exit 0
