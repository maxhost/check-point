import { and, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { DbTransaction, getDb } from "@mi-pasaporte/db";
import { loyaltyPrograms, loyaltyRewards } from "@mi-pasaporte/db/schema";
import type { BalanceCandidate, RewardCost } from "./balance-audience";
import { requireDate, toDate } from "./driver-values";
import {
  type TemplateDefinition,
  type TemplateKey,
  templateKeysAtOrAbove,
} from "./templates";
import { rewardCost } from "./utility-text";

/**
 * The DB half of the BALANCE templates (spec 0104 §4 and §6 / ADR 0096).
 *
 * `loadRewardCost` is the reward the tick measures a balance against: the business's
 * OPERATIONAL program (`status in ('active','closing')` — the same predicate as
 * `core_loyalty_program_one_operational`, so there is at most one) and its cheapest
 * reward, read exactly like the utility bag (`rewardCost`). `null` = nobody is eligible,
 * and `enable` answers `409 no_loyalty_reward`.
 */

const OPERATIONAL = ["active", "closing"] as const;

export type ProgramReward = RewardCost & { programId: string };

export async function loadRewardCost(
  db: DbTransaction | ReturnType<typeof getDb>,
  businessId: string,
): Promise<ProgramReward | null> {
  const [program] = await db
    .select({
      id: loyaltyPrograms.id,
      kind: loyaltyPrograms.kind,
      configuration: loyaltyPrograms.configuration,
    })
    .from(loyaltyPrograms)
    .where(
      and(
        eq(loyaltyPrograms.businessId, businessId),
        inArray(loyaltyPrograms.status, [...OPERATIONAL]),
      ),
    )
    .limit(1);
  if (!program) return null;
  if (program.kind !== "stamps" && program.kind !== "points") return null;
  const rewards = await db
    .select({ pointsCost: loyaltyRewards.pointsCost })
    .from(loyaltyRewards)
    .where(eq(loyaltyRewards.programId, program.id));
  const cost = rewardCost(program, rewards);
  return cost === null
    ? null
    : { kind: program.kind, cost, programId: program.id };
}

/**
 * The raw `json` of a `json_agg` of timestamps, as `Date`s. Whether the driver parses
 * `json` or hands the text over is not something to trust (see `driver-values.ts`), so
 * both shapes are accepted.
 */
function toDates(value: unknown): Date[] {
  const list: unknown =
    typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  if (!Array.isArray(list)) return [];
  return list.map((at) => requireDate(at));
}

/**
 * The memberships OF THE OPERATIONAL PROGRAM with the push facts plus the balance ones.
 * RAW SQL with its own aliases (`m`, `o`, `d`, `p`, `g`, `w`, `cp`, `c`, `r`), for the
 * reason `loadPushCandidates` gives: a correlated subquery written with the builder binds
 * its outer column to the inner table. The push facts are the SAME expressions as
 * `loadPushCandidates` (`push-store.ts`).
 */
export async function loadBalanceCandidates(
  db: DbTransaction,
  businessId: string,
  template: Pick<TemplateDefinition, "key" | "group" | "rank">,
  reward: ProgramReward,
): Promise<BalanceCandidate[]> {
  const keys = sql.join(
    templateKeysAtOrAbove(template).map((key) => sql`${key}`),
    sql`, `,
  );
  const own: TemplateKey = template.key;
  const balance =
    reward.kind === "stamps" ? sql`m.stamps_count` : sql`m.points_balance`;
  const result = await db.execute<{
    membership_id: string;
    consumer_id: string;
    marketing_opt_out_at: string | null;
    enrolled_at: string;
    last_order_at: string | null;
    push_reachable: boolean;
    last_group_decision_at: string | null;
    balance: number;
    last_redemption_at: string | null;
    own_decisions: unknown;
  }>(sql`
    select
      m.id as membership_id,
      m.consumer_id,
      m.marketing_opt_out_at,
      m.enrolled_at,
      (select max(o.created_at) from core."order" o
         where o.business_id = m.business_id and o.consumer_id = m.consumer_id) as last_order_at,
      (exists (select 1 from consumer.wallet_push_device d
                 join consumer.wallet_pass p on p.id = d.wallet_pass_id
               where p.consumer_id = m.consumer_id and p.provider = 'apple')
       or exists (select 1 from consumer.wallet_pass g
                   where g.consumer_id = m.consumer_id and g.provider = 'google')
       or exists (select 1 from consumer.web_push_subscription w
                   where w.consumer_id = m.consumer_id)) as push_reachable,
      (select max(cp.decided_at) from core.campaign_push cp
         join core.campaign c on c.id = cp.campaign_id
       where cp.business_id = m.business_id and cp.consumer_id = m.consumer_id
         and cp.cancelled_at is null
         and c.template_key in (${keys})) as last_group_decision_at,
      ${balance} as balance,
      (select max(r.created_at) from core.reward_redemption r
         where r.membership_id = m.id) as last_redemption_at,
      (select coalesce(json_agg(cp.decided_at), '[]'::json) from core.campaign_push cp
         join core.campaign c on c.id = cp.campaign_id
       where cp.business_id = m.business_id and cp.consumer_id = m.consumer_id
         and cp.cancelled_at is null
         and c.template_key = ${own}) as own_decisions
    from consumer.program_membership m
    where m.business_id = ${businessId} and m.program_id = ${reward.programId}
  `);
  return result.rows.map((row) => ({
    membershipId: row.membership_id,
    consumerId: row.consumer_id,
    marketingOptOutAt: toDate(row.marketing_opt_out_at),
    enrolledAt: requireDate(row.enrolled_at),
    lastOrderAt: toDate(row.last_order_at),
    pushReachable: row.push_reachable,
    lastGroupDecisionAt: toDate(row.last_group_decision_at),
    balance: Number(row.balance),
    lastRedemptionAt: toDate(row.last_redemption_at),
    ownDecisions: toDates(row.own_decisions),
  }));
}
