#!/usr/bin/env bash
# ADR0144/spec0225: own dependencies, explicit base, no production env symlinks.
# tools/worktree-new.sh NAME [BASE=dev] [ROOT=${TMPDIR}/checkpass-factory]
set -euo pipefail
name="${1:-}"
case "$name" in ""|*/*|*" "*|.*) echo "Use NAME without slashes/spaces" >&2; exit 1;; esac
root="$(git rev-parse --show-toplevel)"
base="$(git rev-parse "${2:-dev}^{commit}")"
workspace_root="${3:-${TMPDIR:-/tmp}/checkpass-factory}"
mkdir -p "$workspace_root"
dest="$workspace_root/$name"
[ ! -e "$dest" ] || { echo "Worktree already exists: $dest" >&2; exit 1; }
[ -d "$root/.pnpm-store" ] || { echo "Package cache missing" >&2; exit 1; }
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
. "$NVM_DIR/nvm.sh"
nvm use >/dev/null
before="$(shasum "$root/node_modules/.modules.yaml")"
git worktree add -b "$name" "$dest" "$base"
ln -s "$root/.pnpm-store" "$dest/.pnpm-store"
(cd "$dest" && pnpm install --offline --frozen-lockfile)
[ "$before" = "$(shasum "$root/node_modules/.modules.yaml")" ] || { echo "Main dependencies changed" >&2; exit 1; }
# Configuration must be assigned explicitly. Never link/copy .env or .env.prod.local.
echo "Worktree ready: $dest (base $base; test environment not inherited)"
