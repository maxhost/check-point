#!/usr/bin/env bash
# Levanta la base local que replica Neon (spec 0167 §1): contenedores → migraciones → login del rol
# del cliente → seed ficticio. Idempotente: correrlo dos veces deja el mismo estado.
#
# Nunca toca PROD: la URL de la app es la local, fija aca, y los scripts `db:local:*` rechazan
# cualquier host que no sea local.
set -euo pipefail

cd "$(dirname "$0")"
REPO="$(cd ../.. && pwd)"
COMPOSE=(docker compose -f compose.yaml)
# La app y los scripts entran como `neondb_owner` a traves del proxy (el puerto de la URL se ignora
# por HTTP; ADR 0126 §Medido).
LOCAL_URL="postgresql://neondb_owner:local-solo-dev@db.localtest.me:5432/neondb"

echo "→ contenedores (checkpass-local)"
"${COMPOSE[@]}" up -d --wait

echo "→ esperando el proxy en 127.0.0.1:4444"
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null -X POST http://127.0.0.1:4444/sql \
    -H "Neon-Connection-String: $LOCAL_URL" -H "Content-Type: application/json" \
    --data '{"query":"select 1","params":[]}' 2>/dev/null; then
    break
  fi
  [ "$i" -eq 60 ] && { echo "ERROR: el proxy no respondio en 60 s"; exit 1; }
  sleep 1
done

echo "→ migraciones (db:local:migrate)"
(cd "$REPO" && DATABASE_URL="$LOCAL_URL" pnpm --silent --filter @mi-pasaporte/db db:local:migrate)

# En PROD el login de `checkpass_consumer` se dio fuera de las migraciones (la 0060 lo crea NOLOGIN).
echo "→ login local de checkpass_consumer"
"${COMPOSE[@]}" exec -T pg psql -v ON_ERROR_STOP=1 -q -U neondb_owner -d neondb \
  -c "alter role checkpass_consumer login password 'local-solo-dev'"

echo "→ seed ficticio (db:local:seed)"
(cd "$REPO" && DATABASE_URL="$LOCAL_URL" pnpm --silent --filter @mi-pasaporte/db db:local:seed)

echo "ok: base local lista en $LOCAL_URL (contraseña local fija, no es un secreto)"
