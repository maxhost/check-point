import { add, rational } from "../../financial/rational";
import {
  ANALYTICS_POLICY,
  policyText,
  type AnalyticsPolicy,
  type AnalyticsRulePolicy,
} from "../policy/index";
import { buildCustomerPromoCandidates } from "./customer-promo";
import { buildStockCandidates } from "./stock";
import {
  addDays,
  addMonths,
  daysBetween,
  formatMoney,
  median,
  monthEnd,
  monthStart,
  weekday,
} from "../date";
import type {
  AnalyticsInput,
  AnalyticsMetric,
  CardCandidate,
  CardState,
} from "../types";
import { cardWeight, materialFingerprint } from "../weights";
import { moneyRatio, roundedMoney, sumIntegers } from "../money";
const sum = (
  rows: readonly AnalyticsMetric[],
  metric: string,
  field: "amountMinor" | "quantity" | "count" = "amountMinor",
) =>
  field === "quantity"
    ? rows
        .filter((r) => r.metric === metric)
        .reduce((n, r) => n + r.quantity, 0)
    : sumIntegers(rows.filter((r) => r.metric === metric).map((r) => r[field]));
const period = (rows: readonly AnalyticsMetric[], from: string, to: string) =>
  rows.filter((r) => r.day >= from && r.day <= to);
export type ProductSummary = {
  id: string;
  label: string;
  revenue: number;
  units: number;
  knownUnits: number;
  salesCount: number;
  cost: number;
  knownRevenue: number;
  exact: boolean;
  profitPerUnit: number | null;
};
export function products(
  input: AnalyticsInput,
  rows: readonly AnalyticsMetric[],
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
): ProductSummary[] {
  const ids = [
    ...new Set(
      rows
        .filter((r) =>
          [
            "product_revenue",
            "units_sold",
            "cost_of_goods",
            "units_with_cost",
          ].includes(r.metric),
        )
        .map((r) => r.dimensionId ?? "unlisted"),
    ),
  ];
  return ids.map((id) => {
    const product = rows.filter((r) => (r.dimensionId ?? "unlisted") === id);
    const revenue = sum(product, "product_revenue");
    const units = sum(product, "units_sold", "quantity");
    const knownUnits = sum(product, "units_with_cost", "quantity");
    const cost = sum(product, "cost_of_goods");
    const knownRevenue = sum(product, "revenue_with_cost");
    const knownCommission = sum(product, "payment_commission_with_cost");
    const lines = sum(product, "cost_of_goods", "count");
    const exact =
      lines > 0 &&
      lines === sum(product, "revenue_with_cost", "count") &&
      lines === sum(product, "payment_commission_with_cost", "count");
    const profit = sumIntegers([knownRevenue, -cost, -knownCommission]);
    return {
      id,
      label:
        input.labels.find((l) => l.kind === "product" && l.id === id)?.label ??
        policyText(
          policy,
          id === "unlisted" ? "product_unlisted" : "product_generic",
        ),
      revenue,
      units,
      knownUnits,
      salesCount: sum(product, "product_revenue", "count"),
      cost,
      knownRevenue,
      exact,
      profitPerUnit: exact && knownUnits > 0 ? profit / knownUnits : null,
    };
  });
}
export function contribution(
  input: AnalyticsInput,
  rows: readonly AnalyticsMetric[],
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
) {
  const product = products(input, rows, policy);
  const units = sum(rows, "units_sold", "quantity");
  const knownUnits = product.reduce(
    (n, p) => n + Math.min(p.units, p.knownUnits),
    0,
  );
  const revenue = sum(rows, "revenue");
  const knownRevenue = sum(rows, "revenue_with_cost");
  const goods = sum(rows, "cost_of_goods");
  const commission = sum(rows, "payment_commission");
  const knownCommission = sum(rows, "payment_commission_with_cost");
  const lines = sum(rows, "cost_of_goods", "count");
  const exact =
    lines > 0 &&
    lines === sum(rows, "revenue_with_cost", "count") &&
    lines === sum(rows, "payment_commission_with_cost", "count");
  const grossProfit = sumIntegers([knownRevenue, -goods, -knownCommission]);
  return {
    coverage: units > 0 ? knownUnits / units : 0,
    revenue,
    knownRevenue,
    goods,
    commission,
    grossProfit,
    exact,
    margin: exact && knownRevenue > 0 ? grossProfit / knownRevenue : null,
  };
}
export type GoalCalculation = {
  expensesMinor: number;
  estimated: boolean;
  concepts: {
    id: string;
    label: string;
    amountMinor: number;
    estimated: boolean;
  }[];
  closedMonth: boolean;
  coverage: number;
  margin: number | null;
  breakEvenMinor: number | null;
  monthRevenueMinor: number;
  remainingDays: number;
  targetMinor: number | null;
  atRisk: boolean;
};
export function calculateGoal(
  input: AnalyticsInput,
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
): GoalCalculation {
  const { salesDays, closedMonths, minimumCoverage } = policy.finance;
  const { today, metrics } = input;
  const start = monthStart(today);
  const closed = period(
    metrics,
    addMonths(start, -closedMonths),
    addDays(start, -1),
  );
  const current = period(metrics, start, today);
  const recent = period(
    metrics,
    addDays(today, -salesDays),
    addDays(today, -1),
  );
  const c = contribution(input, recent, policy);
  const concepts = [
    ...new Set(
      [...metrics.filter((r) => r.day < start), ...current]
        .filter((r) => r.metric === "expense_fixed")
        .map((r) => r.dimensionId ?? "unknown"),
    ),
  ].map((id) => {
    const thisMonth = current.filter(
      (r) =>
        r.metric === "expense_fixed" &&
        (r.dimensionId ?? "unknown") === id &&
        r.amountMinor > 0,
    );
    const previous = new Map<string, number>();
    for (const row of metrics.filter(
      (r) =>
        r.day < start &&
        r.metric === "expense_fixed" &&
        (r.dimensionId ?? "unknown") === id,
    ))
      previous.set(
        row.day.slice(0, 7),
        sumIntegers([previous.get(row.day.slice(0, 7)) ?? 0, row.amountMinor]),
      );
    const paidMonths = [...previous.entries()]
      .filter(([, amount]) => amount > 0)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, closedMonths)
      .map(([, amount]) => amount);
    return {
      id,
      label:
        input.labels.find((l) => l.kind === "concept" && l.id === id)?.label ??
        policyText(policy, "expense_generic"),
      amountMinor: thisMonth.length
        ? sum(thisMonth, "expense_fixed")
        : paidMonths.length
          ? sumIntegers(paidMonths) / paidMonths.length
          : 0,
      estimated: !thisMonth.length,
    };
  });
  const variable = sum(closed, "expense_variable") / closedMonths;
  const expenses = concepts.reduce(
    (total, concept) => {
      if (!concept.estimated)
        return add(total, rational(BigInt(concept.amountMinor)));
      const months = new Map<string, number>();
      for (const row of metrics.filter(
        (r) =>
          r.metric === "expense_fixed" &&
          (r.dimensionId ?? "unknown") === concept.id &&
          r.day < start,
      ))
        months.set(
          row.day.slice(0, 7),
          sumIntegers([months.get(row.day.slice(0, 7)) ?? 0, row.amountMinor]),
        );
      const amounts = [...months]
        .filter(([, v]) => v > 0)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, closedMonths)
        .map(([, v]) => v);
      return amounts.length
        ? add(
            total,
            rational(BigInt(sumIntegers(amounts)), BigInt(amounts.length)),
          )
        : total;
    },
    rational(BigInt(sum(closed, "expense_variable")), BigInt(closedMonths)),
  );
  const expensesMinor = moneyRatio(expenses.n, expenses.d);
  const monthRevenueMinor = sum(current, "revenue");
  const closedMonth =
    input.hasClosedExpenseMonth ??
    metrics
      .filter((r) => r.day < start)
      .some((r) => r.metric.startsWith("expense_") && r.amountMinor > 0);
  const weekdays = new Set(
    recent
      .filter(
        (r) => r.metric === "revenue" && (r.count > 0 || r.amountMinor > 0),
      )
      .map((r) => weekday(r.day)),
  );
  let remainingDays = 0;
  for (let day = today; day <= monthEnd(today); day = addDays(day, 1))
    if (weekdays.has(weekday(day))) remainingDays++;
  const breakEvenMinor =
    closedMonth &&
    c.coverage >= minimumCoverage &&
    c.exact &&
    c.margin !== null &&
    c.margin > 0
      ? moneyRatio(
          expenses.n * BigInt(c.knownRevenue),
          expenses.d * BigInt(c.grossProfit),
          "ceil",
        )
      : null;
  const elapsed = Number(today.slice(8)) - 1;
  const days = Number(monthEnd(today).slice(8));
  const atRisk =
    breakEvenMinor !== null &&
    BigInt(monthRevenueMinor) * BigInt(days) <
      BigInt(breakEvenMinor) * BigInt(Math.max(1, elapsed));
  return {
    expensesMinor,
    estimated: concepts.some((c) => c.estimated) || variable > 0,
    concepts,
    closedMonth,
    coverage: c.coverage,
    margin: c.margin,
    breakEvenMinor,
    monthRevenueMinor,
    remainingDays,
    targetMinor:
      breakEvenMinor !== null &&
      breakEvenMinor > monthRevenueMinor &&
      remainingDays > 0 &&
      atRisk
        ? moneyRatio(
            BigInt(sumIntegers([breakEvenMinor, -monthRevenueMinor])),
            BigInt(remainingDays),
            "ceil",
          )
        : null,
    atRisk,
  };
}
export function buildCandidates(
  input: AnalyticsInput,
  states: readonly CardState[] = [],
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
): CardCandidate[] {
  return policy.rules
    .filter((rule) => rule.enabled)
    .flatMap((rule) => {
      if (rule.handler === "stock")
        return buildStockCandidates(input, states, policy, [rule]);
      if (rule.handler === "voids" || rule.handler === "campaign")
        return buildCustomerPromoCandidates(input, states, policy, [rule]);
      if (
        rule.handler === "customers" ||
        rule.handler === "cost-rise" ||
        rule.handler === "count-gap"
      )
        return [];
      return buildRuleCandidates(input, states, policy, rule);
    });
}
function buildRuleCandidates(
  input: AnalyticsInput,
  states: readonly CardState[],
  policy: AnalyticsPolicy,
  rule: AnalyticsRulePolicy,
): CardCandidate[] {
  const { today, metrics } = input,
    p = rule.parameters,
    yesterday = addDays(today, -1);
  const recent = period(
    metrics,
    addDays(today, -(p.salesDays ?? policy.finance.salesDays)),
    yesterday,
  );
  const goal = calculateGoal(input, policy);
  const average =
    sum(
      period(
        metrics,
        addDays(today, -policy.weights.averageDailyDays),
        yesterday,
      ),
      "revenue",
    ) / policy.weights.averageDailyDays;
  const window = () =>
    policyText(policy, p.salesDays % 7 === 0 ? "window_weeks" : "window_days", {
      weeks: p.salesDays / 7,
      days: p.salesDays,
    });
  const money = (n: number) =>
    formatMoney(roundedMoney(n), input.currencyCode, input.minorUnit);
  const candidates: CardCandidate[] = [];
  const add = (
    card: Omit<
      CardCandidate,
      | "currencyCode"
      | "minorUnit"
      | "fingerprint"
      | "weight"
      | "locationId"
      | "cardKey"
      | "sender"
      | "actionKey"
    >,
  ) => {
    const candidate: CardCandidate = {
      ...card,
      cardKey: rule.id,
      sender: rule.sender,
      actionKey: rule.actionKey,
      category: card.category ?? rule.category,
      currencyCode: input.currencyCode,
      minorUnit: input.minorUnit,
      locationId: null,
      fingerprint: materialFingerprint(
        card.subjectKey,
        card.amountMinor,
        policy,
      ),
      weight: 0,
    };
    candidate.weight = cardWeight(
      candidate,
      average,
      states.find(
        (s) => s.cardKey === rule.id && s.subjectKey === card.subjectKey,
      ),
      policy,
    );
    candidates.push(candidate);
  };
  switch (rule.handler) {
    case "summary": {
      const yesterdayRows = period(metrics, yesterday, yesterday);
      const yesterdayRevenue = sum(yesterdayRows, "revenue");
      if (sum(yesterdayRows, "revenue", "count") > 0 || yesterdayRevenue > 0) {
        const previous = sum(
          period(
            metrics,
            addDays(yesterday, -p.comparisonDays),
            addDays(yesterday, -p.comparisonDays),
          ),
          "revenue",
        );
        const top = products(input, yesterdayRows, policy).sort(
          (a, b) => b.units - a.units,
        )[0];
        const comparison =
          previous > 0
            ? policyText(policy, "summary_comparison", {
                percent: Math.round(
                  Math.abs(yesterdayRevenue / previous - 1) * 100,
                ),
                direction: policyText(
                  policy,
                  yesterdayRevenue >= previous
                    ? "summary_more"
                    : "summary_less",
                ),
                reference: policyText(
                  policy,
                  p.comparisonDays === 7
                    ? "summary_comparison_week"
                    : "summary_comparison_days",
                  { days: p.comparisonDays },
                ),
              })
            : "";
        const byLocation =
          input.locations.length > 1
            ? input.locations
                .map((l) => {
                  const rows = yesterdayRows.filter(
                    (r) => r.locationId === l.id,
                  );
                  return sum(rows, "revenue", "count") > 0 ||
                    sum(rows, "revenue") > 0
                    ? policyText(policy, "summary_location", {
                        label: l.name,
                        amount: money(sum(rows, "revenue")),
                        tickets: sum(rows, "revenue", "count"),
                      })
                    : "";
                })
                .filter(Boolean)
                .join("\n")
            : "";
        add({
          subjectKey: "summary",
          period: { from: yesterday, to: yesterday, label: "" },
          context: {
            kind: "summary",
            period: yesterday,
            revenue: yesterdayRevenue,
            count: sum(yesterdayRows, "revenue", "count"),
            previous,
            top: top ? { id: top.id, units: top.units } : null,
            locations: yesterdayRows
              .filter((r) => r.metric === "revenue")
              .map((r) => [r.locationId, r.amountMinor, r.count]),
          },

          title: policyText(policy, "card_summary_1"),
          body: policyText(policy, "card_summary_4", {
            v0: money(yesterdayRevenue),
            v1: sum(yesterdayRows, "revenue", "count"),
            v2: comparison,
            v3: top
              ? policyText(policy, "card_summary_2", {
                  v0: top.label,
                  v1: top.units,
                })
              : "",
            v4: byLocation
              ? policyText(policy, "card_summary_3", { v0: byLocation })
              : "",
          }),
          amountMinor: yesterdayRevenue,
          quality: "observed",

          actionHref: `/backoffice/analytics?date=${yesterday}`,
          urgency: policy.weights.maximumUrgency,
        });
      }
      break;
    }
    case "demand": {
      const first =
        input.firstSaleDay ??
        metrics
          .filter(
            (r) => r.metric === "revenue" && (r.count > 0 || r.amountMinor > 0),
          )
          .map((r) => r.day)
          .sort()[0];
      const sameDays = [
        ...new Set(
          metrics
            .filter(
              (r) =>
                r.metric === "revenue" &&
                (r.count > 0 || r.amountMinor > 0) &&
                r.day < today &&
                weekday(r.day) === weekday(today),
            )
            .map((r) => r.day),
        ),
      ]
        .sort()
        .reverse()
        .slice(0, p.maximumOccurrences);
      const ready =
        !!first &&
        daysBetween(first, today) >= p.historyDays &&
        sameDays.length >= p.minimumOccurrences;
      const dayName = new Intl.DateTimeFormat("es-EC", {
        weekday: "long",
        timeZone: "UTC",
      }).format(new Date(`${today}T12:00:00Z`));
      if (ready) {
        const forecasts = products(
          input,
          metrics.filter((r) => sameDays.includes(r.day)),
          policy,
        )
          .map((p) => ({
            ...p,
            expected: median(
              sameDays.map((day) =>
                sum(
                  metrics.filter(
                    (r) => r.day === day && r.dimensionId === p.id,
                  ),
                  "units_sold",
                  "quantity",
                ),
              ),
            ),
          }))
          .sort((a, b) => b.expected - a.expected)
          .filter((p) => p.expected > 0)
          .slice(0, p.topProducts);
        if (forecasts.length)
          add({
            subjectKey: "forecast",
            period: { from: today, to: today, label: "" },
            context: {
              kind: "demand",
              target: today,
              sameDays,
              forecasts: forecasts.map((p) => [p.id, p.expected]),
            },

            title: policyText(policy, "card_demand_1"),
            body: policyText(policy, "card_demand_3", {
              v0: dayName,
              v1: forecasts
                .map((p) =>
                  policyText(policy, "card_demand_2", {
                    v0: Math.round(p.expected),
                    v1: p.label,
                  }),
                )
                .join(", "),
            }),
            amountMinor: null,
            fixedPlata: p.fixedPlata,
            urgency: p.urgency,
            quality: "observed",
          });
      } else if (
        first &&
        !states.some(
          (s) =>
            s.cardKey === rule.id &&
            (s.subjectKey === "learning" ||
              s.subjectKey.startsWith("learning:")) &&
            s.shownDays > 0 &&
            s.lastShownDay &&
            daysBetween(s.lastShownDay, today) < p.learningCooldownDays,
        )
      ) {
        add({
          subjectKey: "learning",
          period: { from: today, to: today, label: "" },
          context: {
            kind: "learning",
            first,
            occurrences: sameDays.length,
            historyReady: daysBetween(first, today) >= p.historyDays,
          },

          title: policyText(policy, "card_demand_4"),
          body: policyText(policy, "card_demand_5", {
            v0: Math.max(1, p.minimumOccurrences - sameDays.length),
            v1: dayName,
            v2:
              daysBetween(first, today) < p.historyDays
                ? policyText(policy, "demand_history_missing", {
                    days: p.historyDays,
                  })
                : "",
            v3: dayName,
          }),
          amountMinor: null,
          fixedPlata: p.fixedPlata,
          urgency: p.urgency,
          quality: "observed",
        });
      }
      break;
    }
    case "goal": {
      const daysLeft = daysBetween(today, monthEnd(today)) + 1;
      const lastTen = daysLeft <= p.closingPhaseDays;
      if (goal.targetMinor !== null) {
        const gap = Math.max(
          0,
          moneyRatio(
            BigInt(goal.breakEvenMinor ?? 0) * BigInt(Number(today.slice(8))) -
              BigInt(goal.monthRevenueMinor) *
                BigInt(Number(monthEnd(today).slice(8))),
            BigInt(Number(monthEnd(today).slice(8))),
          ),
        );
        add({
          subjectKey: monthStart(today),
          period: { from: monthStart(today), to: today, label: "" },
          context: {
            kind: "goal",
            month: monthStart(today),
            gap: materialFingerprint("gap", gap, policy),
            margin: goal.margin,
            coverage: goal.coverage,
            revenue: goal.monthRevenueMinor,
            closing: lastTen,
            expenses: goal.expensesMinor,
          },

          title: policyText(policy, "card_goal_1"),
          body: policyText(policy, "card_goal_2", {
            v0: money(goal.targetMinor),
            v1: money((goal.breakEvenMinor ?? 0) - goal.monthRevenueMinor),
            v2: goal.remainingDays,
          }),
          amountMinor: roundedMoney(gap),
          urgency: 1 - daysLeft / Number(monthEnd(today).slice(8)),
          weightMultiplier: lastTen ? p.closingMultiplier : 1,
          quality: goal.estimated ? "estimated" : "observed",

          actionHref: "/backoffice/analytics?period=month#calculo",
        });
      }
      break;
    }
    case "expenses": {
      const lastTen =
        daysBetween(today, monthEnd(today)) + 1 <= p.closingPhaseDays;
      const hasFixed = metrics.some(
        (r) =>
          r.day >= addDays(today, -p.missingFixedDays) &&
          r.day <= today &&
          r.metric === "expense_fixed" &&
          r.amountMinor > 0,
      );
      if (!hasFixed || !goal.closedMonth) {
        const firstMonth =
          metrics.some(
            (r) =>
              r.day >= monthStart(today) &&
              r.day <= today &&
              r.metric.startsWith("expense_") &&
              r.amountMinor > 0,
          ) && !goal.closedMonth;
        add({
          subjectKey: "expenses",
          category: firstMonth ? "informational" : rule.category,
          context: {
            kind: "expenses",
            hasFixed,
            closedMonth: goal.closedMonth,
            firstMonth,
          },

          title: firstMonth
            ? policyText(policy, "card_expenses_1")
            : policyText(policy, "card_expenses_2"),
          body:
            (firstMonth
              ? policyText(policy, "card_expenses_3")
              : policyText(policy, "card_expenses_4")) +
            ((input.hasData ?? metrics.length > 0) === false
              ? policyText(policy, "card_expenses_5")
              : policyText(policy, "card_expenses_6")),
          amountMinor: null,
          fixedPlata: p.fixedPlata,
          urgency: lastTen ? p.closingUrgency : p.normalUrgency,
          quality: "observed",
        });
      }
      break;
    }
    case "margin": {
      const recentProducts = products(input, recent, policy);
      const known = recentProducts.filter(
        (product) =>
          product.salesCount >= p.minimumSales &&
          product.profitPerUnit !== null,
      );
      const profitMedian = median(
        recentProducts
          .filter((product) => product.profitPerUnit !== null)
          .map((product) => product.profitPerUnit!),
      );
      for (const product of known.filter(
        (product) =>
          product.profitPerUnit! < 0 ||
          product.profitPerUnit! < profitMedian * p.medianRatio,
      )) {
        const negative = product.profitPerUnit! < 0;
        const amount =
          ((negative
            ? -product.profitPerUnit!
            : profitMedian - product.profitPerUnit!) *
            product.units) /
          (p.salesDays / p.impactDays);
        add({
          subjectKey: product.id,
          context: {
            kind: "margin",
            negative,
            unitProfit: product.profitPerUnit,
            median: profitMedian,
            material: materialFingerprint(
              product.id,
              roundedMoney(amount),
              policy,
            ),
            support: {
              units: product.units,
              knownUnits: product.knownUnits,
              cost: product.cost,
              knownRevenue: product.knownRevenue,
            },
          },

          title: negative
            ? policyText(policy, "card_margin_1")
            : policyText(policy, "card_margin_2"),
          body: negative
            ? policyText(policy, "card_margin_3", {
                window: window(),
                v0: product.label,
                v1: money(-product.profitPerUnit!),
                v2: product.units,
              })
            : policyText(policy, "card_margin_4", {
                window: window(),
                v0: product.label,
                v1: money(product.profitPerUnit!),
                v2: money(profitMedian),
                v3: product.units,
              }),
          amountMinor: roundedMoney(amount),
          urgency:
            goal.atRisk || goal.margin === null || goal.margin <= 0
              ? p.riskUrgency
              : p.normalUrgency,
          quality: "observed",
        });
      }
      break;
    }
    case "unknown-cost": {
      const recentProducts = products(input, recent, policy);
      const unknown = recentProducts
        .filter((p) => p.units > p.knownUnits)
        .sort((a, b) => b.revenue - a.revenue);
      if (unknown.length) {
        const revenue = sumIntegers(
          unknown.map((p) => sumIntegers([p.revenue, -p.knownRevenue])),
        );
        add({
          subjectKey: unknown[0]!.id,
          context: {
            kind: "unknown-cost",
            product: unknown[0]!.id,
            material: materialFingerprint(unknown[0]!.id, revenue, policy),
            missingUnits: unknown[0]!.units - unknown[0]!.knownUnits,
            knownUnits: unknown[0]!.knownUnits,
          },

          title: policyText(policy, "card_unknown_cost_1"),
          body: policyText(policy, "card_unknown_cost_3", {
            window: window(),
            v0: unknown[0]!.label,
            v1:
              unknown.length > 1
                ? policyText(policy, "card_unknown_cost_2", {
                    v0: unknown.length - 1,
                  })
                : "",
            v2: money(revenue),
          }),
          amountMinor: moneyRatio(
            BigInt(revenue) * BigInt(p.impactDays),
            BigInt(p.salesDays),
          ),
          urgency:
            goal.coverage < p.minimumCoverage ? p.riskUrgency : p.normalUrgency,
          quality: "observed",
        });
      }
      break;
    }
    case "slow-day": {
      const first =
        input.firstSaleDay ??
        metrics
          .filter(
            (r) => r.metric === "revenue" && (r.count > 0 || r.amountMinor > 0),
          )
          .map((r) => r.day)
          .sort()[0];
      const sameDays = [
        ...new Set(
          metrics
            .filter(
              (r) =>
                r.metric === "revenue" &&
                (r.count > 0 || r.amountMinor > 0) &&
                r.day < today &&
                weekday(r.day) === weekday(today),
            )
            .map((r) => r.day),
        ),
      ]
        .sort()
        .reverse()
        .slice(0, p.maximumOccurrences);
      const ready =
        !!first &&
        daysBetween(first, today) >= p.historyDays &&
        sameDays.length >= p.minimumOccurrences;
      const dayName = new Intl.DateTimeFormat("es-EC", {
        weekday: "long",
        timeZone: "UTC",
      }).format(new Date(`${today}T12:00:00Z`));
      const recentProducts = products(input, recent, policy);
      const costedProducts = recentProducts.filter(
        (p) => p.profitPerUnit !== null,
      );
      if (
        ready &&
        costedProducts.length >= p.minimumProducts &&
        sum(recent, "revenue", "count") >= p.minimumSales
      ) {
        const expected = median(
          sameDays.map((day) =>
            sum(
              metrics.filter((r) => r.day === day),
              "revenue",
            ),
          ),
        );
        if (expected < average * p.slowRatio) {
          const best = [...costedProducts]
            .sort((a, b) => b.profitPerUnit! - a.profitPerUnit!)
            .slice(0, p.topProducts);
          add({
            subjectKey: "slow-day",
            period: { from: today, to: today, label: "" },
            context: {
              kind: "slow-day",
              target: today,
              sameDays,
              expected,
              best: best.map((p) => [p.id, p.profitPerUnit]),
            },

            title: policyText(policy, "card_slow_day_1"),
            body: policyText(policy, "card_slow_day_3", {
              v0: dayName,
              v1: money(expected),
              v2: money(average),
              v3: best
                .map((p) =>
                  policyText(policy, "card_slow_day_2", {
                    v0: p.label,
                    v1: money(p.profitPerUnit!),
                  }),
                )
                .join(" y "),
            }),
            amountMinor: roundedMoney(average - expected),
            urgency:
              goal.targetMinor !== null ? p.riskUrgency : p.normalUrgency,
            quality: "observed",
          });
        }
      }
      break;
    }
    default:
      break;
  }
  return candidates;
}
