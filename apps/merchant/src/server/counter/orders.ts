import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { orders } from "../schema";
import { rowsOf } from "./core";

export type GrantItem = {
  productId: string | null;
  nameSnapshot: string;
  unitPrice: string; // numeric(12,2) string
  quantity: number;
  lineTotal: string; // numeric(12,2) string
};

export type PersistGrantInput = {
  businessId: string;
  locationId: string | null;
  programId: string;
  membershipId: string;
  consumerId: string;
  mode: "detailed" | "quick";
  total: string; // numeric(12,2) string
  currencyCode: string;
  note: string | null;
  accrualKind: "points" | "stamps";
  units: number;
  createdByUserId: string;
  clientRequestId: string;
  items: GrantItem[];
};

export type GrantedOrder = {
  id: string;
  unitsGranted: number;
  balanceAfter: number;
  accrualKind: string;
};

/** A `(VALUES …)` list for the order items, every column explicitly cast. */
function itemValuesSql(items: GrantItem[]) {
  return sql.join(
    items.map(
      (it) =>
        sql`(${it.productId}::uuid, ${it.nameSnapshot}::text, ${it.unitPrice}::numeric, ${it.quantity}::integer, ${it.lineTotal}::numeric)`,
    ),
    sql`, `,
  );
}

function toGrantedOrder(row: Record<string, unknown>): GrantedOrder {
  return {
    id: String(row.id),
    unitsGranted: Number(row.units_granted),
    balanceAfter: Number(row.balance_after),
    accrualKind: String(row.accrual_kind),
  };
}

/**
 * Atomic, idempotent grant (spec 0030) in one statement:
 *
 *  1. `bumped` increments the membership balance (points or stamps) — but only when
 *     NO order with this `(business_id, client_request_id)` exists yet. Under exact
 *     concurrency the second writer blocks on the row lock and, after the first
 *     commits, re-evaluates its `NOT EXISTS` qual (EvalPlanQual) against the now-present
 *     order → skips the bump. So the balance is never double-incremented.
 *  2. `ins` inserts the order FROM `bumped`, snapshotting `balance_after` from the new
 *     balance. `ON CONFLICT DO NOTHING` makes a retry insert nothing.
 *  3. `items` inserts the detailed lines FROM `ins` (only when a new order was created).
 *
 * When the statement returns no row (retry/idempotent hit), the caller rereads and
 * returns the existing order via {@link readOrderByRequest} — no re-grant.
 */
export async function persistGrant(
  input: PersistGrantInput,
): Promise<GrantedOrder | null> {
  const pointsDelta = input.accrualKind === "points" ? input.units : 0;
  const stampsDelta = input.accrualKind === "stamps" ? input.units : 0;
  const itemsCte = input.items.length
    ? sql`, items AS (
        INSERT INTO core.order_item
          (order_id, product_id, name_snapshot, unit_price_snapshot, quantity, line_total)
        SELECT ins.id, v.product_id, v.name_snapshot, v.unit_price, v.quantity, v.line_total
        FROM ins
        CROSS JOIN (VALUES ${itemValuesSql(input.items)})
          AS v(product_id, name_snapshot, unit_price, quantity, line_total)
      )`
    : sql``;

  const result = await getDb().execute(sql`
    WITH bumped AS (
      UPDATE consumer.program_membership
      SET points_balance = points_balance + ${pointsDelta},
          stamps_count = stamps_count + ${stampsDelta}
      WHERE id = ${input.membershipId}
        AND NOT EXISTS (
          SELECT 1 FROM core."order"
          WHERE business_id = ${input.businessId}
            AND client_request_id = ${input.clientRequestId}
        )
      RETURNING points_balance, stamps_count
    ),
    ins AS (
      INSERT INTO core."order"
        (business_id, location_id, program_id, membership_id, consumer_id,
         mode, total, currency_code, note, accrual_kind, units_granted,
         balance_after, created_by_user_id, client_request_id)
      SELECT ${input.businessId}::uuid, ${input.locationId}::uuid,
             ${input.programId}::uuid, ${input.membershipId}::uuid,
             ${input.consumerId}::uuid, ${input.mode}::text,
             ${input.total}::numeric, ${input.currencyCode}::text,
             ${input.note}::text, ${input.accrualKind}::text,
             ${input.units}::integer,
             (CASE WHEN ${input.accrualKind} = 'points'
                   THEN bumped.points_balance ELSE bumped.stamps_count END)::integer,
             ${input.createdByUserId}::text, ${input.clientRequestId}::uuid
      FROM bumped
      ON CONFLICT (business_id, client_request_id) DO NOTHING
      RETURNING id, units_granted, balance_after, accrual_kind
    )${itemsCte}
    SELECT id, units_granted, balance_after, accrual_kind FROM ins
  `);

  const [row] = rowsOf(result) as Record<string, unknown>[];
  return row ? toGrantedOrder(row) : null;
}

/** Rereads an order by its idempotency key (the retry / concurrent-loser path). */
export async function readOrderByRequest(
  businessId: string,
  clientRequestId: string,
): Promise<GrantedOrder | null> {
  const [row] = await getDb()
    .select({
      id: orders.id,
      unitsGranted: orders.unitsGranted,
      balanceAfter: orders.balanceAfter,
      accrualKind: orders.accrualKind,
    })
    .from(orders)
    .where(
      and(
        eq(orders.businessId, businessId),
        eq(orders.clientRequestId, clientRequestId),
      ),
    )
    .limit(1);
  return row ?? null;
}
