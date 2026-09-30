import { type SQL, sql } from "drizzle-orm";
import { type DbTransaction, getDb } from "@mi-pasaporte/db";
import { rowsOf } from "../counter/core";
import { requireDate } from "../marketing/driver-values";

/**
 * THE WRITES OF `core.business_customer` (spec 0108 / ADR 0100). Every origin writes its row
 * IN THE SAME OPERATION: the two altas and the purchase inside ONE statement (a CTE, so the
 * projection and its origin commit together or not at all), the two counter redemptions inside
 * their own transaction. They run as the app's role, never as `customer_reader`.
 *
 * The name, the search key and the phone are copied from the account IN SQL on every write:
 * `search_name` is `lower(unaccent(display_name))` and `unaccent` goes qualified with its
 * dictionary, so it does not depend on the caller's `search_path`.
 */
const DISPLAY_NAME = sql.raw(`a.first_name || ' ' || a.last_name`);
const SEARCH_NAME = sql.raw(
  `lower(public.unaccent('public.unaccent'::regdictionary, a.first_name || ' ' || a.last_name))`,
);

/**
 * Alta: creates the row, or lowers `enrolled_at` with `least` — a later alta in another program
 * of the same business never moves the first one forward. Never touches `last_visit_at`.
 * `source` exposes `business_id`, `consumer_id`, `enrolled_at`.
 */
export function upsertEnrollmentSql(source: SQL): SQL {
  return sql`INSERT INTO core.business_customer
      (business_id, consumer_id, display_name, search_name, phone_e164, enrolled_at)
    SELECT s.business_id, s.consumer_id, ${DISPLAY_NAME}, ${SEARCH_NAME}, a.phone_e164, s.enrolled_at
    FROM ${source} s
    JOIN consumer.consumer_account a ON a.id = s.consumer_id
    ON CONFLICT (business_id, consumer_id) DO UPDATE
      SET enrolled_at = least(core.business_customer.enrolled_at, excluded.enrolled_at)`;
}

/**
 * Visit (purchase or counter redemption): `last_visit_at = greatest(current, new)`. The row
 * exists since the alta; if it did not (a gap), it is created with the oldest membership of the
 * business as its alta. `source` exposes `business_id`, `consumer_id`, `visited_at`.
 */
export function upsertVisitSql(source: SQL): SQL {
  return sql`INSERT INTO core.business_customer
      (business_id, consumer_id, display_name, search_name, phone_e164, enrolled_at, last_visit_at)
    SELECT s.business_id, s.consumer_id, ${DISPLAY_NAME}, ${SEARCH_NAME}, a.phone_e164,
           coalesce((SELECT min(pm.enrolled_at) FROM consumer.program_membership pm
                     WHERE pm.business_id = s.business_id AND pm.consumer_id = s.consumer_id),
                    s.visited_at),
           s.visited_at
    FROM ${source} s
    JOIN consumer.consumer_account a ON a.id = s.consumer_id
    ON CONFLICT (business_id, consumer_id) DO UPDATE
      SET last_visit_at = greatest(core.business_customer.last_visit_at, excluded.last_visit_at)`;
}

/**
 * A counter redemption, inside ITS transaction: the visit is the `created_at` of the row just
 * inserted in `table` (`core.reward_redemption` or `core.coupon_redemption`).
 */
export async function recordRedemptionVisit(
  tx: DbTransaction,
  table: "reward_redemption" | "coupon_redemption",
  redemptionId: string,
): Promise<void> {
  await tx.execute(
    upsertVisitSql(sql`(
      SELECT r.business_id, r.consumer_id, r.created_at AS visited_at
      FROM ${sql.raw(`core.${table}`)} r
      WHERE r.id = ${redemptionId}::uuid
    )`),
  );
}

export type InsertedMembership = {
  id: string;
  consumerId: string;
  programId: string;
  businessId: string;
  originLocationId: string | null;
  pointsBalance: number;
  stampsCount: number;
  enrolledAt: Date;
};

/**
 * Inserts a membership AND its projection row in ONE statement. **No `ON CONFLICT` on the
 * membership, on purpose:** a member who already is one raises `23505` exactly as before, the
 * statement aborts whole (one statement is one implicit transaction), and the projection is
 * NOT written — the caller maps that to its 409 `already_member` or to its reread. Outside any
 * explicit transaction, so the reread after a `23505` still works.
 */
export async function insertMembershipWithProjection(input: {
  consumerId: string;
  programId: string;
  businessId: string;
  originLocationId?: string | null;
}): Promise<InsertedMembership> {
  const result = await getDb().execute(sql`
    WITH ins AS (
      INSERT INTO consumer.program_membership
        (consumer_id, program_id, business_id, origin_location_id)
      VALUES (${input.consumerId}::uuid, ${input.programId}::uuid,
              ${input.businessId}::uuid, ${input.originLocationId ?? null}::uuid)
      RETURNING id, consumer_id, program_id, business_id, origin_location_id,
                points_balance, stamps_count, enrolled_at
    ),
    projected AS (${upsertEnrollmentSql(sql`ins`)})
    SELECT * FROM ins
  `);
  const [row] = rowsOf(result) as Record<string, unknown>[];
  if (!row) throw new Error("La membresía no se pudo crear.");
  return {
    id: String(row.id),
    consumerId: String(row.consumer_id),
    programId: String(row.program_id),
    businessId: String(row.business_id),
    originLocationId:
      row.origin_location_id == null ? null : String(row.origin_location_id),
    pointsBalance: Number(row.points_balance),
    stampsCount: Number(row.stamps_count),
    enrolledAt: requireDate(row.enrolled_at),
  };
}
