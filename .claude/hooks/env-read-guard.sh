#!/usr/bin/env bash
# PreToolUse(Bash): bloquea leer un `.env` con herramientas de texto que imprimen su contenido.
#
# POR QUE EXISTE (2026-10-07, LECCIONES.md): para listar SOLO los nombres de las variables se corrio
# `cut -d= -f1 apps/consumer/.env.local`. Ese archivo tiene valores de VARIAS lineas (el JSON del
# service account de Google Wallet, la clave PEM de Sign in with Apple): `cut` corta por linea, asi
# que las lineas de continuacion salieron enteras y dos claves privadas quedaron en el chat.
# `CLAUDE.md` ya decia «filtrar por nombre de variable no alcanza»; no alcanzo como texto.
#
# QUE MIRA: el texto del comando. Si nombra un `.env` real (no `.env.example`) junto con una
# herramienta que vuelca lineas (cat, head, tail, cut, awk, sed, grep, less, more, sort, uniq, tr,
# strings, xxd, od, bat), bloquea. Los scripts del repo que leen `.env` por dentro
# (`tools/neon-test.sh`) no se ven afectados: su texto no esta en el comando.
#
# LA SALIDA: parsear con un programa que solo emita claves y metadatos, p. ej.
#   node -e 'for (const l of require("fs").readFileSync(F,"utf8").split("\n")) { const m = l.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if (m) console.log(m[1], m[2].length) }'
#
# FALLA CERRADO: sin python3 no puede leer el JSON del tool y sale 2.

set -uo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo "env-read-guard.sh: python3 no esta en el PATH; no puedo revisar el comando." >&2
  exit 2
fi

input="$(cat)"
command="$(printf '%s' "$input" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("command", ""))
except Exception:
    print("__UNPARSEABLE__")')"

if [ "$command" = "__UNPARSEABLE__" ]; then
  echo "env-read-guard.sh: no pude leer el comando del tool." >&2
  exit 2
fi

printf '%s' "$command" | python3 -c '
import re, sys
cmd = sys.stdin.read()
env = re.search(r"(?<![A-Za-z0-9_])\.env(\.(local|production|development|preview|test))?(?![A-Za-z0-9_.-])", cmd)
tool = re.search(r"(^|[\s|;&(`$])(cat|head|tail|cut|awk|sed|grep|egrep|less|more|sort|uniq|tr|strings|xxd|od|bat)(\s|$)", cmd)
sys.exit(1 if env and tool else 0)
'
if [ $? -eq 1 ]; then
  cat >&2 <<'EOF'
env-read-guard.sh: BLOQUEADO — el comando lee un `.env` con una herramienta que imprime lineas.
Los `.env` de este repo tienen valores de varias lineas (JSON, PEM): `cut`/`grep`/`head` filtran por
linea y vuelcan las continuaciones enteras. De un `.env` se imprime la CLAVE y metadatos (largo,
huella sha256[0..12]), nunca el valor (CLAUDE.md §Verificacion). Usa un parser que solo emita claves:
  node -e 'for (const l of require("fs").readFileSync(F,"utf8").split("\n")) { const m = l.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if (m) console.log(m[1], m[2].length) }'
EOF
  exit 2
fi
exit 0
