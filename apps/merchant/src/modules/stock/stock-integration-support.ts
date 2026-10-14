import { eq, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { stockItemLocations, stockMovements } from "@mi-pasaporte/db/schema";

/** Spec 0210 — lecturas POR SQL de las suites de Stock (la respuesta de la API no es el oraculo).
 * Sin `expect`: los oraculos viven en los tests. */

export async function lastUnitCost(itemId: string) {
  const [row] = await getDb()
    .select({ cost: stockItemLocations.lastUnitCost })
    .from(stockItemLocations)
    .where(eq(stockItemLocations.itemId, itemId));
  return row?.cost ?? null;
}

/** Espera hasta ver `n` backends bloqueados por un lock en una consulta de `stock`. Si no llegan,
 * falla: la carrera no se armo y el test no probaria nada. */
export async function waitForLockWaiters(n: number): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = await getDb().execute<{ waiting: number }>(
      sql`select count(*)::int as waiting from pg_stat_activity
          where wait_event_type = 'Lock' and query ilike '%"stock"%'`,
    );
    if ((result.rows[0]?.waiting ?? 0) >= n) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`waitForLockWaiters: no hubo ${n} esperando en 30 s`);
}

export async function onHandSql(itemId: string): Promise<string> {
  const rows = await getDb()
    .select({ q: stockMovements.quantity })
    .from(stockMovements)
    .where(eq(stockMovements.itemId, itemId));
  const milli = rows.reduce(
    (acc, r) => acc + Math.round(Number(r.q) * 1000),
    0,
  );
  return (milli / 1000).toFixed(3);
}
