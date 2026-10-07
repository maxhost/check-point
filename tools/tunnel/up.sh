#!/usr/bin/env bash
# `pnpm dev:tunnel` — levanta el tunel `checkpass-dev` (ADR 0127, spec 0168):
# dev-business.checkpass.club → merchant :3201, dev-my.checkpass.club → consumer :3200.
set -euo pipefail
cd "$(dirname "$0")/../.."

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "ABORTADO: falta cloudflared (docs/runbooks/tunel-dev.md §1)" >&2
  exit 1
fi
if [[ ! -f "$HOME/.cloudflared/cert.pem" ]]; then
  echo "ABORTADO: falta cloudflared tunnel login (runbook §1)" >&2
  exit 1
fi
exec cloudflared tunnel --config tools/tunnel/config.yml run checkpass-dev
