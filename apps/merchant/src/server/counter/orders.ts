import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { orders } from "../schema";
import { rowsOf } from "./core";
import { buildTransactionalBody } from "../wallet/push";

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
  /** The `wallet_push_queue` row enqueued in the same tx (spec 0033); null on the
   * idempotent-retry/reread path so no re-dispatch happens. */
  pushQueueId: string | null;
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
    pushQueueId: row.push_queue_id == null ? null : String(row.push_queue_id),
  };
}

/**
 * Grant (spec 0030) in one statement, made idempotent by the unique index (spec 0056):
 *
 *  1. `bumped` increments the membership balance (points or stamps) — but only when
 *     NO order with this `(business_id, client_request_id)` exists yet. **That guard
 *     handles the SEQUENTIAL retry only.** It is an UNCORRELATED `NOT EXISTS`, which
 *     Postgres plans as `InitPlan` + `One-Time Filter`: it is evaluated ONCE, BEFORE the
 *     row lock, so it is NOT re-checked under EvalPlanQual (only a qual living in the
 *     scan's own `Filter` is). Two concurrent writers with the same key therefore both
 *     see "no order" and both bump — see ADR 0054.
 *  2. `ins` inserts the order FROM `bumped`, snapshotting `balance_after` from the new
 *     balance. **No `ON CONFLICT` clause, on purpose (spec 0056):** the concurrent
 *     loser must hit `core_order_business_client_request_unique` and raise `23505`,
 *     which aborts this whole statement — one statement is one implicit transaction, so
 *     the bump in (1) is rolled back with it. That, not (1), is what keeps the balance
 *     from being credited twice under concurrency. `grant.ts` catches the `23505` and
 *     rereads the winner's order via {@link readOrderByRequest}. Swallowing the
 *     conflict with `DO NOTHING` used to hide the extra bump and made the API report a
 *     balance that did not exist.
 *  3. `items` inserts the detailed lines FROM `ins` (only when a new order was created).
 *  4. `pushq` (spec 0033) inserts ONE `wallet_push_queue` `transactional` row FROM
 *     `ins` — so it fires only when a NEW order was created: a grant rollback (including
 *     the `23505` abort above) leaves no push row, and a sequential retry (`bumped`
 *     empty → `ins` empty) never duplicates it. The queued id rides back on the final
 *     SELECT for the inline dispatch.
 *
 * When the statement returns no row (sequential retry / idempotent hit), the caller
 * rereads and returns the existing order via {@link readOrderByRequest} — no re-grant.
 */
export async function persistGrant(
  input: PersistGrantInput,
): Promise<GrantedOrder | null> {
  const pointsDelta = input.accrualKind === "points" ? input.units : 0;
  const stampsDelta = input.accrualKind === "stamps" ? input.units : 0;
  const pushBody = buildTransactionalBody(input.units, input.accrualKind);
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
      RETURNING id, units_granted, balance_after, accrual_kind
    )${itemsCte},
    pushq AS (
      INSERT INTO consumer.wallet_push_queue
        (consumer_id, class, title, body, status, not_before)
      SELECT ${input.consumerId}::uuid, 'transactional'::text,
             COALESCE((SELECT name FROM core.business
                       WHERE id = ${input.businessId}::uuid), 'CheckPass Club'),
             ${pushBody}::text, 'pending'::text, now()
      FROM ins
      RETURNING id
    )
    SELECT ins.id, ins.units_granted, ins.balance_after, ins.accrual_kind,
           pushq.id AS push_queue_id
    FROM ins LEFT JOIN pushq ON true
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
  return row ? { ...row, pushQueueId: null } : null;
}
