#!/usr/bin/env bash
# `pnpm dev:link` — el ultimo link de login del comercio que "mando" el email local
# (`EMAIL_PROVIDER=console` lo imprime en el log de merchant que escribe `pnpm dev:local`).
set -euo pipefail
cd "$(dirname "$0")/../.."
LOG=.dev-local/merchant.log
[[ -f "$LOG" ]] || { echo "ABORTADO: no hay $LOG (arranca con pnpm dev:local)" >&2; exit 1; }
link="$(grep -oE 'https?://[^ '"'"'"]+/api/merchant/auth/magic-link\?token=[A-Za-z0-9_-]+' "$LOG" | tail -1 || true)"
[[ -n "$link" ]] || { echo "Todavia no hay link: pedi el acceso en la pantalla de login y reintenta." >&2; exit 1; }
echo "$link"
