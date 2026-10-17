import { addDays, daysBetween, formatMoney } from "../date";
import { sumIntegers } from "../money";
import type { AnalyticsInput, CardCandidate, CardState } from "../types";
import { cardWeight, materialFingerprint } from "../weights";

import {
  ANALYTICS_POLICY,
  policyText,
  rulesFor,
  type AnalyticsPolicy,
  type AnalyticsRulePolicy,
} from "../policy/index";
export const CUSTOMER_PROMO_URGENCY = {
  "10": ANALYTICS_POLICY.rules.find((r) => r.id === "10")!.parameters.urgency,
  "11": 0,
  "12": ANALYTICS_POLICY.rules.find((r) => r.id === "12")!.parameters.urgency,
};
export function buildCustomerPromoCandidates(
  input: AnalyticsInput,
  states: readonly CardState[] = [],
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
  rules: readonly AnalyticsRulePolicy[] = [
    ...rulesFor(policy, "voids"),
    ...rulesFor(policy, "campaign"),
  ],
): CardCandidate[] {
  return rules.flatMap((rule) => buildRule(input, states, policy, rule));
}
function buildRule(
  input: AnalyticsInput,
  states: readonly CardState[],
  policy: AnalyticsPolicy,
  rule: AnalyticsRulePolicy,
): CardCandidate[] {
  const p = rule.parameters;
  const cards: CardCandidate[] = [];
  const money = (n: number) =>
    formatMoney(n, input.currencyCode, input.minorUnit);
  const sum = (
    rows: typeof input.metrics,
    metric: string,
    field: "count" | "amountMinor" = "amountMinor",
  ) =>
    sumIntegers(
      rows
        .filter(
          (r) =>
            r.metric === metric &&
            (field === "count" ||
              (r.currencyCode === input.currencyCode &&
                r.minorUnit === input.minorUnit)),
        )
        .map((r) => r[field]),
    );
  const avg =
    sum(
      input.metrics.filter(
        (r) =>
          r.day >= addDays(input.today, -policy.weights.averageDailyDays) &&
          r.day < input.today,
      ),
      "revenue",
    ) / policy.weights.averageDailyDays;
  function add(
    card: Omit<
      CardCandidate,
      | "currencyCode"
      | "minorUnit"
      | "fingerprint"
      | "weight"
      | "urgency"
      | "cardKey"
      | "sender"
      | "actionKey"
    >,
  ) {
    const candidate: CardCandidate = {
      ...card,
      cardKey: rule.id,
      category: rule.category,
      sender: rule.sender,
      actionKey: rule.actionKey,
      currencyCode: input.currencyCode,
      minorUnit: input.minorUnit,
      urgency: p.urgency,
      fingerprint: materialFingerprint(
        card.subjectKey,
        card.amountMinor,
        policy,
      ),
      weight: 0,
    };
    candidate.weight = cardWeight(
      candidate,
      avg,
      states.find(
        (s) => s.cardKey === rule.id && s.subjectKey === card.subjectKey,
      ),
      policy,
    );
    cards.push(candidate);
  }
  if (rule.handler === "voids")
    for (const location of input.locations) {
      const first = input.firstSaleDays?.find(
        (r) => r.locationId === location.id,
      )?.day;
      if (!first || daysBetween(first, input.today) < p.historyDays) continue;
      const rows = input.metrics.filter((r) => r.locationId === location.id);
      const current = rows.filter(
        (r) =>
          r.day >= addDays(input.today, -p.windowDays) && r.day < input.today,
      );
      const weeks = Array.from({ length: p.baselineWindows }, (_, i) =>
        sum(
          rows.filter(
            (r) =>
              r.day >= addDays(input.today, -(i + 2) * p.windowDays) &&
              r.day < addDays(input.today, -(i + 1) * p.windowDays),
          ),
          "voided_tickets",
          "count",
        ),
      );
      const mean = weeks.reduce((a, b) => a + b, 0) / p.baselineWindows;
      const sd = Math.sqrt(
        weeks.reduce((n, v) => n + (v - mean) ** 2, 0) / p.baselineWindows,
      );
      const count = sum(current, "voided_tickets", "count");
      if (count <= Math.max(p.minimumCount, mean + p.standardDeviations * sd))
        continue;
      const amount = sum(current, "voided_tickets");
      add({
        subjectKey: `voids:${location.id}`,
        period: {
          from: addDays(input.today, -p.windowDays),
          to: addDays(input.today, -1),
          label: "",
        },
        context: {
          kind: "voids",
          count,
          amount,
          mean,
          sd,
          observations: current
            .filter((r) => r.metric === "voided_tickets")
            .map((r) => [r.day, r.count, r.amountMinor]),
        },

        title: policyText(policy, "card_customer_promo_buildRule_1"),
        body: policyText(policy, "card_customer_promo_buildRule_2", {
          window: policyText(
            policy,
            p.windowDays === 7 ? "anomaly_this_week" : "anomaly_days",
            { days: p.windowDays },
          ),
          baseline: policyText(
            policy,
            p.windowDays === 7
              ? "anomaly_baseline_weeks"
              : "anomaly_baseline_days",
            { days: p.windowDays, windows: p.baselineWindows },
          ),
          v0: count,
          v1: location.name,
          v2: money(amount),
          v3: Number(mean.toFixed(1)),
        }),
        amountMinor: amount,
        quality: "observed",

        locationId: location.id,
      });
    }
  if (rule.handler === "campaign")
    for (const campaign of input.campaigns ?? []) {
      if (campaign.status === "draft") continue;
      const finish = [campaign.endsAt, campaign.endedAt]
        .filter((v): v is string => !!v)
        .sort()[0];
      if (
        !finish ||
        addDays(finish.slice(0, 10), p.emissionDelayDays) > input.today ||
        (addDays(finish.slice(0, 10), p.emissionDelayDays) !== input.today &&
          !states.some(
            (s) =>
              s.cardKey === rule.id &&
              s.subjectKey === `campaign:${campaign.campaignId}`,
          ))
      )
        continue;
      const rows = input.metrics.filter(
        (r) =>
          r.dimensionId === campaign.campaignId &&
          r.day >= campaign.startsAt.slice(0, 10) &&
          r.day <= finish.slice(0, 10),
      );
      const discount = sum(rows, "promo_discount"),
        sales = sum(rows, "promo_sales");
      add({
        subjectKey: `campaign:${campaign.campaignId}`,
        originDay: finish.slice(0, 10),
        ...(campaign.finishOccurredAt
          ? {
              originObservedAt: `${new Date(campaign.finishOccurredAt).toISOString()}:${campaign.eventId}`,
            }
          : {}),
        period: {
          from: campaign.startsAt.slice(0, 10),
          to: finish.slice(0, 10),
          label: "",
        },
        context: {
          kind: "campaign",
          sourceKey: campaign.sourceKey,
          sourceRevision: campaign.sourceRevision,
          cycle: { startsAt: campaign.startsAt, finish },
          snapshot: {
            capturedAt: campaign.capturedAt,
            eventId: campaign.eventId,
          },
          discount,
          sales,
        },

        title: policyText(policy, "card_customer_promo_buildRule_3"),
        body: policyText(policy, "card_customer_promo_buildRule_4", {
          v0: campaign.label,
          v1: money(discount),
          v2: money(sales),
        }),
        amountMinor: discount,
        quality: "observed",

        actionHref: `/backoffice/marketing/${campaign.campaignId}`,
        locationId: null,
        ...(discount === 0 ? { fixedPlata: p.zeroDiscountPlata } : {}),
      });
    }
  return cards;
}
