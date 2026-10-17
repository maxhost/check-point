import type { DbTransaction } from "@mi-pasaporte/db";
import { sql } from "drizzle-orm";
export async function historicalHandlerKey(
  tx: DbTransaction,
  subscriberId: string,
  eventType: string,
): Promise<string | null> {
  const exists = await tx.execute(
    sql`select to_regclass('core.historical_event_handler') is not null as ready`,
  );
  if (!exists.rows[0]?.ready) return null;
  const result = await tx.execute(
    sql`select handler_key from core.historical_event_handler where subscriber_id=${subscriberId} and event_type=${eventType}`,
  );
  return (result.rows[0]?.handler_key as string) ?? null;
}
