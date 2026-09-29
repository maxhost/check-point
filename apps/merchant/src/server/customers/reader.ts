import { type SQL, sql } from "drizzle-orm";
import { type DbTransaction, withDbTransaction } from "../db";
import { rowsOf } from "../counter/core";

export type CustomerReader = {
  /** Every statement of the listing goes through here: it runs as `customer_reader`. */
  execute(query: SQL): Promise<Record<string, unknown>[]>;
  businessId: string;
};

/**
 * THE ONLY DOOR TO `core.business_customer` FOR THE MERCHANT (spec 0108 / ADR 0100 §3, trips
 * cut by spec 0109 / ADR 0101 §3).
 *
 * One transaction that, in ONE statement, becomes `customer_reader` (`set_config('role', …,
 * true)`, the same as `SET LOCAL ROLE`: no BYPASSRLS, only the projection, its count, the
 * balance columns of `program_membership` and four columns of `loyalty_program`, all with RLS
 * by `app.business_id`) and fixes `app.business_id` — and only then runs `fn`. The operational
 * program is resolved by `fn`'s own statement, AS the restricted role: nothing runs as the
 * app's role between `BEGIN` and `COMMIT`.
 *
 * Both settings are transaction-local and die with it, so nothing leaks to another request of
 * the WebSocket pool (ADR 0067). The business comes from the guard, never from the request.
 */
export async function withCustomerReader<T>(
  businessId: string,
  fn: (reader: CustomerReader) => Promise<T>,
): Promise<T> {
  return withDbTransaction(async (tx: DbTransaction) => {
    await tx.execute(sql`
      SELECT set_config('role', 'customer_reader', true),
             set_config('app.business_id', ${businessId}, true)`);
    return fn({
      businessId,
      execute: async (query) =>
        rowsOf(await tx.execute(query)) as Record<string, unknown>[],
    });
  });
}
