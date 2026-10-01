import {
  type AtRiskRule,
  isAtRisk,
} from "@mi-pasaporte/domain/server/marketing/at-risk";
import { dormantSince } from "@mi-pasaporte/domain/server/marketing/audience";

/**
 * Step «1b push» of the tick as a PURE decision (spec 0103 §4 / ADR 0095): for ONE
 * membership and ONE push campaign, is a push decided, and if not, why. No DB and no
 * ambient clock — `push-store.ts` loads the facts and `tick.ts` executes the decision.
 *
 * The ORDER is load-bearing (a consumer is counted under exactly one reason):
 *  1. `opt_out` — they asked not to be marketed to; nothing else matters (an opted-out
 *     consumer with no transport is still `opt_out`).
 *  2. `not_reachable` — no transport can carry a push: no Apple pass with a device, no
 *     Google pass, no Web Push subscription.
 *  3. `not_dormant` — not the target of this campaign (same rule as proximity, the
 *     at-risk rhythm of #4 included — spec 0105).
 *  4. `already_reached` — THE GROUP RULE (ADR 0095 §5): since their last visit they
 *     already have a non-cancelled decision —holdout included— of this template or of a
 *     higher-ranked one of its group. `>=`: a decision at the very instant of the visit
 *     still belongs to that absence.
 */

export type PushCandidate = {
  membershipId: string;
  consumerId: string;
  marketingOptOutAt: Date | null;
  enrolledAt: Date;
  lastOrderAt: Date | null;
  /** Spec 0105: the habit of the at-risk rule (see `AudienceCandidate`). */
  visitDays: number;
  firstOrderAt: Date | null;
  pushReachable: boolean;
  /** `max(decided_at)` of the consumer's NON-cancelled pushes at this business whose
   * campaign's template is at or above this one in its group. */
  lastGroupDecisionAt: Date | null;
};

export type PushExclusion =
  | "opt_out"
  | "not_reachable"
  | "not_dormant"
  | "already_reached";

export type PushEligibility =
  | { kind: "eligible" }
  | { kind: "excluded"; reason: PushExclusion };

const DAY_MS = 24 * 60 * 60 * 1000;

export function decidePushEligibility(
  candidate: PushCandidate,
  context: { now: Date; dormantDays: number; atRisk: AtRiskRule | null },
): PushEligibility {
  const excluded = (reason: PushExclusion): PushEligibility => ({
    kind: "excluded",
    reason,
  });
  if (candidate.marketingOptOutAt) return excluded("opt_out");
  if (!candidate.pushReachable) return excluded("not_reachable");
  const since = dormantSince(candidate);
  const dormantFloor = new Date(
    context.now.getTime() - context.dormantDays * DAY_MS,
  );
  if (since > dormantFloor) return excluded("not_dormant");
  if (context.atRisk && !isAtRisk(candidate, context.now, context.atRisk))
    return excluded("not_dormant");
  if (candidate.lastGroupDecisionAt && candidate.lastGroupDecisionAt >= since)
    return excluded("already_reached");
  return { kind: "eligible" };
}
