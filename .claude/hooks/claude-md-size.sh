#!/usr/bin/env bash
# Stop — bloquea el fin del turno si CLAUDE.md volvio a crecer arriba de 200 lineas.
#
# POR QUE EXISTE (ADR 0069 / spec 0066): CLAUDE.md llego a 696 lineas y 61 KB cargados en
# CADA request. La doc oficial lo nombra como failure pattern — "if your CLAUDE.md is too
# long, Claude ignores half of it because important rules get lost in the noise" — y el
# owner puso el techo en 200. Sin un guard, el archivo vuelve a crecer solo: cada sesion
# agrega "una linea mas" y ninguna lo mide.
#
# POR QUE Stop Y NO PostToolUse: file-size.sh es PostToolUse (Write|Edit) y por eso es
# CIEGO a una edicion hecha por Bash (heredoc, sed, un script) — que es justo como se
# edito este archivo en la spec 0066. Stop mira el estado final del arbol, no la
# herramienta que lo produjo.
#
# LO QUE NO HACE, declarado: no mide tokens ni bytes, mide LINEAS, que es la unidad en la
# que se escribio la decision del owner. Un CLAUDE.md de 200 lineas larguisimas lo pasa.
# Y no mira los destinos (skills, docs/LECCIONES.md) a proposito: esos se cargan on demand
# y no pagan en cada request.
#
# QUE HACER cuando muerde: no borres — MUDA. Regla operativa corta -> queda; chequeable con
# un comando -> hook; protocolo o gotcha de dominio -> skill en .claude/skills/; el caso
# historico con su evidencia -> docs/LECCIONES.md. Y corré tools/claude-md-coverage.sh para
# probar que la mudanza no perdio nada.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

LIMIT=200
f="CLAUDE.md"
[ -f "$f" ] || exit 0

n=$(wc -l < "$f" | tr -d ' ')
[ "$n" -le "$LIMIT" ] && exit 0

{
  printf 'CLAUDE.md tiene %s lineas (limite %s, ADR 0069).\n\n' "$n" "$LIMIT"
  echo "Se carga entero en CADA request: arriba del techo las reglas se pierden en el ruido."
  echo "No borres, MUDA:"
  echo "  - protocolo de verificacion o gotcha de un dominio -> .claude/skills/<skill>/SKILL.md"
  echo "  - el caso historico con su fecha y su evidencia     -> docs/LECCIONES.md"
  echo "  - lo chequeable con un comando                      -> un hook"
  echo
  echo "Despues corré tools/claude-md-coverage.sh: prueba que no se perdio ningun bloque."
} >&2
exit 2
