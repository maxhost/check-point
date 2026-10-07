/**
 * Base local que replica Neon (spec 0167, ADR 0126) y el candado contra PROD fuera de produccion.
 *
 * - `configureNeonForLocal`: con un host local, el driver de Neon habla con el proxy de
 *   `tools/local-db/compose.yaml` (HTTP `/sql` y WebSocket en el puerto 4444). Con cualquier otro
 *   host no toca `neonConfig`: en Vercel el driver sigue igual que siempre.
 * - `assertNotProdOutsideProduction`: fuera de `NODE_ENV=production`, una `DATABASE_URL` que apunta
 *   al endpoint de PROD tira antes de abrir conexion. PROD tiene datos reales desde el 2026-10-07.
 *
 * Autocontenido (solo `node:crypto` y el driver): lo importan tambien los scripts de
 * `db:local:*`, que corren con Node 24 sin bundler.
 */
import { createHash } from "node:crypto";
import { neonConfig, type Pool } from "@neondatabase/serverless";

/**
 * `sha256(endpoint id de la rama main de Neon)[0..12]`: el endpoint read-write de PROD
 * (proyecto `red-violet-38772073`), calculado por el orquestador el 2026-10-07. No es un secreto;
 * el repo nunca guarda el host ni el id en claro. `tools/neon-test.sh` la lee de aca con `rg`.
 */
export const PROD_DB_ENDPOINT_SHA12 = "bf545fdce7a0";

const LOCAL_HOSTS = new Set(["db.localtest.me", "localhost", "127.0.0.1"]);
const LOCAL_PROXY_PORT = 4444;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    // El TypeError de `new URL` lleva la entrada en `.input`: con la contraseña adentro.
    throw new Error("DATABASE_URL no es una URL valida.");
  }
}

/** `true` solo si el host de la URL es la base local (`db.localtest.me`, `localhost`, `127.0.0.1`). */
export function isLocalDbHost(url: string): boolean {
  return LOCAL_HOSTS.has(hostOf(url));
}

let configuredHost: string | null = null;

/** Con un host local fija `neonConfig` para el proxy (una vez por proceso). Con otro host, no hace nada. */
export function configureNeonForLocal(url: string): void {
  const host = hostOf(url);
  if (!LOCAL_HOSTS.has(host) || configuredHost === host) return;
  neonConfig.fetchEndpoint = `http://${host}:${LOCAL_PROXY_PORT}/sql`;
  neonConfig.wsProxy = `${host}:${LOCAL_PROXY_PORT}/v2`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
  configuredHost = host;
}

/**
 * El endpoint de Neon de una URL: el primer segmento DNS del host sin `-pooler` ni `-rvr` (en
 * cualquier orden). Neon publica cuatro hosts por endpoint (directo, `-pooler`, `-rvr`,
 * `-rvr-pooler`) y todos llegan a la misma base: una huella del host completo dejaria pasar variantes.
 */
export function neonEndpointId(url: string): string {
  let id = hostOf(url).split(".")[0] ?? "";
  for (;;) {
    const next = id.replace(/-(pooler|rvr)$/, "");
    if (next === id) return id;
    id = next;
  }
}

function sha12(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

/**
 * Fuera de produccion, rechaza una URL cuyo endpoint es el de PROD. `prodSha12` es inyectable para
 * poder testear sin el host real; por defecto, `PROD_DB_ENDPOINT_SHA12`.
 */
export function assertNotProdOutsideProduction(
  url: string,
  env: { NODE_ENV?: string } = process.env,
  prodSha12: string = PROD_DB_ENDPOINT_SHA12,
): void {
  if (env.NODE_ENV === "production") return;
  if (sha12(neonEndpointId(url)) === prodSha12)
    throw new Error("DATABASE_URL apunta a PROD fuera de produccion");
}

// ── Para los scripts `db:local:*` (migrate-local.ts, seed-local.ts) ──────────────────────────────

/**
 * La `DATABASE_URL` del entorno si es local, con `neonConfig` listo para el proxy. Si falta o el
 * host no es local, imprime el motivo (sin la URL) y sale con exit 1 ANTES de conectar.
 */
export function localDbUrlOrExit(script: string): string {
  const url = process.env.DATABASE_URL;
  let local = false;
  try {
    local = !!url && isLocalDbHost(url);
  } catch {
    local = false;
  }
  if (!url || !local) {
    console.error(
      `${script}: ABORTADO — DATABASE_URL ${url ? "no apunta a la base local" : "no esta definida"} ` +
        "(db.localtest.me, localhost o 127.0.0.1). Este script nunca corre contra Neon.",
    );
    process.exit(1);
  }
  if (!neonConfig.webSocketConstructor && typeof WebSocket !== "undefined")
    neonConfig.webSocketConstructor =
      WebSocket as unknown as typeof neonConfig.webSocketConstructor;
  configureNeonForLocal(url);
  return url;
}

/**
 * Un `Pool` sin listener de `error` vuelca su config —con la contraseña— al fallar (gotcha de la
 * spec 0118). Imprime solo codigo y mensaje.
 */
export function quietPool(pool: Pool): Pool {
  pool.on("error", (e: Error & { code?: string }) =>
    console.error(`pool error ${e.code ?? ""} ${e.message}`),
  );
  return pool;
}
