#!/usr/bin/env bash
# `pnpm dev:local` — levanta el ambiente local completo en una sola terminal (ADR 0126, ADR 0127):
# base local en Docker → chequeo de .env → consumer :3200 y merchant :3201 → tunel (recien con las apps
# respondiendo, para no publicar otro programa en esos puertos). Ctrl+C apaga apps y tunel; la base queda.
# Los logs de cada proceso quedan en .dev-local/ (`pnpm dev:link` saca de ahi el link de login).
set -euo pipefail
cd "$(dirname "$0")/../.."
REPO="$(pwd)"
LOGS="$REPO/.dev-local"
mkdir -p "$LOGS"

abort() { echo "ABORTADO: $*" >&2; exit 1; }
# ¿El proceso corre dentro de este repo? En minusculas: APFS no distingue mayusculas y la misma carpeta
# llega como `Documents` o `documents` segun desde donde se abrio la terminal (medido 2026-10-08).
of_repo() {
  local cwd
  cwd="$(lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | tr '[:upper:]' '[:lower:]')"
  [[ "$cwd" == "$(echo "$REPO" | tr '[:upper:]' '[:lower:]')"* ]]
}

# Node 24 (el chequeo de variables es .ts). bash 3.2 de macOS: sin `wait -n` ni arrays vacios con `set -u`.
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  set +u; export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use >/dev/null; set -u
fi

echo "→ Docker"
docker info >/dev/null 2>&1 || abort "Docker no responde: abri Docker Desktop y reintenta"

echo "→ base local (db:local:up)"
tools/local-db/up.sh >"$LOGS/db.log" 2>&1 || { tail -20 "$LOGS/db.log" >&2; abort "fallo la base local (.dev-local/db.log)"; }

echo "→ variables (.env.local)"
node tools/local-db/check-env.ts 2>/dev/null | grep -v '^ok ' || true
node tools/local-db/check-env.ts >/dev/null 2>&1 || abort "corregi las lineas MAL de arriba (docs/runbooks/tunel-dev.md §4)"

echo "→ puertos"
for port in 3200 3201; do
  pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1 || true)"
  [[ -z "$pid" ]] && continue
  of_repo "$pid" && abort ":$port ya lo usa este repo (pid $pid): el ambiente ya esta corriendo o quedo colgado (kill $pid)"
  abort ":$port lo usa otro programa ($(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'), pid $pid)"
done

PIDS=()
cleanup() {
  trap - INT TERM EXIT
  echo
  echo "→ apagando apps y tunel (la base local queda arriba)"
  for pid in ${PIDS[@]+"${PIDS[@]}"}; do pkill -TERM -P "$pid" 2>/dev/null || true; kill "$pid" 2>/dev/null || true; done
  # `next dev` deja nietos: se apaga lo que escuche en los puertos y sea de este repo.
  for port in 3200 3201; do
    for pid in $(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true); do
      if of_repo "$pid"; then kill "$pid" 2>/dev/null || true; fi
    done
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "→ apps"
pnpm --filter @mi-pasaporte/consumer dev >"$LOGS/consumer.log" 2>&1 &
PIDS+=($!)
pnpm --filter @mi-pasaporte/merchant dev >"$LOGS/merchant.log" 2>&1 &
PIDS+=($!)

wait_health() {
  local name="$1" url="$2"
  for _ in $(seq 1 120); do
    curl -fsS -o /dev/null --max-time 5 "$url" 2>/dev/null && { echo "  ok $name"; return 0; }
    sleep 1
  done
  tail -20 "$LOGS/$name.log" >&2
  abort "$name no respondio en 120 s (.dev-local/$name.log)"
}
wait_health consumer http://localhost:3200/api/health
wait_health merchant http://localhost:3201/api/health

echo "→ tunel"
tools/tunnel/up.sh >"$LOGS/tunnel.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 30); do
  grep -q "Registered tunnel connection" "$LOGS/tunnel.log" 2>/dev/null && break
  sleep 1
done
grep -q "Registered tunnel connection" "$LOGS/tunnel.log" || { tail -20 "$LOGS/tunnel.log" >&2; abort "el tunel no conecto (.dev-local/tunnel.log)"; }
for url in https://dev-my.checkpass.club/api/health https://dev-business.checkpass.club/api/health; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$url" || true)"
  echo "  $code $url"
done

cat <<'EOF'

Listo. Ambiente local arriba (Ctrl+C para apagar):
  Comercio:  https://dev-business.checkpass.club/es/business/onboarding
  Cliente:   https://dev-my.checkpass.club
  Link de login del comercio (email local): pnpm dev:link
  Logs:      .dev-local/{merchant,consumer,tunnel,db}.log
EOF

while :; do
  for pid in "${PIDS[@]}"; do
    kill -0 "$pid" 2>/dev/null || { echo "un proceso termino solo; ver .dev-local/*.log" >&2; exit 1; }
  done
  sleep 2
done
