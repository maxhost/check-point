import { sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
/** Shared with the migration. The location decision cannot race ALTER SET SCHEMA. */
export async function paymentStorageReady(tx: DbTransaction) {
  await tx.execute(sql`select pg_advisory_xact_lock_shared(2350150)`);
  const result = await tx.execute(
    sql`select to_regclass('core.payment_method') is not null as ready`,
  );
  return result.rows[0]?.ready === true;
}

/** Full administration/legacy reader only becomes ready after the origin metadata migration. */
export async function businessStorageReady(tx: DbTransaction) {
  if (!(await paymentStorageReady(tx))) return false;
  const result = await tx.execute(
    sql`select exists(select 1 from information_schema.columns where table_schema='core' and table_name='historical_event_handler' and column_name='source_provider_id') as ready`,
  );
  return result.rows[0]?.ready === true;
}
