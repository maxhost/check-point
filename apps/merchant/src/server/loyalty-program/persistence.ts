import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { loyaltyRewards, products } from "../schema";
import type { EventAction, RewardInput } from "./core";

export type Db = ReturnType<typeof getDb>;

export const STATE_CHANGED =
  "El programa cambió de estado; recarga e intenta de nuevo.";

/** Walks the `.cause` chain because drizzle wraps the pg error (code isn't top-level). */
export function isUniqueViolation(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  const rows = (result as { rows?: unknown[] } | null)?.rows;
  return Array.isArray(rows) ? rows : [];
}

/** A `(VALUES …)` row list for the reward rewrite, every column explicitly cast. */
function rewardValuesSql(rewards: RewardInput[]) {
  return sql.join(
    rewards.map(
      (r) =>
        sql`(${r.type}::text, ${r.label}::text, ${r.productId}::uuid, ${r.discountPercent}::integer, ${r.pointsCost}::integer, ${r.position}::integer)`,
    ),
    sql`, `,
  );
}

/**
 * Applies a guarded status/config UPDATE and appends its audit event in one atomic
 * statement, so a state change can never persist without its event (neon-http has no
 * interactive transactions). When `rewards` is given, the program's rewards are also
 * rewritten (delete-all + re-insert) in the SAME statement — and, crucially, both the
 * DELETE and the INSERT read from `updated`, so when the guard matches 0 rows they touch
 * nothing: a losing edit never wipes the existing rewards. Returns rows the guard matched.
 */
export async function updateWithEvent(
  db: Db,
  opts: {
    set: ReturnType<typeof sql>;
    where: ReturnType<typeof sql>;
    actorId: string | null;
    action: EventAction;
    details?: Record<string, unknown>;
    rewards?: RewardInput[];
  },
) {
  const rewardsCte = opts.rewards
    ? sql`,
    deleted AS (
      DELETE FROM core.loyalty_reward
      WHERE program_id IN (SELECT id FROM updated)
    ),
    inserted AS (
      INSERT INTO core.loyalty_reward
        (program_id, business_id, reward_type, label, product_id,
         discount_percent, points_cost, position)
      SELECT u.id, u.business_id, v.reward_type, v.label, v.product_id,
             v.discount_percent, v.points_cost, v.position
      FROM updated u
      CROSS JOIN (VALUES ${rewardValuesSql(opts.rewards)})
        AS v(reward_type, label, product_id, discount_percent, points_cost, position)
    )`
    : sql``;
  const result = await db.execute(sql`
    WITH updated AS (
      UPDATE core.loyalty_program
      SET ${opts.set}
      WHERE ${opts.where}
      RETURNING id, business_id
    ),
    logged AS (
      INSERT INTO core.loyalty_program_event
        (program_id, business_id, actor_id, action, details)
      SELECT id, business_id, ${opts.actorId}, ${opts.action},
             ${JSON.stringify(opts.details ?? {})}::jsonb
      FROM updated
    )${rewardsCte}
    SELECT id FROM updated
  `);
  return rowsOf(result).length;
}

/** The owner's products (id + name), for resolving `catalog_product` rewards. */
export async function loadBusinessProducts(businessId: string) {
  return getDb()
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.businessId, businessId));
}

/** Program's rewards ordered by position, joined to the product image for the DTO. */
export type RewardRow = {
  rewardType: string;
  label: string;
  productId: string | null;
  discountPercent: number | null;
  pointsCost: number | null;
  position: number;
  imageObjectKey: string | null;
  imageVersion: number | null;
};

export async function loadProgramRewards(
  programId: string,
): Promise<RewardRow[]> {
  return getDb()
    .select({
      rewardType: loyaltyRewards.rewardType,
      label: loyaltyRewards.label,
      productId: loyaltyRewards.productId,
      discountPercent: loyaltyRewards.discountPercent,
      pointsCost: loyaltyRewards.pointsCost,
      position: loyaltyRewards.position,
      imageObjectKey: products.imageObjectKey,
      imageVersion: products.imageVersion,
    })
    .from(loyaltyRewards)
    .leftJoin(products, eq(products.id, loyaltyRewards.productId))
    .where(eq(loyaltyRewards.programId, programId))
    .orderBy(asc(loyaltyRewards.position));
}
