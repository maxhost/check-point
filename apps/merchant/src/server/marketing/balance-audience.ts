import { dormantSince } from "./audience";
import {
  type PushCandidate,
  type PushExclusion,
  decidePushEligibility,
} from "./push-audience";
import { GAP_MARKER, type RewardRepeat, type TemplateKey } from "./templates";

/**
 * The BALANCE templates' audience as a PURE decision (spec 0104 §5 / ADR 0096): for ONE
 * membership and ONE #7/#8 campaign, is a push decided, and if not, why. No DB and no
 * ambient clock — `balance-store.ts` loads the facts and `balance-push.ts` executes.
 *
 * The ORDER is load-bearing (one reason per consumer):
 *  1–3. `opt_out` → `not_reachable` → `not_dormant`, EXACTLY as `decidePushEligibility`
 *       (it is called, not copied, with the group rule switched off: that rule is applied
 *       below, per template).
 *  4. `no_reward` — the business has no operational program with a usable cost.
 *  #7 `near_reward`: `has_reward` (the balance already pays the reward: that is #8's) →
 *     `not_near` (Sellos: gap > N; Puntos: gap·100 > cost·P) → `already_reached` (the
 *     group rule: a non-cancelled #7/#8 decision since the last visit) →
 *     `already_this_cycle` (a #7 decision since `max(enrolled, last redemption)`: ONE per
 *     redemption cycle, a visit does not open a new cycle) → eligible, with the gap.
 *  #8 `unclaimed_reward`: `no_reward_yet` → `already_reached` by its REPETITION, which
 *     replaces the group rule for itself (nothing ranks above #8): `once` = one decision
 *     per absence; `every_30_days` = at most two, 30 days apart or more.
 * Every «decision» counts the holdouts and skips the cancelled ones (ADR 0095).
 */

/** Without the at-risk habit (spec 0105): the balance templates never read a rhythm. */
export type BalanceCandidate = Omit<
  PushCandidate,
  "visitDays" | "firstOrderAt"
> & {
  /** `stamps_count` or `points_balance`, by the program's kind. */
  balance: number;
  /** `max(reward_redemption.created_at)` of the membership. */
  lastRedemptionAt: Date | null;
  /** `decided_at` of the NON-cancelled decisions (holdouts included) of THIS template,
   * business and consumer. */
  ownDecisions: Date[];
};

export type RewardCost = { kind: "stamps" | "points"; cost: number };

export type BalanceExclusion =
  | PushExclusion
  | "no_reward"
  | "has_reward"
  | "not_near"
  | "already_this_cycle"
  | "no_reward_yet";

export type BalanceEligibility =
  | { kind: "eligible"; gap: number }
  | { kind: "excluded"; reason: BalanceExclusion };

export type BalanceContext = {
  now: Date;
  dormantDays: number;
  template: TemplateKey;
  reward: RewardCost | null;
  nearRewardStamps: number | null;
  nearRewardPercent: number | null;
  rewardRepeat: RewardRepeat | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const REPEAT_GAP_MS = 30 * DAY_MS;

/** Sellos: at most N missing. Puntos: the missing part is at most P % of the cost —
 * in integers (`gap·100 ≤ cost·P`), so 20 % of 100 is exactly 20 with no float. */
function isNear(gap: number, reward: RewardCost, ctx: BalanceContext): boolean {
  if (reward.kind === "stamps") return gap <= (ctx.nearRewardStamps ?? 0);
  return gap * 100 <= reward.cost * (ctx.nearRewardPercent ?? 0);
}

export function decideBalancePush(
  candidate: BalanceCandidate,
  ctx: BalanceContext,
): BalanceEligibility {
  const excluded = (reason: BalanceExclusion): BalanceEligibility => ({
    kind: "excluded",
    reason,
  });
  const base = decidePushEligibility(
    {
      ...candidate,
      lastGroupDecisionAt: null,
      visitDays: 0,
      firstOrderAt: null,
    },
    { now: ctx.now, dormantDays: ctx.dormantDays, atRisk: null },
  );
  if (base.kind === "excluded") return base;
  const reward = ctx.reward;
  if (!reward) return excluded("no_reward");
  const since = dormantSince(candidate);
  const gap = reward.cost - candidate.balance;

  if (ctx.template === "near_reward") {
    if (gap <= 0) return excluded("has_reward");
    if (!isNear(gap, reward, ctx)) return excluded("not_near");
    if (candidate.lastGroupDecisionAt && candidate.lastGroupDecisionAt >= since)
      return excluded("already_reached");
    const cycleStart = Math.max(
      candidate.enrolledAt.getTime(),
      candidate.lastRedemptionAt?.getTime() ?? 0,
    );
    if (candidate.ownDecisions.some((at) => at.getTime() >= cycleStart))
      return excluded("already_this_cycle");
    return { kind: "eligible", gap };
  }

  if (gap > 0) return excluded("no_reward_yet");
  const inAbsence = candidate.ownDecisions.filter((at) => at >= since);
  if (ctx.rewardRepeat === "every_30_days") {
    const last = Math.max(0, ...inAbsence.map((at) => at.getTime()));
    if (
      inAbsence.length >= 2 ||
      (inAbsence.length === 1 && last > ctx.now.getTime() - REPEAT_GAP_MS)
    )
      return excluded("already_reached");
  } else if (inAbsence.length >= 1) return excluded("already_reached");
  return { kind: "eligible", gap: 0 };
}

/** «1 sello», «2 sellos», «1 punto», «15 puntos» — the unit of the program's kind. */
export function gapText(gap: number, kind: RewardCost["kind"]): string {
  const unit =
    kind === "stamps"
      ? gap === 1
        ? "sello"
        : "sellos"
      : gap === 1
        ? "punto"
        : "puntos";
  return `${gap} ${unit}`;
}

/** Replaces EVERY `{faltan}` of #7's message by what THIS consumer lacks. */
export function renderGap(
  message: string,
  gap: number,
  kind: RewardCost["kind"],
): string {
  return message.replaceAll(GAP_MARKER, gapText(gap, kind));
}
