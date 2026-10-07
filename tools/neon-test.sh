#!/usr/bin/env bash
# Corre las suites `.neon.integration` contra la rama Neon de CI, con la MISMA receta que
# `.github/workflows/ci.yml:47-57`. Nace porque la receta tenia tres pasos y ninguno estaba
# escrito: las suites se auto-skipean sin `NEON_INTEGRATION_DATABASE_URL` +
# `NEON_INTEGRATION_ISOLATED=true`, vitest NO lee `.env.local`, y la rama de CI se queda atras
# de las migraciones. Un `skipped` se lee igual que un `passed`: por eso esto existe.
#
#   tools/neon-test.sh                                    # toda la suite
#   tools/neon-test.sh src/server/x.test.ts               # un archivo (relativo a apps/merchant)
#   tools/neon-test.sh --app consumer src/server/x.test.ts # un archivo de apps/consumer (spec 0117)
#   tools/neon-test.sh --app merchant --related /abs/a.ts  # las suites que importan esos archivos
#                                                          # (`vitest related`, spec 0133); lista vacia → sale 0
#
# NUNCA imprime el valor de una credencial: solo la clave y su largo.
set -euo pipefail

APP="merchant"
if [ "${1:-}" = "--app" ]; then
  APP="${2:-}"
  shift 2 || { echo "uso: tools/neon-test.sh [--app merchant|consumer] [--related] [archivos...]"; exit 1; }
fi
case "$APP" in
  merchant | consumer) ;;
  *) echo "app desconocida: '$APP' (merchant | consumer)"; exit 1 ;;
esac
RELATED=0
if [ "${1:-}" = "--related" ]; then
  RELATED=1
  shift
  # Spec 0133: sin archivos no hay grafo que seguir; no se migra ni se corre nada.
  if [ "$#" -eq 0 ]; then
    echo "--related sin archivos: nada que correr"
    exit 0
  fi
fi

cd "$(dirname "$0")/.."
# `NEON_TEST_ENV_FILE` existe para probar el candado con un archivo temporal (spec 0167).
ENV_FILE="${NEON_TEST_ENV_FILE:-apps/merchant/.env.local}"
[ -f "$ENV_FILE" ] || { echo "falta $ENV_FILE"; exit 1; }

leer() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- || true; }
# El host de una URL de Postgres, sin el sufijo `-pooler` (pooled y directa comparten rama).
host() { printf %s "$1" | sed -e 's|^[^@]*@||' -e 's|/.*$||' -e 's|-pooler||'; }
# El endpoint de Neon de una URL: el primer segmento DNS del host sin `-pooler` ni `-rvr`, en
# cualquier orden. Misma regla que `neonEndpointId` de `packages/db/src/local.ts` (spec 0167).
endpoint_id() {
  local id
  id="$(printf %s "$1" | sed -e 's|^[A-Za-z0-9+.-]*://||' -e 's|^[^@/]*@||' -e 's|[/?:].*$||' -e 's|\..*$||' |
    tr '[:upper:]' '[:lower:]')"
  while :; do
    case "$id" in
      *-pooler) id="${id%-pooler}" ;;
      *-rvr) id="${id%-rvr}" ;;
      *) break ;;
    esac
  done
  printf %s "$id"
}
sha12() { printf %s "$1" | shasum -a 256 | cut -c1-12; }

CI_POOLED="$(leer NEON_CI_DATABASE_URL)"
CI_DIRECT="$(leer NEON_CI_DATABASE_URL_UNPOOLED)"

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
# base real es perdida de datos, no un test rojo. Spec 0167: ya NO se compara contra
# `DATABASE_URL` (pasa a ser la base local y dejaria de proteger), sino contra la huella del
# endpoint de PROD, que vive en `packages/db/src/local.ts` (no se duplica). Se compara el
# endpoint sin `-pooler`/`-rvr`: ninguna de las cuatro variantes de host de PROD pasa.
# (Con `sed`, no `rg`: en esta Mac `rg` no es un binario del PATH de bash, medido 2026-10-07.)
PROD_SHA12="$(sed -nE 's/^export const PROD_DB_ENDPOINT_SHA12 = "([0-9a-f]{12})";$/\1/p' packages/db/src/local.ts 2>/dev/null | head -n1 || true)"
if ! printf %s "$PROD_SHA12" | grep -Eq '^[0-9a-f]{12}$'; then
  echo "ABORTADO: no pude leer PROD_DB_ENDPOINT_SHA12 de packages/db/src/local.ts."
  exit 1
fi
for par in "NEON_CI_DATABASE_URL:$CI_POOLED" "NEON_CI_DATABASE_URL_UNPOOLED:$CI_DIRECT" \
  "NEON_CI_CONSUMER_DATABASE_URL:$(leer NEON_CI_CONSUMER_DATABASE_URL)"; do
  clave="${par%%:*}"; valor="${par#*:}"
  if [ -n "$valor" ] && [ "$(sha12 "$(endpoint_id "$valor")")" = "$PROD_SHA12" ]; then
    echo "ABORTADO: $clave apunta a la rama de PROD (\`main\`)."
    echo "Estas suites BORRAN datos. Usa la rama \`ci-integration\`, nunca \`main\`."
    exit 1
  fi
done

# Spec 0118: el oraculo del rol del cliente se conecta COMO `checkpass_consumer` (la URL de la
# rama de CI con ese usuario). Opcional para el script —sin ella ese archivo FALLA, no se
# saltea— pero si esta, tiene que ser la rama de CI y nunca la base real.
CI_CONSUMER="$(leer NEON_CI_CONSUMER_DATABASE_URL)"
if [ -n "$CI_CONSUMER" ]; then
  if [ "$(host "$CI_CONSUMER")" != "$(host "$CI_POOLED")" ]; then
    echo "ABORTADO: NEON_CI_CONSUMER_DATABASE_URL no apunta a la rama de CI."
    exit 1
  fi
  echo "ok NEON_CI_CONSUMER_DATABASE_URL (largo ${#CI_CONSUMER})"
  export NEON_INTEGRATION_CONSUMER_DATABASE_URL="$CI_CONSUMER"
else
  echo "aviso: NEON_CI_CONSUMER_DATABASE_URL sin valor en $ENV_FILE (el oraculo del rol va a fallar)"
fi

# La rama de CI nace de `main` y se queda atras cuando llega una migracion nueva. drizzle-kit
# aplica solo las pendientes, asi que correrlo siempre es idempotente (igual que la CI).
echo "→ migrando la rama de CI"
DATABASE_URL_UNPOOLED="$CI_DIRECT" pnpm db:migrate

echo "→ tests"
if [ "$RELATED" -eq 1 ]; then
  NEON_INTEGRATION_DATABASE_URL="$CI_POOLED" NEON_INTEGRATION_ISOLATED=true \
    pnpm --filter "@mi-pasaporte/$APP" exec vitest related --run "$@"
elif [ "$#" -eq 0 ]; then
  NEON_INTEGRATION_DATABASE_URL="$CI_POOLED" NEON_INTEGRATION_ISOLATED=true pnpm run test
else
  NEON_INTEGRATION_DATABASE_URL="$CI_POOLED" NEON_INTEGRATION_ISOLATED=true \
    pnpm --filter "@mi-pasaporte/$APP" exec vitest run "$@"
fi
