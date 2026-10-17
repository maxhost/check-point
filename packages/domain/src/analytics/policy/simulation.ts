import {
  restoreFactCandidates,
  type MissingFactSnapshot,
} from "../cards/stock";
import { buildCandidates } from "../cards/index";
import { planEpisode, contextRecord } from "../cards/context";
import { addDays } from "../date";
import { sumIntegers } from "../money";
import { cardWeight, selectCards } from "../weights";
import type { AnalyticsInput, CardState } from "../types";
import { ANALYTICS_POLICY, type AnalyticsPolicy } from "./index";
/** Deterministic inspection of the same policy/handlers. No DB, clock, environment or writes. */
export function simulateAnalytics(
  input: AnalyticsInput,
  states: readonly CardState[],
  now: string,
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
) {
  const instant = Date.parse(now);
  if (!Number.isFinite(instant))
    throw new Error("Instante de simulación inválido.");
  const average =
    sumIntegers(
      input.metrics
        .filter(
          (r) =>
            r.metric === "revenue" &&
            r.day >= addDays(input.today, -policy.weights.averageDailyDays) &&
            r.day < input.today,
        )
        .map((r) => r.amountMinor),
    ) / policy.weights.averageDailyDays;
  const unavailableFacts: MissingFactSnapshot[] = [];
  const candidates = [
    ...buildCandidates(input, states, policy),
    ...restoreFactCandidates(input, states, policy, (info) =>
      unavailableFacts.push(info),
    ),
  ].map((card) => {
    const rule = policy.rules.find((r) => r.id === card.cardKey)!;
    const state = states.find(
      (s) => s.cardKey === card.cardKey && s.subjectKey === card.subjectKey,
    );
    const observed = card.context ?? {},
      fact = contextRecord(observed.fact);
    const original =
      typeof fact.occurredAt === "string"
        ? fact.occurredAt
        : (card.originObservedAt?.slice(0, 24) ?? now);
    const before =
      state?.episodeStartedAt && state.expiresAt
        ? {
            status: state.status,
            context: contextRecord(state.context),
            decidedAt: state.decidedAt,
            episodeStartedAt: state.episodeStartedAt,
            expiresAt: state.expiresAt,
          }
        : undefined;
    const plan = planEpisode(
      rule.handler,
      before,
      observed,
      now,
      policy.lifetime.days,
      original,
    );
    const expiresAt = plan.expiresAt,
      reopen = plan.newEpisode && !!state;
    const waiting =
      state?.status === "snoozed" &&
      !!state.remindAt &&
      Date.parse(state.remindAt) > instant;
    const due =
      state?.status === "snoozed" &&
      !!state.remindAt &&
      Date.parse(state.remindAt) <= instant;
    const n =
      rule.handler === "summary" || !state || plan.newEpisode || due
        ? 1
        : policy.weights.noveltyDecay ** state.shownDays;
    const denominator =
      average > 0
        ? average
        : policy.weights.noSalesDailyMajor * 10 ** card.minorUnit;
    const plata =
      card.fixedPlata ??
      Math.min(
        policy.weights.maximumPlata,
        Math.abs(card.amountMinor ?? 0) / denominator,
      );
    const urgency = Math.max(
      policy.weights.minimumUrgency,
      Math.min(policy.weights.maximumUrgency, card.urgency),
    );
    const base = cardWeight(card, average, undefined, policy),
      weight = base * n;
    const reason = !plan.eligible
      ? plan.expired
        ? "expired"
        : "attended_context"
      : instant > Date.parse(expiresAt)
        ? "expired"
        : waiting
          ? "snoozed"
          : weight < policy.weights.minimum && !card.criticalStock
            ? "below_weight"
            : "eligible";
    return {
      ...card,
      weight: card.criticalStock
        ? Math.max(weight, policy.weights.minimum)
        : weight,
      expiresAt,
      reason,
      components: {
        plata,
        urgency,
        novelty: n,
        multiplier: card.weightMultiplier ?? 1,
        baseWeight: base,
      },
      reopens: Boolean(reopen),
    };
  });
  const eligible = candidates.filter((c) => c.reason === "eligible");
  const ordered = selectCards(eligible, {
    ...policy,
    weights: { ...policy.weights, maximumCards: eligible.length || 1 },
  });
  for (const critical of ordered.filter((c) => c.criticalStock)) {
    const from = ordered.indexOf(critical),
      to = ordered.findIndex((c) => {
        const handler = policy.rules.find((r) => r.id === c.cardKey)?.handler;
        return (
          handler === "expenses" ||
          handler === "unknown-cost" ||
          (handler === "demand" && c.subjectKey === "learning")
        );
      });
    if (to >= 0 && from > to) {
      ordered.splice(from, 1);
      ordered.splice(to, 0, critical);
    }
  }
  return {
    policyVersion: policy.version,
    unavailableFacts,
    now,
    averageDailyMinor: average,
    rules: policy.rules.map((rule) => ({
      id: rule.id,
      handler: rule.handler,
      enabled: rule.enabled,
      reason: !rule.enabled
        ? "disabled"
        : unavailableFacts.some((f) => f.cardKey === rule.id)
          ? "requires_origin_snapshot"
          : candidates.some((c) => c.cardKey === rule.id)
            ? "evaluated"
            : "condition_not_met",
    })),
    candidates,
    order: ordered.slice(0, policy.weights.maximumCards).map((c) => ({
      cardKey: c.cardKey,
      subjectKey: c.subjectKey,
      weight: c.weight,
    })),
  };
}
