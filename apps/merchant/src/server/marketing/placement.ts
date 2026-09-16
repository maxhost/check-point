/**
 * Step 4 of the tick (spec 0065): the APPLIER. It holds the per-consumer lock, feeds
 * `planConsumerPlacement` (pure) and executes exactly what the plan says — it decides
 * nothing by itself. Everything it writes is here, so «what changes the pass» has one
 * address.
 *
 * Two properties live in this loop and in no unit test, which is why the Neon
 * integration is their oracle:
 *  - the business quota advances CONSUMER BY CONSUMER inside a single run (the map is
 *    read once and then carried), instead of being re-read and re-passing the cap;
 *  - the pass is rewritten only when the target SET changed, which is what makes two
 *    consecutive ticks leave the database byte-identical (`refresh: false` → no delete,
 *    no insert, no `message_updated_at`, no `pass_refresh` row).
 */

import { eq, sql } from "drizzle-orm";
import type { DbTransaction } from "../db";
import { campaignTurns, consumerAccounts, passPlacements } from "../schema";
import type { MeritTable } from "./merit";
import {
  type PlacementLimits,
  type PlacementPlan,
  planConsumerPlacement,
} from "./placement-plan";
import {
  loadActiveTurns,
  loadBusinessActiveTurns,
  loadCooldownMap,
  loadCurrentPlacement,
  loadPlacementConsumerIds,
  loadQueuedTurns,
  lockConsumer,
} from "./placement-store";
import { loadUtilityCandidates } from "./utility-store";

export type PlacementSummary = {
  consumers: number;
  activated: number;
  holdouts: number;
  refreshes: number;
};

/**
 * Writes the plan.
 *
 * ORQUESTADOR, and CORRECTED after measuring it: an earlier version of this comment
 * claimed the activations had to run BEFORE the pass rows «because `pass_placement.
 * turn_id` is a fk». That is false, and the probe proved it — swapping the two halves
 * reddens NOTHING (77/77). The fk only requires the turn row to EXIST, which it does
 * while it is still `queued`, and both writes land inside the tick's single
 * transaction, so no reader can ever observe one without the other. What is
 * load-bearing is that BOTH happen, not their order.
 *
 * The refresh half IS all-or-nothing on `plan.refresh` (that one has an oracle: the
 * idempotence test). `latest_message` is NOT touched (ADR 0037): the pass changed, the
 * consumer's «Última novedad» did not, and the `pass_refresh` notice exists precisely
 * so that the change travels silently.
 */
async function applyPlan(
  db: DbTransaction,
  consumerId: string,
  plan: PlacementPlan,
  now: Date,
): Promise<number> {
  for (const activation of plan.activations) {
    await db
      .update(campaignTurns)
      .set({
        status: "active",
        windowStart: activation.windowStart,
        windowEnd: activation.windowEnd,
        holdout: activation.holdout,
        messageSnapshot: activation.messageSnapshot,
        couponLabelSnapshot: activation.couponLabelSnapshot,
        couponCostSnapshot: activation.couponCostSnapshot,
      })
      .where(eq(campaignTurns.id, activation.turnId));
  }
  if (!plan.refresh) return 0;
  await db
    .delete(passPlacements)
    .where(eq(passPlacements.consumerId, consumerId));
  if (plan.placements.length > 0)
    await db.insert(passPlacements).values(
      plan.placements.map((slot) => ({
        consumerId,
        locationId: slot.locationId,
        slotKind: slot.slotKind,
        turnId: slot.turnId,
        businessId: slot.businessId,
        relevantText: slot.relevantText,
        computedAt: now,
      })),
    );
  await db
    .update(consumerAccounts)
    .set({ messageUpdatedAt: now, updatedAt: now })
    .where(eq(consumerAccounts.id, consumerId));
  // Coalescing by `where not exists`, NOT by a unique index: the push worker returns a
  // failed row to `pending` in the same update that bumps `attempts`, so a partial
  // unique over `status='pending'` would make that update fail, leave the row stuck in
  // `sending` and re-claim it forever (spec 0065, `schema/consumer.ts`). It is safe
  // because the tick runs one at a time, under the advisory lock of step 0.
  const queued = await db.execute<{ id: string }>(sql`
    insert into consumer.wallet_push_queue (consumer_id, class, title, body)
    select ${consumerId}, 'pass_refresh', '', ''
    where not exists (
      select 1 from consumer.wallet_push_queue q
      where q.consumer_id = ${consumerId} and q.class = 'pass_refresh'
        and q.status in ('pending', 'sending')
    )
    returning id
  `);
  return queued.rows.length;
}

export async function placeConsumers(
  db: DbTransaction,
  opts: {
    now: Date;
    /** Injected so the integration can force and exclude holdouts instead of praying. */
    random: () => number;
    merit: MeritTable;
    limits?: Partial<PlacementLimits>;
    consumerIds?: string[];
  },
): Promise<PlacementSummary> {
  const ids = await loadPlacementConsumerIds(db, opts.consumerIds);
  const quota = await loadBusinessActiveTurns(db);
  const summary: PlacementSummary = {
    consumers: ids.length,
    activated: 0,
    holdouts: 0,
    refreshes: 0,
  };
  for (const consumerId of ids) {
    await lockConsumer(db, consumerId);
    const plan = planConsumerPlacement({
      now: opts.now,
      random: opts.random,
      activeTurns: await loadActiveTurns(db, consumerId),
      queued: await loadQueuedTurns(db, consumerId),
      utility: await loadUtilityCandidates(db, consumerId, opts.now),
      currentPlacement: await loadCurrentPlacement(db, consumerId),
      businessScores: opts.merit.scores,
      defaultBusinessScore: opts.merit.defaultScore,
      businessActiveTurns: quota,
      lastWindowEndByBusiness: await loadCooldownMap(db, consumerId),
      limits: opts.limits,
    });
    summary.refreshes += await applyPlan(db, consumerId, plan, opts.now);
    summary.activated += plan.activations.length;
    for (const activation of plan.activations) {
      if (activation.holdout) {
        summary.holdouts += 1;
        continue;
      }
      // The quota is carried across consumers of the SAME run: re-reading it per
      // consumer (or reading it once and never advancing it) is how a business goes
      // over its cap inside one tick.
      quota.set(
        activation.businessId,
        (quota.get(activation.businessId) ?? 0) + 1,
      );
    }
  }
  return summary;
}
