#!/usr/bin/env bash
# Prueba que la poda de CLAUDE.md (spec 0066) no perdio una sola regla.
#
# QUE ASEVERA: cada bloque (parrafo separado por linea en blanco) del CLAUDE.md de
# referencia aparece VERBATIM —modulo espacios y saltos de linea— en alguno de los
# destinos vivos: el CLAUDE.md nuevo, docs/LECCIONES.md o las skills de .claude/skills/.
#
# POR QUE ASI Y NO "por reglas": definir "una regla" a ojo es lo que permite perder media.
# El bloque es la unidad que se movio, y el verbatim es lo unico que no admite interpretacion.
# El costo de esta eleccion es que lo que se REESCRIBE (en vez de mudarse) sale reportado
# como perdido — a proposito: si una regla se condenso en CLAUDE.md, su version larga tiene
# que seguir existiendo en LECCIONES o en una skill, que es justamente lo que se quiere.
#
# NO CUENTA docs/archivo/: una copia del archivo viejo haria pasar esto trivialmente.
#
# Uso:  tools/claude-md-coverage.sh [ref-de-git]
#       sin argumento usa el baseline commiteado; con ref usa `git show <ref>:CLAUDE.md`.
# Sale 2 y lista los bloques faltantes si perdio algo.

set -uo pipefail
cd "$(dirname "$0")/.."

BASE_FILE="docs/archivo/CLAUDE-2026-09-16-pre-poda.md"
old_tmp=$(mktemp)
new_tmp=$(mktemp)
trap 'rm -f "$old_tmp" "$new_tmp"' EXIT

if [ $# -ge 1 ]; then
  git show "$1:CLAUDE.md" > "$old_tmp" || exit 2
else
  [ -f "$BASE_FILE" ] || { echo "falta el baseline $BASE_FILE" >&2; exit 2; }
  cat "$BASE_FILE" > "$old_tmp"
fi

cat CLAUDE.md docs/LECCIONES.md .claude/skills/*/SKILL.md > "$new_tmp" 2>/dev/null

node -e '
  const fs = require("fs");
  const old = fs.readFileSync(process.argv[1], "utf8");
  const hay = fs.readFileSync(process.argv[2], "utf8");
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const haystack = norm(hay);
  const blocks = old.split(/\n\s*\n/).map(norm).filter((b) => b.length > 0);
  const missing = blocks.filter((b) => !haystack.includes(b));
  console.log(`bloques en el CLAUDE.md de referencia: ${blocks.length}`);
  console.log(`cubiertos en los destinos vivos:       ${blocks.length - missing.length}`);
  if (missing.length) {
    console.log(`\nFALTAN ${missing.length}:`);
    for (const b of missing) console.log("  - " + b.slice(0, 120) + (b.length > 120 ? " …" : ""));
    process.exit(2);
  }
  console.log("\nOK: no se perdio ningun bloque.");
' "$old_tmp" "$new_tmp"
