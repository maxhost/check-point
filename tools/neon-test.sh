#!/usr/bin/env bash
# Corre las suites `.neon.integration` contra la rama Neon de CI, con la MISMA receta que
# `.github/workflows/ci.yml:47-57`. Nace porque la receta tenia tres pasos y ninguno estaba
# escrito: las suites se auto-skipean sin `NEON_INTEGRATION_DATABASE_URL` +
# `NEON_INTEGRATION_ISOLATED=true`, vitest NO lee `.env.local`, y la rama de CI se queda atras
# de las migraciones. Un `skipped` se lee igual que un `passed`: por eso esto existe.
#
#   tools/neon-test.sh                      # toda la suite
#   tools/neon-test.sh src/server/x.test.ts # un archivo (rutas relativas a apps/merchant)
#
# NUNCA imprime el valor de una credencial: solo la clave y su largo.
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="apps/merchant/.env.local"
[ -f "$ENV_FILE" ] || { echo "falta $ENV_FILE"; exit 1; }

leer() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- || true; }
# El host de una URL de Postgres, sin el sufijo `-pooler` (pooled y directa comparten rama).
host() { printf %s "$1" | sed -e 's|^[^@]*@||' -e 's|/.*$||' -e 's|-pooler||'; }

CI_POOLED="$(leer NEON_CI_DATABASE_URL)"
CI_DIRECT="$(leer NEON_CI_DATABASE_URL_UNPOOLED)"
PROD="$(leer DATABASE_URL)"

for par in "NEON_CI_DATABASE_URL:$CI_POOLED" "NEON_CI_DATABASE_URL_UNPOOLED:$CI_DIRECT"; do
  clave="${par%%:*}"; valor="${par#*:}"
  if [ -z "$valor" ]; then
    echo "ERROR: $clave no tiene valor en $ENV_FILE."
    echo "Es la rama de pruebas de Neon, NO la base real."
    exit 1
  fi
  echo "ok $clave (largo ${#valor})"
done

# EL INTERLOCK QUE IMPORTA. Estas suites borran mundos enteros en su teardown: apuntarlas a la
# base real es perdida de datos, no un test rojo. Se compara el HOST sin `-pooler`, asi que
# pegar la URL pooled de produccion tampoco pasa.
if [ -n "$PROD" ] && [ "$(host "$CI_POOLED")" = "$(host "$PROD")" ]; then
  echo "ABORTADO: NEON_CI_DATABASE_URL apunta a la misma rama que DATABASE_URL."
  echo "Estas suites BORRAN datos. Usa la rama \`ci-integration\`, nunca \`main\`."
  exit 1
fi

# La rama de CI nace de `main` y se queda atras cuando llega una migracion nueva. drizzle-kit
# aplica solo las pendientes, asi que correrlo siempre es idempotente (igual que la CI).
echo "→ migrando la rama de CI"
DATABASE_URL_UNPOOLED="$CI_DIRECT" pnpm db:migrate

echo "→ tests"
if [ "$#" -eq 0 ]; then
  NEON_INTEGRATION_DATABASE_URL="$CI_POOLED" NEON_INTEGRATION_ISOLATED=true pnpm run test
else
  NEON_INTEGRATION_DATABASE_URL="$CI_POOLED" NEON_INTEGRATION_ISOLATED=true \
    pnpm --filter @mi-pasaporte/merchant exec vitest run "$@"
fi
