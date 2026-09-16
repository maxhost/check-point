#!/usr/bin/env bash
# PostToolUse (Write|Edit) — un archivo de test que vitest NUNCA va a correr.
#
# `apps/merchant/vitest.config.ts` tiene `include: ["src/**/*.test.ts"]`: un
# `*.test.tsx` no se ejecuta NI nombrandolo explicitamente (medido — vitest
# contesta "No test files found" e imprime el include). O sea que un test de
# render escrito con esa extension queda invisible y la suite sigue verde
# diciendo que lo cubre: el peor resultado posible, porque se ve como cobertura.
#
# El riesgo no es teorico: la tabla de Archivos de la spec 0065 pide
# `app/backoffice/marketing/*.test.tsx` para la fase B3. Los 158 tests que hay
# hoy en el repo son `.test.ts`, incluidos TODOS los que renderizan JSX con
# `renderToStaticMarkup` (esbuild los compila igual: el JSX vive en los .tsx
# que importan, no en el test).
#
# Va como hook y no como linea en CLAUDE.md porque se chequea con un comando.

set -uo pipefail

input=$(cat)
f=$(printf '%s' "$input" | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    try{const j=JSON.parse(s);process.stdout.write(j.tool_input?.file_path??"")}catch{}
  })' 2>/dev/null)

[ -n "$f" ] || exit 0
case "$f" in
  *.test.tsx)
    printf '%s no lo corre vitest: include es "src/**/*.test.ts" (medido).\n' "$f" >&2
    printf 'Renombralo a .test.ts — los tests de render del repo ya son .test.ts.\n' >&2
    exit 2
    ;;
esac
exit 0
