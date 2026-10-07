#!/usr/bin/env bash
# Oraculo «esquema local == PROD» (spec 0167 §4): corre `huellas.sql` en la base local y hace diff
# contra `huellas-prod.txt` (la misma consulta corrida en PROD por el MCP de Neon, solo lectura).
# Exit 0 solo sin diferencias. Ninguna categoria se excluye: una diferencia legitima se discute.
#
# Corre como `neondb_owner`, el mismo rol con el que se leyo PROD: las vistas de
# `information_schema` de grants dependen de los roles habilitados del que consulta.
set -euo pipefail

cd "$(dirname "$0")"
local_out="$(docker compose -f compose.yaml exec -T pg \
  psql -v ON_ERROR_STOP=1 -X -q -A -t -U neondb_owner -d neondb < huellas.sql)"

if diff -u --label "PROD (huellas-prod.txt)" --label "local" huellas-prod.txt <(printf '%s\n' "$local_out"); then
  echo "ok: esquema local == PROD ($(wc -l < huellas-prod.txt | tr -d ' ') categorias)"
else
  echo "DIFERENCIA: el esquema local no coincide con PROD (arriba, el diff)."
  exit 1
fi
