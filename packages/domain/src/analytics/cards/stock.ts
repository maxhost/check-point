import { contextRecord } from "./context";
import {
  ANALYTICS_POLICY,
  policyText,
  rulesFor,
  type AnalyticsPolicy,
  type AnalyticsRulePolicy,
} from "../policy/index";
import { add, rational } from "../../financial/rational";
import type { AnalyticsFact } from "../metrics";
import type {
  AnalyticsGauge,
  AnalyticsInput,
  CardCandidate,
  CardState,
} from "../types";
import { addDays, daysBetween, formatMoney, localDay } from "../date";
import { cardWeight, materialFingerprint } from "../weights";
import {
  decimal,
  decimalDifference,
  moneyRatio,
  sumIntegers,
  safeInteger,
} from "../money";

const recentRows = (input: AnalyticsInput, days: number) =>
  input.metrics.filter(
    (r) => r.day >= addDays(input.today, -days) && r.day < input.today,
  );
export function weighStockCard(
  input: AnalyticsInput,
  card: CardCandidate,
  states: readonly CardState[] = [],
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
) {
  const average =
    sumIntegers(
      recentRows(input, policy.weights.averageDailyDays)
        .filter((r) => r.metric === "revenue")
        .map((r) => r.amountMinor),
    ) / policy.weights.averageDailyDays;
  return {
    ...card,
    weight: cardWeight(
      card,
      average,
      states.find(
        (s) => s.cardKey === card.cardKey && s.subjectKey === card.subjectKey,
      ),
      policy,
    ),
  };
}
function candidate(
  input: AnalyticsInput,
  card: Omit<
    CardCandidate,
    "currencyCode" | "minorUnit" | "weight" | "fingerprint"
  >,
  states: readonly CardState[],
  policy: AnalyticsPolicy,
) {
  return weighStockCard(
    input,
    {
      ...card,
      currencyCode: input.currencyCode,
      minorUnit: input.minorUnit,
      weight: 0,
      fingerprint: materialFingerprint(
        card.subjectKey,
        card.amountMinor,
        policy,
      ),
    },
    states,
    policy,
  );
}
/** The most recent observation for each metric/local/item; event id breaks timestamp ties. */
export function latestGauges(gauges: readonly AnalyticsGauge[], to: string) {
  const latest = new Map<string, AnalyticsGauge>();
  for (const row of gauges) {
    if (row.day > to) continue;
    const key = `${row.metric}:${row.locationId}:${row.dimensionId}`;
    const previous = latest.get(key);
    if (
      !previous ||
      new Date(row.observedAt).getTime() >
        new Date(previous.observedAt).getTime() ||
      (new Date(row.observedAt).getTime() ===
        new Date(previous.observedAt).getTime() &&
        row.eventId > previous.eventId)
    )
      latest.set(key, row);
  }
  return [...latest.values()];
}
function quantile(sorted: number[], p: number) {
  const i = (sorted.length - 1) * p,
    lo = Math.floor(i),
    hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}
const quantityText = (value: number) =>
  new Intl.NumberFormat("es-EC", { maximumFractionDigits: 3 }).format(value);
function dayText(today: string, days: number, policy: AnalyticsPolicy) {
  if (days <= 0) return policyText(policy, "stock_today");
  return new Intl.DateTimeFormat("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${addDays(today, Math.ceil(days))}T12:00:00Z`));
}
/** Evidence for recovery uses every delivered gauge, even one older than the daily snapshot. */
export function stockEvidenceBasis(
  input: AnalyticsInput,
  g: Pick<AnalyticsGauge, "locationId" | "dimensionId" | "quantity">,
  rule: AnalyticsRulePolicy,
) {
  if (
    !g.locationId ||
    !g.dimensionId ||
    typeof g.quantity !== "string" ||
    !/^-?\d+(?:\.\d+)?$/.test(g.quantity) ||
    !Number.isFinite(Number(g.quantity))
  )
    return null;
  const p = rule.parameters,
    rows = recentRows(input, p.consumptionDays);
  const consumption = input.metrics.filter(
    (r) =>
      r.metric === "stock_consumption" &&
      r.locationId === g.locationId &&
      r.dimensionId === g.dimensionId,
  );
  const first =
    input.firstConsumptionDays?.find(
      (d) => d.locationId === g.locationId && d.itemId === g.dimensionId,
    )?.day ?? consumption.map((r) => r.day).sort()[0];
  if (!first || daysBetween(first, input.today) < p.historyDays) return null;
  const daily = Array.from({ length: p.consumptionDays }, (_, i) => {
    const day = addDays(input.today, -(i + 1));
    return rows
      .filter(
        (r) =>
          r.metric === "stock_consumption" &&
          r.locationId === g.locationId &&
          r.dimensionId === g.dimensionId &&
          r.day === day,
      )
      .reduce((n, r) => n + r.quantity, 0);
  }).sort((a, b) => a - b);
  const fast = quantile(daily, p.fastQuantile),
    slow = quantile(daily, p.slowQuantile);
  if (fast <= 0) return null;
  const stock = Math.max(0, Number(g.quantity)),
    short = stock / fast;
  const long = slow > 0 ? stock / slow : null;
  return { fast, slow, stock, short, long };
}
export function buildStockCandidates(
  input: AnalyticsInput,
  states: readonly CardState[] = [],
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
  rules: readonly AnalyticsRulePolicy[] = rulesFor(policy, "stock"),
): CardCandidate[] {
  return rules.flatMap((rule) => buildStockRule(input, states, policy, rule));
}
function buildStockRule(
  input: AnalyticsInput,
  states: readonly CardState[],
  policy: AnalyticsPolicy,
  rule: AnalyticsRulePolicy,
): CardCandidate[] {
  const p = rule.parameters;
  return latestGauges(input.gauges ?? [], input.today)
    .filter((g) => g.metric === "stock_on_hand" && g.locationId)
    .flatMap((g) => {
      const basis = stockEvidenceBasis(input, g, rule);
      if (!basis || basis.short > p.riskDays) return [];
      const { fast, slow, stock, short, long } = basis;
      const label =
        input.labels.find((l) => l.kind === "item" && l.id === g.dimensionId)
          ?.label ?? policyText(policy, "stock_item_generic");
      const location = input.locations.find((l) => l.id === g.locationId)?.name;
      const range =
        long === null
          ? policyText(policy, "stock_range_open", {
              from: dayText(input.today, short, policy),
            })
          : policyText(policy, "stock_range_closed", {
              from: dayText(input.today, short, policy),
              to: dayText(input.today, long, policy),
            });
      return [
        candidate(
          input,
          {
            cardKey: rule.id,
            subjectKey: `${g.locationId}:${g.dimensionId}`,
            sender: rule.sender,
            category: rule.category,
            criticalStock: short <= p.criticalDays,
            context: {
              kind: "stock",
              gauge: {
                observedAt: new Date(g.observedAt).toISOString(),
                eventId: g.eventId,
                quantity: g.quantity,
              },
              fast,
              slow,
              shortDays: short,
            },
            title: policyText(policy, "card_stock_buildStockRule_1", {
              v0: label,
            }),
            body: policyText(policy, "card_stock_buildStockRule_4", {
              v0: quantityText(stock),
              v1: g.unit
                ? policyText(policy, "card_stock_buildStockRule_2", {
                    v0: g.unit,
                  })
                : policyText(policy, "stock_units_generic"),
              v2:
                location && input.locations.length > 1
                  ? policyText(policy, "card_stock_buildStockRule_3", {
                      v0: location,
                    })
                  : "",
              v3: range,
            }),
            amountMinor: null,
            fixedPlata: p.fixedPlata,
            urgency: 1 - short / p.urgencyScale,
            quality: "estimated",
            actionKey: rule.actionKey,
            locationId: g.locationId,
          },
          states,
          policy,
        ),
      ];
    });
}
/** Captured facts are supplied by the translator. No source tables or module names. */
export type FactEmission = {
  amountMinor: number;
  basis?: { totalSales: number; tickets: number; weeklySales: number };
};
export function buildFactCandidates(
  input: AnalyticsInput,
  facts: readonly AnalyticsFact[],
  eventId: string,
  dayOf: (instant: string) => string,
  states: readonly CardState[] = [],
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
  emissions: ReadonlyMap<string, FactEmission> = new Map(),
  captureDisabled = false,
): CardCandidate[] {
  return facts.flatMap((fact) =>
    policy.rules
      .filter(
        (r) =>
          r.handler ===
            (fact.kind === "unit_cost_change" ? "cost-rise" : "count-gap") &&
          (r.enabled || captureDisabled),
      )
      .flatMap((rule) => {
        const p = rule.parameters;
        const rows = recentRows(input, p.salesDays);
        if (
          fact.currencyCode !== input.currencyCode ||
          fact.minorUnit !== input.minorUnit
        )
          return [];
        const subject =
          fact.kind === "unit_cost_change"
            ? `${fact.locationId}:${fact.itemId}:${fact.productId}`
            : `${eventId}:${fact.itemId}`;
        const emitted = emissions.get(`${rule.id}:${subject}`);
        const originDay = dayOf(fact.occurredAt),
          age = daysBetween(originDay, input.today);
        if (age < 0) return [];
        const base = {
          originDay,
          originObservedAt: `${new Date(fact.occurredAt).toISOString()}:${eventId}`,
          locationId: fact.locationId,
          urgency: p.urgency,
          category: rule.category,
          context: { kind: rule.handler, fact, eventId },
          weightMultiplier: p.ageDecay ** age,
        };
        if (fact.kind === "unit_cost_change") {
          const before = decimal(fact.itemUnitCostBefore),
            delta = decimalDifference(
              fact.itemUnitCostAfter,
              fact.itemUnitCostBefore,
            );
          const minRise = decimal(String(p.minimumRiseRatio));
          if (
            before.n <= 0n ||
            delta.n * before.d * minRise.d < before.n * delta.d * minRise.n
          )
            return [];
          const productDelta = decimalDifference(
            fact.unitCostAfter,
            fact.unitCostBefore,
          );
          if (productDelta.n <= 0n) return [];
          const q = rows
            .filter(
              (r) =>
                r.metric === "units_sold" &&
                r.dimensionId === fact.productId &&
                r.locationId === fact.locationId,
            )
            .reduce(
              (total, r) => add(total, decimal(String(r.quantity))),
              rational(0n),
            );
          const weekly =
            emitted?.amountMinor ??
            moneyRatio(
              productDelta.n *
                10n ** BigInt(input.minorUnit) *
                q.n *
                BigInt(p.impactDays),
              productDelta.d * q.d * BigInt(p.salesDays),
            );
          const rise =
            (Number(delta.n * before.d) / Number(delta.d * before.n)) * 100;
          const unitMoney = new Intl.NumberFormat("es-EC", {
            style: "currency",
            currency: input.currencyCode,
            minimumFractionDigits: input.minorUnit,
            maximumFractionDigits: 6,
          }).format(Number(productDelta.n) / Number(productDelta.d));
          return [
            candidate(
              input,
              {
                ...base,
                cardKey: rule.id,
                subjectKey: subject,
                context: { ...base.context, emission: { amountMinor: weekly } },
                sender: rule.sender,
                title: policyText(policy, "card_stock_buildFactCandidates_1", {
                  v0: fact.itemLabel,
                }),
                body: policyText(policy, "card_stock_buildFactCandidates_2", {
                  impact: policyText(
                    policy,
                    p.impactDays === 7 ? "impact_week" : "impact_days",
                    { days: p.impactDays },
                  ),
                  v0: fact.itemLabel,
                  v1: Math.round(rise),
                  v2: fact.productLabel,
                  v3: unitMoney,
                  v4: formatMoney(weekly, input.currencyCode, input.minorUnit),
                }),
                amountMinor: weekly,
                quality: "estimated",
                actionKey: rule.actionKey,
              },
              states,
              policy,
            ),
          ];
        }
        const loss = safeInteger(-BigInt(fact.amountMinor)),
          quantity = -Number(fact.quantity);
        const weeklySales =
          emitted?.basis?.weeklySales ??
          sumIntegers(
            input.metrics
              .filter(
                (r) =>
                  r.metric === "revenue" &&
                  r.locationId === fact.locationId &&
                  r.day >= addDays(originDay, -p.weeklyDays) &&
                  r.day < originDay,
              )
              .map((r) => r.amountMinor),
          );
        const localRevenue = rows.filter(
          (r) => r.metric === "revenue" && r.locationId === fact.locationId,
        );
        const totalSales =
          emitted?.basis?.totalSales ??
          sumIntegers(localRevenue.map((r) => r.amountMinor));
        const tickets =
          emitted?.basis?.tickets ??
          sumIntegers(localRevenue.map((r) => r.count));
        if (
          quantity <= 0 ||
          loss < 0 ||
          (tickets > 0 &&
            BigInt(loss) * BigInt(tickets) < BigInt(totalSales)) ||
          BigInt(loss) * decimal(String(p.weeklySalesRatio)).d <
            BigInt(weeklySales) * decimal(String(p.weeklySalesRatio)).n
        )
          return [];
        return [
          candidate(
            input,
            {
              ...base,
              cardKey: rule.id,
              subjectKey: subject,
              context: {
                ...base.context,
                emission: {
                  amountMinor: loss,
                  basis: { weeklySales, totalSales, tickets },
                },
              },
              sender: rule.sender,
              title: policyText(policy, "card_stock_buildFactCandidates_3", {
                v0: fact.itemLabel,
              }),
              body: policyText(policy, "card_stock_buildFactCandidates_5", {
                v0: quantityText(quantity),
                v1: fact.itemUnit
                  ? policyText(policy, "card_stock_buildFactCandidates_4", {
                      v0: fact.itemUnit,
                    })
                  : policyText(policy, "stock_units_generic"),
                v2: fact.itemLabel,
                v3: formatMoney(loss, input.currencyCode, input.minorUnit),
              }),
              amountMinor: loss,
              quality: "observed",
              actionKey: rule.actionKey,
              actionHref: fact.actionHref,
            },
            states,
            policy,
          ),
        ];
      }),
  );
}
export function carryFactCandidate(
  input: AnalyticsInput,
  card: CardCandidate,
  states: readonly CardState[] = [],
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
) {
  const rule = policy.rules.find(
    (r) =>
      r.id === card.cardKey &&
      r.enabled &&
      (r.handler === "cost-rise" || r.handler === "count-gap"),
  );
  if (!rule || !card.originDay) return null;
  const age = daysBetween(card.originDay, input.today);
  if (age < 0) return null;
  return weighStockCard(
    input,
    {
      ...card,
      urgency: rule.parameters.urgency,
      weightMultiplier: rule.parameters.ageDecay ** age,
    },
    states,
    policy,
  );
}

/** The same bounded factual universe is used by daily evaluation and pure simulation. */
export function restoreFactCandidates(
  input: AnalyticsInput,
  states: readonly CardState[],
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
): CardCandidate[] {
  const cards: CardCandidate[] = [];
  for (const control of states) {
    const context = contextRecord(control.context),
      observed = contextRecord(context.sourceFact ?? context.observed),
      fact = observed.fact as AnalyticsFact | undefined;
    if (!fact || typeof observed.eventId !== "string") continue;
    const emission = contextRecord(observed.emission) as FactEmission;
    const map = new Map([
      [`${control.cardKey}:${control.subjectKey}`, emission],
    ]);
    cards.push(
      ...buildFactCandidates(
        input,
        [fact],
        observed.eventId,
        (instant) => localDay(new Date(instant), input.timezone ?? "UTC"),
        [],
        policy,
        map,
      )
        .filter(
          (c) =>
            c.cardKey === control.cardKey &&
            c.subjectKey === control.subjectKey,
        )
        .map((c) => ({
          ...c,
          context: {
            ...c.context,
            sourceKey: observed.sourceKey,
            sourceRevision: observed.sourceRevision,
          },
        })),
    );
  }
  for (const card of input.factCards ?? []) {
    if (
      cards.some(
        (c) => c.cardKey === card.cardKey && c.subjectKey === card.subjectKey,
      )
    )
      continue;
    const control = states.find(
        (s) => s.cardKey === card.cardKey && s.subjectKey === card.subjectKey,
      ),
      context = contextRecord(control?.context);
    if (contextRecord(context.sourceFact ?? context.observed).fact) continue;
    const anchor = control?.episodeStartedAt;
    const originDay =
      card.originDay ??
      (anchor
        ? localDay(new Date(anchor), input.timezone ?? "UTC")
        : undefined);
    const carried = carryFactCandidate(
      input,
      { ...card, originDay },
      [],
      policy,
    );
    if (carried)
      cards.push({
        ...carried,
        context: {
          kind: policy.rules.find((r) => r.id === card.cardKey)?.handler,
          legacyUnknown: true,
          originDay,
        },
      });
  }
  return cards;
}
