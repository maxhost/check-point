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
  type ActiveCampaign,
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
import { runBalancePushCampaign } from "./balance-push";
import { decidePushEligibility } from "./push-audience";
import {
  type PushCampaign,
  loadPushCampaigns,
  loadPushCandidates,
  recordPushDecision,
} from "./push-store";
import { templateByKey } from "./templates";
import { cancelTurns, expireTurns } from "./turn-lifecycle";
import { sweepWelcomeGifts } from "./welcome-issue";

export type TickSummary = {
  campaigns: number;
  enqueued: number;
  activated: number;
  holdouts: number;
  expired: number;
  cancelled: number;
  consumers: number;
  refreshes: number;
  /** Spec 0103: `campaign_push` rows written this run (holdouts included)… */
  pushDecided: number;
  /** …and how many of them are holdouts (no queue row). */
  pushHeld: number;
  /** Spec 0107: welcome gifts the sweep issued (a lost trigger, recovered). */
  welcomeIssued: number;
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
  campaign: ActiveCampaign,
  now: Date,
  cooldownDays: number,
): Promise<number> {
  // Spec 0105: #4's rhythm rule; `null` for every other template and the composer.
  const atRisk = templateByKey(campaign.templateKey ?? "")?.atRisk ?? null;
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
      atRisk,
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

/**
 * Step «1b push» for ONE campaign (spec 0103 §4): every eligible membership gets ONE
 * decision, holdout drawn with the same rate as a turn. Idempotent without a unique: the
 * rows written here are the `lastGroupDecisionAt` the next run reads (`already_reached`),
 * and the advisory lock keeps two runs from interleaving. A BALANCE template (#7/#8,
 * spec 0104) is not «dormant = push»: it goes to `runBalancePushCampaign`.
 */
async function runPushCampaign(
  db: DbTransaction,
  campaign: PushCampaign,
  now: Date,
  draw: () => boolean,
): Promise<{ decided: number; held: number }> {
  if (campaign.template.group === "balance")
    return await runBalancePushCampaign(db, campaign, now, draw);
  const candidates = await loadPushCandidates(
    db,
    campaign.businessId,
    campaign.template,
  );
  let decided = 0;
  let held = 0;
  for (const candidate of candidates) {
    const eligibility = decidePushEligibility(candidate, {
      now,
      dormantDays: campaign.dormantDays,
      atRisk: campaign.template.atRisk,
    });
    if (eligibility.kind !== "eligible") continue;
    const holdout = draw();
    await recordPushDecision(db, campaign, candidate, holdout, now);
    decided += 1;
    if (holdout) held += 1;
  }
  return { decided, held };
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

    // 1b push — AFTER step 1, in the same transaction, higher rank first.
    const random = options.random ?? Math.random;
    let pushDecided = 0;
    let pushHeld = 0;
    for (const campaign of await loadPushCampaigns(
      db,
      now,
      options.businessIds,
    )) {
      const push = await runPushCampaign(
        db,
        campaign,
        now,
        () => random() < limits.holdoutRate,
      );
      pushDecided += push.decided;
      pushHeld += push.held;
    }

    // Spec 0107: the welcome sweep, after 1b, in the same transaction and lock.
    const welcomeIssued = await sweepWelcomeGifts(
      db,
      now,
      options.businessIds,
      options.consumerIds,
    );

    const expired = await expireTurns(db, now, options.businessIds);
    const cancelled = Object.values(
      await cancelTurns(db, options.businessIds),
    ).reduce((total, count) => total + count, 0);

    const merit = buildMeritTable(await loadBusinessTurnStats(db));
    const placement = await placeConsumers(db, {
      now,
      random,
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
      pushDecided,
      pushHeld,
      welcomeIssued,
    } satisfies TickSummary;
  });
  // Emitted AND returned: the route answers with it and the integration asserts it, so
  // the log is an oracle instead of a decoration (spec 0065 DoD).
  console.info("marketing_tick", JSON.stringify(result));
  return result;
}
