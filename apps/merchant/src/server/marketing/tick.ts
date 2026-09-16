/**
 * The marketing tick (spec 0065): one run of the five steps, in order — enqueue,
 * expire, cancel, place, log. Disparado por `.github/workflows/marketing-tick.yml`
 * cada 6 horas through `GET /api/internal/marketing-tick`.
 *
 * IDEMPOTENT by construction, not by hope: step 1 leans on the partial unique of
 * `campaign_turn`, step 4 rewrites the pass only when the target SET changed, and the
 * `pass_refresh` notice is coalesced. Running it twice in a row leaves the same rows.
 *
 * ⚠️ THE WHOLE RUN IS ONE INTERACTIVE TRANSACTION, and that is a decision with a cost
 * (ORQUESTADOR). The spec asks for `pg_try_advisory_lock`, a SESSION lock — and a
 * session lock needs every statement of the run to travel on the SAME connection, which
 * this codebase cannot promise: `getDb()` is the HTTP driver (one request, one
 * connection) and the pooled WebSocket driver only pins a client for the duration of a
 * transaction (`db.ts`). So the lock is `pg_try_advisory_xact_lock`, taken inside the
 * transaction that carries the run; it is released at commit, with no `unlock` to leak.
 * The cost is real and declared: the per-consumer `for update` locks are held until the
 * run ends, so a long tick blocks writers on `consumer_account`. At today's scale that
 * is the right trade; the day it is not, the fix is a session-pinned connection, not a
 * weaker lock.
 */

import { sql } from "drizzle-orm";
import { withDbTransaction, type DbTransaction } from "../db";
import {
  type AudienceCandidate,
  type Eligibility,
  decideTurnEligibility,
  summarizeAudience,
} from "./audience";
import {
  enqueueTurns,
  loadActiveCampaigns,
  loadAudienceCandidates,
  loadUsableCampaignLocations,
  recordTickAudience,
} from "./audience-store";
import { buildMeritTable, loadBusinessTurnStats } from "./merit";
import {
  DEFAULT_PLACEMENT_LIMITS,
  type PlacementLimits,
} from "./placement-plan";
import { placeConsumers } from "./placement";
import { cancelTurns, expireTurns } from "./turn-lifecycle";

export type TickSummary = {
  campaigns: number;
  enqueued: number;
  activated: number;
  holdouts: number;
  expired: number;
  cancelled: number;
  consumers: number;
  refreshes: number;
};

export type TickResult = TickSummary | { skipped: "tick_in_flight" };

export type TickOptions = {
  now?: Date;
  /** Injected so a test forces or excludes holdouts instead of praying. */
  random?: () => number;
  limits?: Partial<PlacementLimits>;
  /** Test scope (same idea as `runPushWorker`'s `consumerIds`): production passes none
   * and the run covers the whole platform. */
  businessIds?: string[];
  consumerIds?: string[];
  /**
   * ⚠️ TEST SEAM, and the only one here that can weaken a production guarantee:
   * the advisory key is derived from this name, and two runs under DIFFERENT names do
   * NOT exclude each other. Production must never pass it — `runMarketingTick()` from
   * the route takes no arguments at all.
   *
   * It exists because the exclusion is global BY DESIGN: the integration files each
   * seed their own business, but they share one database, so with a single key the
   * parallel suites answered `tick_in_flight` to one another (measured: 17 red in the
   * full run, zero in isolation). Giving each file its own namespace keeps the
   * behaviour of the lock under test — the suite that asserts the skip uses the
   * production default.
   */
  lockNamespace?: string;
};

/** Step 0. The key is derived from a NAME, the same way the recovery flows derive
 * theirs (`consumer/recovery/deliver.ts`), so nobody has to keep a registry of magic
 * integers. */
export const TICK_LOCK_NAMESPACE = "marketing_tick";

/**
 * Step 1 for ONE campaign: evaluate every membership of the business, write the
 * audience photo and queue the eligible ones. The photo is written even when nothing is
 * queued — a run where everybody was in cooldown is exactly what the results screen has
 * to be able to explain.
 */
async function runCampaign(
  db: DbTransaction,
  campaign: { id: string; businessId: string; dormantDays: number },
  now: Date,
  cooldownDays: number,
): Promise<number> {
  const eligibleLocationIds = await loadUsableCampaignLocations(
    db,
    campaign.id,
  );
  const candidates = await loadAudienceCandidates(db, campaign.businessId);
  const evaluated: {
    candidate: AudienceCandidate;
    eligibility: Eligibility;
  }[] = candidates.map((candidate) => ({
    candidate,
    eligibility: decideTurnEligibility(candidate, {
      now,
      dormantDays: campaign.dormantDays,
      cooldownDays,
      eligibleLocationIds,
    }),
  }));
  await recordTickAudience(db, campaign.id, now, summarizeAudience(evaluated));
  return await enqueueTurns(
    db,
    campaign,
    evaluated.flatMap((row) =>
      row.eligibility.kind === "eligible"
        ? [
            {
              consumerId: row.candidate.consumerId,
              membershipId: row.candidate.membershipId,
              locationId: row.eligibility.locationId,
            },
          ]
        : [],
    ),
    now,
  );
}

export async function runMarketingTick(
  options: TickOptions = {},
): Promise<TickResult> {
  const now = options.now ?? new Date();
  const limits = { ...DEFAULT_PLACEMENT_LIMITS, ...options.limits };
  const result = await withDbTransaction(async (db) => {
    const namespace = options.lockNamespace ?? TICK_LOCK_NAMESPACE;
    const lock = await db.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(hashtextextended(${namespace}, 0)) as locked`,
    );
    if (!lock.rows[0]?.locked) return { skipped: "tick_in_flight" } as const;

    const campaigns = await loadActiveCampaigns(db, now, options.businessIds);
    let enqueued = 0;
    for (const campaign of campaigns)
      enqueued += await runCampaign(db, campaign, now, limits.cooldownDays);

    const expired = await expireTurns(db, now, options.businessIds);
    const cancelled = Object.values(
      await cancelTurns(db, options.businessIds),
    ).reduce((total, count) => total + count, 0);

    const merit = buildMeritTable(await loadBusinessTurnStats(db));
    const placement = await placeConsumers(db, {
      now,
      random: options.random ?? Math.random,
      merit,
      limits: options.limits,
      consumerIds: options.consumerIds,
    });
    return {
      campaigns: campaigns.length,
      enqueued,
      expired,
      cancelled,
      ...placement,
    } satisfies TickSummary;
  });
  // Emitted AND returned: the route answers with it and the integration asserts it, so
  // the log is an oracle instead of a decoration (spec 0065 DoD).
  console.info("marketing_tick", JSON.stringify(result));
  return result;
}
