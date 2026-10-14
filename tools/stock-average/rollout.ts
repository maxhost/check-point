import { sql } from "drizzle-orm";
import type { DbTransaction } from "../../packages/db/src/client";

/** Seed only after the verified writer cut. Existing markers make resumption idempotent. */
export async function initializeAverageCosts(
  tx: DbTransaction,
  confirmation: { deployedSha: string; oldWritersStopped: boolean },
  businessId?: string,
) {
  if (
    !confirmation.oldWritersStopped ||
    !/^[a-f0-9]{40}$/.test(confirmation.deployedSha)
  )
    throw new Error(
      "Require verified deployed SHA and stopped old purchase writers",
    );
  const scope = businessId ? sql`where business_id=${businessId}::uuid` : sql``;
  // Same hierarchy as purchase/count and consumption: ingredients before ordered pairs.
  await tx.execute(
    sql`select id from stock.item ${scope} order by business_id,id for update`,
  );
  await tx.execute(
    sql`select item_id from stock.item_location ${scope} order by business_id,item_id,location_id for update`,
  );
  const before = await tx.execute(
    sql`select business_id,item_id,location_id,last_unit_cost::text from stock.item_location ${scope} order by business_id,item_id,location_id`,
  );
  const seeded = await tx.execute(sql`update stock.item_location
    set weighted_average_unit_cost=last_unit_cost,weighted_average_initialized_at=now(),updated_at=now()
    where weighted_average_initialized_at is null
    ${businessId ? sql`and business_id=${businessId}::uuid` : sql``}
    returning business_id,item_id,location_id,last_unit_cost::text,weighted_average_unit_cost::text`);
  if (
    seeded.rows.some((r) => r.last_unit_cost !== r.weighted_average_unit_cost)
  )
    throw new Error("Average seed differs from local last cost");
  const after = await tx.execute(
    sql`select business_id,item_id,location_id,last_unit_cost::text from stock.item_location ${scope} order by business_id,item_id,location_id`,
  );
  if (JSON.stringify(before.rows) !== JSON.stringify(after.rows))
    throw new Error("Average seed changed local pairs or last costs");
  return { seeded: seeded.rows.length, pairs: after.rows.length };
}
