/**
 * Step 1 of the marketing tick, as a PURE decision (spec 0065, «Audiencia dormidos»):
 * for ONE membership of ONE campaign, does this consumer get a `queued` turn, and if
 * not, WHY. No DB and no ambient clock — `marketing/audience-store.ts` loads the facts
 * and `marketing/tick.ts` executes the decision.
 *
 * The six exclusion reasons are VALUES of the result, not booleans scattered in a
 * query, because they are what the results screen must show («M alcanzables, K sin
 * local atribuible») and what `campaign_tick_audience` stores per run. A consumer
 * excluded from the audience leaves no row anywhere else.
 *
 * The evaluation ORDER is load-bearing for those counts (a consumer can fail several
 * rules at once and is counted under exactly one). It is, and each step says why:
 *  1. `opt_out` — the consumer asked not to be marketed to; nothing else matters.
 *  2. `not_reachable` — no wallet pass: the channel does not exist for them.
 *  3. `not_dormant` — they are not the target of this campaign at all.
 *  4. `no_location` — no attributable door among the campaign's usable ones.
 *  5. `cooldown` — this business already had its window recently.
 *  6. `live_turn` — a turn of this business is already queued/active for them.
 * Rules 4 and 5 are re-evaluated later, under the per-consumer lock, by
 * `planConsumerPlacement`: a turn can wait days in the queue and the world moves.
 */

/** The facts about one membership that the decision needs, as SQL returns them. */
export type AudienceCandidate = {
  membershipId: string;
  consumerId: string;
  /** Written ONLY by the consumer portal (ADR 0060). Null = promotions on. */
  marketingOptOutAt: Date | null;
  enrolledAt: Date;
  /** `max(order.created_at)` of THIS business, null when they never bought. */
  lastOrderAt: Date | null;
  /** `location_id` of their most recent order with this business (nullable column). */
  lastOrderLocationId: string | null;
  originLocationId: string | null;
  /** At least one `wallet_pass`, any provider. */
  hasPass: boolean;
  /** Latest `window_end` of an `active`/`done` turn of this business for them. A
   * `cancelled` turn keeps its `window_end` and must NOT be here: only the turn that
   * CONSUMED the opportunity burns the cooldown (spec 0065, audience rule 5). */
  lastWindowEnd: Date | null;
  /** A `queued`/`active` turn of this business already exists for them. */
  hasLiveTurn: boolean;
};

export type AudienceContext = {
  now: Date;
  dormantDays: number;
  cooldownDays: number;
  /** The campaign's locations that are `active` AND carry coordinates. Both conditions
   * belong to the ENQUEUE filter, not only to the cancel step: a door that is archived
   * or ungeocoded would otherwise be queued and cancelled in the SAME run, forever (a
   * cancelled turn does not hold the partial unique, so the next run re-inserts it). */
  eligibleLocationIds: readonly string[];
};

export type ExclusionReason =
  | "opt_out"
  | "not_reachable"
  | "not_dormant"
  | "no_location"
  | "cooldown"
  | "live_turn";

export type Eligibility =
  | { kind: "eligible"; locationId: string }
  | { kind: "excluded"; reason: ExclusionReason };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The door a turn is attributed to (ADR 0042), in order: the door of their last order
 * with the business, then the door they enrolled at, then — only if there is exactly
 * ONE usable door — that one. `usable` already means `active` with coordinates, so a
 * fallback can never land on a door the pass cannot show.
 */
export function attributableLocation(
  candidate: Pick<
    AudienceCandidate,
    "lastOrderLocationId" | "originLocationId"
  >,
  usableLocationIds: readonly string[],
): string | null {
  const usable = new Set(usableLocationIds);
  const { lastOrderLocationId, originLocationId } = candidate;
  if (lastOrderLocationId && usable.has(lastOrderLocationId))
    return lastOrderLocationId;
  if (originLocationId && usable.has(originLocationId)) return originLocationId;
  if (usable.size === 1) return [...usable][0];
  return null;
}

/** «Vino y no volvio» AND «se enrolo y nunca volvio»: the later of the two dates is
 * what has to be old enough, which is why the rule is a `greatest`, not an `or`. */
function dormantSince(candidate: AudienceCandidate): Date {
  const enrolled = candidate.enrolledAt.getTime();
  const ordered = candidate.lastOrderAt?.getTime() ?? 0;
  return new Date(Math.max(enrolled, ordered));
}

export function decideTurnEligibility(
  candidate: AudienceCandidate,
  context: AudienceContext,
): Eligibility {
  const excluded = (reason: ExclusionReason): Eligibility => ({
    kind: "excluded",
    reason,
  });
  if (candidate.marketingOptOutAt) return excluded("opt_out");
  if (!candidate.hasPass) return excluded("not_reachable");
  const dormantFloor = new Date(
    context.now.getTime() - context.dormantDays * DAY_MS,
  );
  if (dormantSince(candidate) > dormantFloor) return excluded("not_dormant");
  const locationId = attributableLocation(
    candidate,
    context.eligibleLocationIds,
  );
  if (!locationId) return excluded("no_location");
  const cooldownFloor = new Date(
    context.now.getTime() - context.cooldownDays * DAY_MS,
  );
  if (candidate.lastWindowEnd && candidate.lastWindowEnd >= cooldownFloor)
    return excluded("cooldown");
  if (candidate.hasLiveTurn) return excluded("live_turn");
  return { kind: "eligible", locationId };
}

/** The five columns of `core.campaign_tick_audience` for one campaign in one run. */
export type AudienceCounts = {
  total: number;
  reachable: number;
  noLocation: number;
  optOut: number;
  cooldown: number;
};

/**
 * `reachable` is counted OUTSIDE the decision, straight off `hasPass`, on purpose: it
 * is a positive count («cuantos podemos alcanzar»), not an exclusion reason, so it must
 * not depend on where the ordered decision stopped — an opted-out consumer who owns a
 * pass is still reachable. The other three are exclusion tallies and ARE the decision's.
 */
export function summarizeAudience(
  evaluated: readonly {
    candidate: AudienceCandidate;
    eligibility: Eligibility;
  }[],
): AudienceCounts {
  const excludedFor = (reason: ExclusionReason) =>
    evaluated.filter(
      (row) =>
        row.eligibility.kind === "excluded" &&
        row.eligibility.reason === reason,
    ).length;
  return {
    total: evaluated.length,
    reachable: evaluated.filter((row) => row.candidate.hasPass).length,
    noLocation: excludedFor("no_location"),
    optOut: excludedFor("opt_out"),
    cooldown: excludedFor("cooldown"),
  };
}
