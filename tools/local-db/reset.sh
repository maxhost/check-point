#!/usr/bin/env bash
# Borra la base local (contenedores + volumen) y la levanta desde cero (spec 0167 §1).
# Solo el proyecto `checkpass-local`: no toca ningun otro contenedor ni volumen de Docker.
set -euo pipefail

cd "$(dirname "$0")"
docker compose -f compose.yaml down -v
exec ./up.sh
