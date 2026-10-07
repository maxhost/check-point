#!/usr/bin/env bash
# Oraculo de los roles calcados de PROD contra la base local (spec 0167): corre
# `packages/db/src/local-roles.integration.test.ts`, que sin `LOCAL_DB_INTEGRATION=true` se saltea.
# Necesita la base levantada (`tools/local-db/up.sh`). Las URLs son locales y fijas en el test.
set -euo pipefail

cd "$(dirname "$0")/../.."
LOCAL_DB_INTEGRATION=true pnpm --filter @mi-pasaporte/db exec vitest run src/local-roles.integration.test.ts
