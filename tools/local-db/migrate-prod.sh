#!/usr/bin/env bash
# `pnpm db:migrate:prod` — aplica las migraciones pendientes a PROD con `drizzle-kit migrate`, la
# misma via de siempre (spec 0167 §8, runbook `docs/runbooks/migrar-prod.md`). Paso EXPLICITO del
# owner/orquestador, despues de probar la migracion en local.
#
# La URL de PROD vive SOLO en `packages/db/.env.prod.local` (ignorado por git), como
# `DATABASE_URL_UNPOOLED` (host directo, sin `-pooler`). Nunca se imprime: solo la huella del
# endpoint, para que quien migra vea a que base va antes de que pase nada.
set -euo pipefail

cd "$(dirname "$0")/../.."
# `MIGRATE_PROD_ENV_FILE` existe para probar los rechazos con un archivo temporal.
ENV_FILE="${MIGRATE_PROD_ENV_FILE:-packages/db/.env.prod.local}"
[ -f "$ENV_FILE" ] || { echo "ABORTADO: falta $ENV_FILE (ver docs/runbooks/migrar-prod.md)."; exit 1; }

# Lee la URL con el parser de Node (no imprime el valor) y calcula la huella con la MISMA regla
# que `neonEndpointId` de `packages/db/src/local.ts`.
info="$(node -e '
  // `parseEnv` y no `loadEnvFile`: este ultimo no pisa una variable que ya este en el shell.
  const env = require("node:util").parseEnv(require("node:fs").readFileSync(process.argv[1], "utf8"));
  const url = env.DATABASE_URL_UNPOOLED ?? "";
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch {}
  let id = host.split(".")[0] ?? "";
  for (let next = id; ; id = next) { next = id.replace(/-(pooler|rvr)$/, ""); if (next === id) break; }
  const sha = (v) => require("node:crypto").createHash("sha256").update(v).digest("hex").slice(0, 12);
  console.log([url ? "si" : "no", host.includes("-pooler") ? "si" : "no", id ? sha(id) : "", host ? sha(host) : ""].join(" "));
' "$ENV_FILE")"
read -r has_url pooled endpoint_sha host_sha <<<"$info"

[ "$has_url" = "si" ] || { echo "ABORTADO: DATABASE_URL_UNPOOLED no tiene valor en $ENV_FILE."; exit 1; }
PROD_SHA12="$(sed -nE 's/^export const PROD_DB_ENDPOINT_SHA12 = "([0-9a-f]{12})";$/\1/p' packages/db/src/local.ts | head -n1)"
echo "huella del endpoint: ${endpoint_sha:-?} (PROD: $PROD_SHA12) · huella del host: ${host_sha:-?}"
if [ "$endpoint_sha" != "$PROD_SHA12" ]; then
  echo "ABORTADO: DATABASE_URL_UNPOOLED no es el endpoint de PROD. Este script solo migra PROD;"
  echo "la base local se migra con \`pnpm db:local:migrate\` (tools/local-db/up.sh)."
  exit 1
fi
if [ "$pooled" = "si" ]; then
  echo "ABORTADO: DATABASE_URL_UNPOOLED tiene el host -pooler; drizzle-kit migrate va por el host directo."
  exit 1
fi

DATABASE_URL_UNPOOLED="$(node -e '
  const env = require("node:util").parseEnv(require("node:fs").readFileSync(process.argv[1], "utf8"));
  process.stdout.write(env.DATABASE_URL_UNPOOLED)' "$ENV_FILE")" \
  pnpm --filter @mi-pasaporte/db db:migrate
