#!/usr/bin/env bash
# `pnpm dev:link` — el ultimo acceso del comercio que "mando" el email local
# (`EMAIL_PROVIDER=console` lo imprime en el log de merchant que escribe `pnpm dev:local`):
# el CODIGO de login (spec 0202) y el LINK del alta / verificacion del email.
set -euo pipefail
cd "$(dirname "$0")/../.."
LOG=.dev-local/merchant.log
[[ -f "$LOG" ]] || { echo "ABORTADO: no hay $LOG (arranca con pnpm dev:local)" >&2; exit 1; }
# `email_console` loguea `to:` y despues `subject:`; el codigo viaja en el asunto.
code="$(awk -F"'" '/^ *to: /{to=$2} /^ *subject: .*CheckPass Club: [0-9]{6}/{n=split($2,p," "); last="Codigo de login para " to ": " p[n]} END{print last}' "$LOG")"
link="$(grep -oE 'https?://[^ '"'"'"]+/api/merchant/auth/magic-link\?token=[A-Za-z0-9_-]+' "$LOG" | tail -1 || true)"
[[ -n "$code" || -n "$link" ]] || { echo "Todavia no hay codigo ni link: pedi el acceso en la pantalla y reintenta." >&2; exit 1; }
[[ -n "$code" ]] && echo "$code"
[[ -n "$link" ]] && echo "Ultimo link (alta / verificacion): $link"
exit 0
