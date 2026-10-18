import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import { assertNotProdOutsideProduction, configureNeonForLocal } from "./local";
import * as schema from "./schema";
import { instrumentPosPool } from "./pos-measurement";

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no está configurada.");
  assertNotProdOutsideProduction(connectionString);
  configureNeonForLocal(connectionString);
  return drizzle(neon(connectionString), { schema });
}

/** Interactive transaction for flows that must hold a row/advisory lock across steps. */
export type DbTransaction = Parameters<
  Parameters<ReturnType<typeof drizzleWs>["transaction"]>[0]
>[0];

// Neon's WebSocket pool needs a WebSocket constructor. Node 22+ exposes a global one;
// set it defensively so the interactive-transaction path resolves in every runtime.
if (!neonConfig.webSocketConstructor && typeof WebSocket !== "undefined")
  neonConfig.webSocketConstructor =
    WebSocket as unknown as typeof neonConfig.webSocketConstructor;

// One pooled WebSocket connection per connection string, reused across warm serverless
// invocations. Opening (and ending) a Pool per call added a socket handshake to every
// request — and a single request may run several transactions.
const pools = new Map<string, Pool>();
function poolFor(connectionString: string, connectionTimeoutMs?: number): Pool {
  if (connectionTimeoutMs !== undefined) {
    const remaining = connectionTimeoutMs;
    connectionTimeoutMs =
      [1, 50, 100, 250, 500, 1000].filter((n) => n <= remaining).at(-1) ?? 1;
  }
  const key =
    connectionString +
    (connectionTimeoutMs ? `:timeout-${connectionTimeoutMs}` : "");
  let pool = pools.get(key);
  if (!pool) {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: connectionTimeoutMs,
    });
    // Idle errors have no active query to reject. Handle every pool without logging the
    // driver error/client context, which may contain connection credentials. Active
    // query failures still propagate through their transaction promise below.
    pool.on("error", () => {});
    instrumentPosPool(pool);
    pools.set(key, pool);
  }
  return pool;
}

export async function withDbTransaction<T>(
  work: (tx: DbTransaction) => Promise<T>,
  options?: { connectionTimeoutMs?: number },
): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no está configurada.");
  assertNotProdOutsideProduction(connectionString);
  configureNeonForLocal(connectionString);
  const pool = poolFor(connectionString, options?.connectionTimeoutMs);
  if (!options?.connectionTimeoutMs)
    return drizzleWs(pool, { schema }).transaction(work);
  const client = await pool.connect();
  const onError = () => {};
  client.on("error", onError);
  let failed = false;
  try {
    return await drizzleWs(client, { schema }).transaction(work);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    client.release(failed);
    client.removeListener("error", onError);
  }
}
