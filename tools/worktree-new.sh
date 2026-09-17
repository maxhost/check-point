#!/usr/bin/env bash
# Crea un worktree USABLE: con su propio node_modules, instalado 100% offline.
#
# POR QUE EXISTE (spec 0066 / ADR 0069): hasta hoy los worktrees de este repo estaban
# documentados como trampa. Un worktree con el node_modules SYMLINKEADO al repo real
# hace que `pnpm run` y `pnpm exec` adentro disparen runDepsStatusCheck -> pnpm install
# -> **intenta purgar las dependencias posta**. Paso dos veces en la spec 0053; nadie las
# perdio porque sin TTY pnpm aborta, o sea que lo que salvo el arbol fue la suerte.
#
# La salida estaba a mano y no se habia visto: **el store de pnpm ya vive dentro del repo**
# (`.pnpm-store`, spec 0035), asi que cada worktree puede instalar lo suyo sin red.
#
# QUE COMPRA: que la muerte de un agente sea un problema de SU worktree y no del arbol de
# todos. Hoy una mutacion abandonada es indistinguible de un bug real y obliga a auditar el
# arbol entero antes de seguir.
#
# DECISION MEDIDA: el store se ENLAZA, no se copia. Son 643 MB (`du -sh .pnpm-store`);
# copiarlo por worktree es absurdo, y el store de pnpm es content-addressable — varios
# installs leyendo de el es el caso normal.
#
# Uso:  tools/worktree-new.sh <nombre>        (rama y carpeta toman ese nombre)
# Salida: la ruta del worktree listo, o exit != 0 con el motivo.

set -uo pipefail

name="${1:-}"
case "$name" in
  "" | */* | *" "*) echo "uso: tools/worktree-new.sh <nombre-sin-barras-ni-espacios>" >&2; exit 1 ;;
esac

root=$(git rev-parse --show-toplevel) || exit 1
cd "$root"
dest="$(cd "$root/.." && pwd)/$(basename "$root")-wt/$name"

[ -e "$dest" ] && { echo "ya existe $dest" >&2; exit 1; }
[ -d "$root/.pnpm-store" ] || { echo "no hay $root/.pnpm-store: el install offline no va a poder" >&2; exit 1; }

# El oraculo de aislamiento: si al terminar esto cambio, el worktree se comio las
# dependencias del repo principal y hay que saberlo ACA, no tres horas despues.
main_state="$root/node_modules/.modules.yaml"
before=""
[ -f "$main_state" ] && before=$(shasum "$main_state" | cut -d' ' -f1)

echo "==> git worktree add -b $name $dest"
git worktree add -b "$name" "$dest" || exit 1

echo "==> enlazando .pnpm-store (643 MB, no se copia)"
ln -s "$root/.pnpm-store" "$dest/.pnpm-store"

# Los .env de la raiz son gitignored, asi que el worktree nace sin ellos y cualquier test
# de integracion quedaria en `skipped` CON EL RUN EN VERDE — que se lee identico a un PASS.
for f in "$root"/.env "$root"/.env.*; do
  [ -f "$f" ] || continue
  ln -s "$f" "$dest/$(basename "$f")" 2>/dev/null && echo "    enlazado $(basename "$f")"
done

echo "==> pnpm install --offline (node_modules propio del worktree)"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null 2>&1
(cd "$dest" && pnpm install --offline) || {
  echo "!! el install offline fallo. Si se queja de un paquete que no esta en el store, el" >&2
  echo "   lockfile cambio en otro entorno: corré 'pnpm fetch' EN EL REPO PRINCIPAL (ojo:" >&2
  echo "   purga node_modules) y volvé a intentar." >&2
  exit 1
}

echo "==> verificando que el repo principal no se toco"
after=""
[ -f "$main_state" ] && after=$(shasum "$main_state" | cut -d' ' -f1)
if [ "$before" != "$after" ]; then
  echo "!! ALARMA: node_modules/.modules.yaml del repo principal CAMBIO ($before -> $after)." >&2
  echo "   Es exactamente lo que este script existe para evitar. No sigas: revisá el worktree." >&2
  exit 2
fi
echo "    ok: $main_state intacto ($before)"

echo
echo "worktree listo: $dest"
echo "  cd $dest && pnpm run typecheck"
echo "para borrarlo:  git worktree remove $dest && git branch -D $name"
