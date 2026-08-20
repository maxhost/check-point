import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no está configurada.");
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
// request — and a single recovery request runs several transactions.
const pools = new Map<string, Pool>();
function poolFor(connectionString: string): Pool {
  let pool = pools.get(connectionString);
  if (!pool) {
    pool = new Pool({ connectionString });
    pools.set(connectionString, pool);
  }
  return pool;
}

export async function withDbTransaction<T>(
  work: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no está configurada.");
  return drizzleWs(poolFor(connectionString), { schema }).transaction(work);
}
