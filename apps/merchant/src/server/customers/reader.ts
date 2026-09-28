import { type SQL, sql } from "drizzle-orm";
import { type DbTransaction, withDbTransaction } from "../db";
import { rowsOf } from "../counter/core";

/** The operational program of the business (at most one, `core_loyalty_program_one_operational`). */
export type OperationalProgram = { id: string; kind: string } | null;

export type CustomerReader = {
  /** Every statement of the listing goes through here: it runs as `customer_reader`. */
  execute(query: SQL): Promise<Record<string, unknown>[]>;
  businessId: string;
  program: OperationalProgram;
};

/**
 * THE ONLY DOOR TO `core.business_customer` FOR THE MERCHANT (spec 0108 / ADR 0100 §3).
 *
 * One transaction that, in this order:
 *  1. resolves the operational program (id and `kind`) AS THE APP'S ROLE — the restricted role
 *     cannot read `core.loyalty_program`;
 *  2. `SET LOCAL ROLE customer_reader` — no BYPASSRLS, only `business_customer` and the balance
 *     columns of `program_membership`, and RLS by `app.business_id` on both;
 *  3. fixes `app.business_id` with `set_config(…, true)` (transaction-local);
 *  4. and only then runs `fn`.
 *
 * `SET LOCAL` and the local `set_config` die with the transaction, so nothing leaks to another
 * request of the WebSocket pool (ADR 0067). The business comes from the guard, never from the
 * request.
 */
export async function withCustomerReader<T>(
  businessId: string,
  fn: (reader: CustomerReader) => Promise<T>,
): Promise<T> {
  return withDbTransaction(async (tx: DbTransaction) => {
    const [program] = rowsOf(
      await tx.execute(sql`
        SELECT id, kind FROM core.loyalty_program
        WHERE business_id = ${businessId}::uuid AND status IN ('active', 'closing')
        LIMIT 1`),
    ) as Array<{ id: string; kind: string }>;
    await tx.execute(sql`SET LOCAL ROLE customer_reader`);
    await tx.execute(
      sql`SELECT set_config('app.business_id', ${businessId}, true)`,
    );
    return fn({
      businessId,
      program: program ? { id: String(program.id), kind: program.kind } : null,
      execute: async (query) =>
        rowsOf(await tx.execute(query)) as Record<string, unknown>[],
    });
  });
}
