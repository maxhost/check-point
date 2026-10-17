import { describe, expect, it } from "vitest";
import {
  ANALYTICS_POLICY,
  createAnalyticsPolicy,
  policyWindows,
  type AnalyticsPolicyConfig,
} from "@mi-pasaporte/domain/analytics/policy/index";
import { simulateAnalytics } from "@mi-pasaporte/domain/analytics/policy/simulation";
import {
  buildCandidates,
  calculateGoal,
} from "@mi-pasaporte/domain/analytics/cards/index";
import {
  buildStockCandidates,
  stockEvidenceBasis,
} from "@mi-pasaporte/domain/analytics/cards/stock";
import {
  canReopenContext,
  planEpisode,
} from "@mi-pasaporte/domain/analytics/cards/context";
import { addDays } from "@mi-pasaporte/domain/analytics/date";
import type {
  AnalyticsInput,
  AnalyticsMetric,
  CardState,
} from "@mi-pasaporte/domain/analytics/types";
import { calculateGoal as legacyGoal } from "./legacy-goal.test-support";
const now = "2026-10-25T18:00:00.000Z";
const config = (): AnalyticsPolicyConfig => structuredClone(ANALYTICS_POLICY);
const row = (
  day: string,
  metric: string,
  amountMinor = 0,
  quantity = 0,
  dimensionId: string | null = null,
): AnalyticsMetric => ({
  day,
  metric,
  amountMinor,
  quantity,
  dimensionId,
  locationId: "local",
  currencyCode: "USD",
  minorUnit: 2,
  count: 1,
});
export function simulationFixture(): AnalyticsInput {
  const metrics: AnalyticsMetric[] = [];
  for (let age = 1; age <= 28; age++) {
    const day = addDays("2026-10-25", -age);
    metrics.push(
      row(day, "revenue", 100),
      row(day, "product_revenue", 100, 0, "product"),
      row(day, "units_sold", 0, 1, "product"),
      row(day, "units_with_cost", 0, 1, "product"),
      row(day, "cost_of_goods", 40, 0, "product"),
      row(day, "revenue_with_cost", 100, 0, "product"),
      row(day, "payment_commission_with_cost", 0, 0, "product"),
      row(day, "stock_consumption", 0, 1, "item"),
    );
  }
  metrics.push(
    row("2026-09-25", "expense_fixed", 9000, 0, "rent"),
    row("2026-08-25", "expense_fixed", 8000, 0, "rent"),
    row("2026-07-25", "expense_variable", 301),
  );
  return {
    today: "2026-10-25",
    firstSaleDay: "2026-08-01",
    firstConsumptionDays: [
      { locationId: "local", itemId: "item", day: "2026-09-01" },
    ],
    currencyCode: "USD",
    minorUnit: 2,
    locations: [{ id: "local", name: "Centro" }],
    labels: [{ kind: "product", id: "product", label: "Café" }],
    metrics,
    gauges: [
      {
        day: "2026-10-25",
        metric: "stock_on_hand",
        locationId: "local",
        dimensionId: "item",
        quantity: "2",
        amountMinor: "0",
        currencyCode: "",
        minorUnit: 0,
        unit: "kg",
        observedAt: "2026-10-25T12:00:00.000Z",
        eventId: "event",
      },
    ],
  };
}
describe("effective configurable policy and pure lifecycle simulation", () => {
  it("keeps exact three-month money equivalent to the portable legacy oracle, including unpaid concepts/rounding/unknown", () => {
    for (let n = 0; n < 40; n++) {
      const input = simulationFixture();
      input.metrics = [
        ...input.metrics,
        row("2026-06-15", "expense_fixed", n * 101 + 1, 0, "other"),
        row("2026-05-15", "expense_fixed", n * 53 + 2, 0, "other"),
        row("2026-04-15", "expense_fixed", n * 13 + 3, 0, "other"),
        row("2026-09-01", "expense_variable", n * 23 + 1),
      ];
      if (n % 3 === 0)
        input.metrics = input.metrics.filter(
          (r) => r.metric !== "revenue_with_cost",
        );
      expect(calculateGoal(input)).toEqual(legacyGoal(input));
    }
    const c = config();
    c.finance.closedMonths = 2;
    expect(
      calculateGoal(simulationFixture(), createAnalyticsPolicy(c))
        .expensesMinor,
    ).toBe(8500);
  });
  it("composes two IDs of the same handler, including disabled first/active second, without changing shared finance", () => {
    const c = config(),
      stock = c.rules.find((r) => r.id === "8")!;
    stock.enabled = false;
    c.rules = [...c.rules, { ...stock, id: "stock_extra", enabled: true }];
    const goal = c.rules.find((r) => r.id === "3")!;
    c.rules = [
      ...c.rules,
      {
        ...goal,
        id: "goal_extra",
        parameters: { ...goal.parameters, closingPhaseDays: 1 },
      },
    ];
    const policy = createAnalyticsPolicy(c),
      cards = buildCandidates(simulationFixture(), [], policy);
    expect(cards.some((x) => x.cardKey === "8")).toBe(false);
    expect(cards.some((x) => x.cardKey === "stock_extra")).toBe(true);
    expect(cards.find((x) => x.cardKey === "3")?.weightMultiplier).toBe(1.5);
    expect(
      cards.find((x) => x.cardKey === "goal_extra")?.weightMultiplier,
    ).toBe(1);
    expect(calculateGoal(simulationFixture(), policy)).toEqual(
      calculateGoal(simulationFixture()),
    );
  });
  it("changes weight/threshold/window/action from one immutable snapshot and derives the SQL window", () => {
    const input = simulationFixture(),
      before = JSON.stringify(input),
      baseline = buildStockCandidates(input)[0];
    const weight = config();
    Object.assign(weight.rules.find((r) => r.id === "8")!.parameters, {
      fixedPlata: 2,
    });
    expect(
      buildStockCandidates(input, [], createAnalyticsPolicy(weight))[0].weight,
    ).toBe(baseline.weight * 2);
    const threshold = config();
    Object.assign(threshold.rules.find((r) => r.id === "8")!.parameters, {
      riskDays: 1,
      criticalDays: 1,
    });
    expect(
      buildStockCandidates(input, [], createAnalyticsPolicy(threshold)),
    ).toHaveLength(0);
    const action = config();
    action.rules.find((r) => r.id === "8")!.actionKey = "edit_product_price";
    expect(
      buildStockCandidates(input, [], createAnalyticsPolicy(action))[0]
        .actionKey,
    ).toBe("edit_product_price");
    const window = config();
    Object.assign(window.rules.find((r) => r.id === "8")!.parameters, {
      consumptionDays: 70,
    });
    expect(policyWindows(createAnalyticsPolicy(window)).recentDays).toBe(70);
    const changed = {
      ...input,
      metrics: input.metrics.map((r) =>
        r.metric === "stock_consumption" && r.day < "2026-10-11"
          ? { ...r, quantity: 10 }
          : r,
      ),
      gauges: input.gauges!.map((g) => ({ ...g, quantity: "30" })),
    };
    expect(buildStockCandidates(changed)).toHaveLength(1);
    Object.assign(window.rules.find((r) => r.id === "8")!.parameters, {
      consumptionDays: 14,
    });
    expect(
      buildStockCandidates(changed, [], createAnalyticsPolicy(window)),
    ).toHaveLength(0);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("uses configured learning frequency, parks11 and rejects missing/malformed template fields", () => {
    const input = {
      ...simulationFixture(),
      firstSaleDay: "2026-10-24",
      metrics: simulationFixture().metrics.filter((r) => r.day >= "2026-10-24"),
    };
    const state: CardState = {
      cardKey: "2",
      subjectKey: "learning",
      fingerprint: "same",
      status: "open",
      shownDays: 1,
      lastShownDay: "2026-10-24",
    };
    expect(buildCandidates(input, [state]).some((c) => c.cardKey === "2")).toBe(
      false,
    );
    const c = config();
    Object.assign(c.rules.find((r) => r.id === "2")!.parameters, {
      learningCooldownDays: 1,
    });
    expect(
      buildCandidates(input, [state], createAnalyticsPolicy(c)).some(
        (c) => c.cardKey === "2",
      ),
    ).toBe(true);
    expect(buildCandidates(input).some((c) => c.cardKey === "11")).toBe(false);
    Object.assign(c.texts, { card_summary_1: "{{unsupported}}" });
    expect(() => createAnalyticsPolicy(c)).toThrow("Política inválida");
    const missing = config();
    delete (missing.texts as Record<string, string>).card_summary_1;
    expect(() => createAnalyticsPolicy(missing)).toThrow("Política inválida");
  });
  it("shows actual default/custom order and weight components, respects saved expiry even when TTL grows", () => {
    const input = simulationFixture(),
      before = JSON.stringify(input),
      baseline = simulateAnalytics(input, [], now);
    const c = config();
    c.weights.maximumCards = 1;
    const custom = simulateAnalytics(input, [], now, createAnalyticsPolicy(c));
    expect(custom.order).toHaveLength(1);
    expect(baseline.order.length).toBeGreaterThan(1);
    const stock = baseline.candidates.find((c) => c.cardKey === "8")!;
    expect(stock.components).toMatchObject({ plata: 1, novelty: 1 });
    const state: CardState = {
      cardKey: "8",
      subjectKey: stock.subjectKey,
      fingerprint: stock.fingerprint,
      status: "expired",
      shownDays: 1,
      lastShownDay: "2026-07-01",
      episodeStartedAt: "2026-07-01T12:00:00Z",
      expiresAt: "2026-09-29T12:00:00Z",
      context: { observed: stock.context },
    };
    c.lifetime.days = 180;
    expect(
      simulateAnalytics(
        input,
        [state],
        now,
        createAnalyticsPolicy(c),
      ).candidates.find((c) => c.cardKey === "8")?.reason,
    ).toBe("expired");
    console.log(
      "ANALYTICS_POLICY_SIMULATION",
      JSON.stringify({
        default: {
          version: baseline.policyVersion,
          order: baseline.order,
          stock: stock.components,
        },
        custom: { version: custom.policyVersion, order: custom.order },
      }),
    );
    expect(JSON.stringify(input)).toBe(before);
  });
  it("does not invent zero for an unknown gauge quantity", () => {
    const input = simulationFixture(),
      rule = ANALYTICS_POLICY.rules.find((r) => r.id === "8")!;
    for (const quantity of [null, undefined, "", "NaN", "1e999"]) {
      expect(
        stockEvidenceBasis(
          input,
          {
            locationId: "local",
            dimensionId: "item",
            quantity: quantity as unknown as string,
          },
          rule,
        ),
      ).toBeNull();
    }
  });
});
describe("pertinent closed-context comparators", () => {
  const closed = "2026-10-25T12:00:00.000Z";
  it("retires one summary period and reopens only the next, not a changed total of that period", () => {
    const old = { observed: { period: "2026-10-24", revenue: 100 } };
    expect(
      canReopenContext(
        "summary",
        old,
        { period: "2026-10-24", revenue: 900 },
        closed,
      ),
    ).toBe(false);
    expect(
      canReopenContext("summary", old, { period: "2026-10-25" }, closed),
    ).toBe(true);
  });
  it("requires pertinent later consumption or observed recovery then shortage for stock", () => {
    const observed = {
        kind: "stock",
        gauge: { observedAt: "2026-10-25T11:00:00.000Z", quantity: "10" },
      },
      next = {
        kind: "stock",
        gauge: {
          observedAt: "2026-10-25T15:00:00.000Z",
          eventId: "event",
          quantity: "9",
        },
      };
    expect(canReopenContext("stock", { observed }, next, closed)).toBe(false);
    expect(
      canReopenContext(
        "stock",
        {
          observed,
          stockEvidence: {
            consumption: {
              at: "2026-10-25T11:30:00.000Z",
              quantity: "9",
              id: "event",
            },
          },
        },
        next,
        closed,
      ),
    ).toBe(false);
    expect(
      canReopenContext(
        "stock",
        {
          observed,
          stockEvidence: {
            consumption: {
              at: "2026-10-25T15:00:00.000Z",
              quantity: "9",
              id: "event",
            },
          },
        },
        next,
        closed,
      ),
    ).toBe(true);
    expect(
      canReopenContext(
        "stock",
        {
          observed,
          stockEvidence: { recovery: { at: "2026-10-25T14:00:00.000Z" } },
        },
        next,
        closed,
      ),
    ).toBe(true);
  });
  it("keeps old facts/campaign cycles closed and ignores financial clock or unrelated product changes", () => {
    const previous = {
      observed: {
        kind: "campaign",
        cycle: { startsAt: "2026-10-01", finish: "2026-10-20" },
        discount: 10,
      },
    };
    expect(
      canReopenContext(
        "campaign",
        previous,
        { ...previous.observed, discount: 999 },
        closed,
      ),
    ).toBe(false);
    expect(
      canReopenContext(
        "campaign",
        previous,
        {
          ...previous.observed,
          cycle: { startsAt: "2026-10-01", finish: "2026-10-24" },
          sourceKey: "campaign:new",
          sourceRevision: 1,
          snapshot: {
            capturedAt: "2026-10-25T13:00:00Z",
            eventId: "new-applied",
          },
        },
        closed,
      ),
    ).toBe(true);
    expect(
      canReopenContext(
        "count-gap",
        { observed: { eventId: "same" } },
        { eventId: "same", amountMinor: 999 },
        closed,
      ),
    ).toBe(false);
    expect(
      canReopenContext(
        "goal",
        {
          observed: {
            month: "2026-10",
            closing: false,
            gap: "gap:4",
            revenue: 100,
            margin: 0.5,
          },
        },
        {
          month: "2026-10",
          closing: false,
          gap: "gap:5",
          revenue: 100,
          margin: 0.5,
        },
        closed,
      ),
    ).toBe(false);
    const own = { units: 10, cost: 30 };
    expect(
      canReopenContext(
        "margin",
        { observed: { negative: false, material: "product:3", support: own } },
        { negative: false, material: "product:4", support: own },
        closed,
      ),
    ).toBe(false);
    expect(
      canReopenContext(
        "margin",
        { observed: { negative: false, material: "product:3", support: own } },
        {
          negative: true,
          material: "product:4",
          support: { ...own, cost: 100 },
        },
        closed,
      ),
    ).toBe(true);
    expect(
      canReopenContext(
        "unknown-cost",
        { observed: { missingUnits: 3, material: "p:3" } },
        { missingUnits: 3, material: "p:4" },
        closed,
      ),
    ).toBe(false);
  });
});

it("simulates exposed summaries at their fixed weight and factual5/9 from the same bounded source context", () => {
  const input = simulationFixture(),
    baseline = simulateAnalytics(input, [], now),
    summary = baseline.candidates.find((c) => c.cardKey === "1")!;
  const common = {
    status: "open" as const,
    fingerprint: "same",
    shownDays: 4,
    lastShownDay: "2026-10-25",
    episodeStartedAt: now,
    expiresAt: "2027-01-23T18:00:00.000Z",
  };
  const summaryState: CardState = {
    ...common,
    cardKey: "1",
    subjectKey: "summary",
    context: { observed: summary.context },
  };
  expect(
    simulateAnalytics(input, [summaryState], now).candidates.find(
      (c) => c.cardKey === "1",
    ),
  ).toMatchObject({ weight: 10, components: { novelty: 1 } });
  const costFact = {
    kind: "unit_cost_change",
    occurredAt: "2026-10-24T12:00:00.000Z",
    locationId: "local",
    itemId: "item",
    itemLabel: "Harina",
    itemUnit: "kg",
    itemUnitCostBefore: "1",
    itemUnitCostAfter: "1.2",
    productId: "product",
    productLabel: "Café",
    unitCostBefore: "0.4",
    unitCostAfter: "0.6",
    currencyCode: "USD",
    minorUnit: 2,
  };
  const countFact = {
    kind: "count_gap",
    occurredAt: "2026-10-24T12:00:00.000Z",
    locationId: "local",
    itemId: "item",
    itemLabel: "Harina",
    itemUnit: "kg",
    quantity: "-2",
    amountMinor: "-500",
    currencyCode: "USD",
    minorUnit: 2,
    actionHref: "/count/detail",
  };
  const cost: CardState = {
    ...common,
    cardKey: "5",
    subjectKey: "local:item:product",
    context: {
      observed: {
        kind: "cost-rise",
        eventId: "event5",
        fact: { occurredAt: costFact.occurredAt },
      },
      sourceFact: {
        kind: "cost-rise",
        eventId: "event5",
        fact: costFact,
        emission: {
          amountMinor: 140,
          capture: { salesDays: 28, impactDays: 7 },
          basis: { quantitySold: { numerator: "28", denominator: "1" } },
        },
      },
    },
  };
  const count: CardState = {
    ...common,
    cardKey: "9",
    subjectKey: "event9:item",
    context: {
      observed: {
        kind: "count-gap",
        eventId: "event9",
        fact: { occurredAt: countFact.occurredAt },
      },
      sourceFact: {
        kind: "count-gap",
        eventId: "event9",
        fact: countFact,
        emission: {
          amountMinor: 500,
          capture: { salesDays: 28, weeklyDays: 7 },
          basis: { totalSales: 2800, tickets: 28, weeklySales: 700 },
        },
      },
    },
  };
  const facts = simulateAnalytics(input, [cost, count], now).candidates;
  expect(facts.find((c) => c.cardKey === "5")).toMatchObject({
    amountMinor: 140,
    weightMultiplier: 0.7,
  });
  expect(facts.find((c) => c.cardKey === "9")).toMatchObject({
    amountMinor: 500,
    weightMultiplier: 0.7,
  });
  const expired = {
    ...cost,
    status: "expired" as const,
    episodeStartedAt: "2026-07-01T12:00:00.000Z",
    expiresAt: "2026-09-29T12:00:00.000Z",
    context: {
      ...cost.context,
      observed: {
        kind: "cost-rise",
        eventId: "older",
        fact: { occurredAt: "2026-07-01T12:00:00.000Z" },
      },
    },
  };
  const reopened = simulateAnalytics(input, [expired], now).candidates.find(
    (c) => c.cardKey === "5",
  )!;
  expect(reopened).toMatchObject({
    reopens: true,
    reason: "eligible",
    expiresAt: "2027-01-22T12:00:00.000Z",
    components: { novelty: 1 },
    weightMultiplier: 0.7,
  });
});

it("keeps unknown-cost material tied to its own product while preserving aggregate presentation", () => {
  const input = simulationFixture();
  const unknown = (
    ownUnits: number,
    ownRevenue: number,
    otherRevenue: number,
  ) => ({
    ...input,
    metrics: [
      ...input.metrics,
      row("2026-10-24", "product_revenue", ownRevenue, 0, "p1"),
      row("2026-10-24", "revenue_with_cost", 9900, 0, "p1"),
      row("2026-10-24", "units_sold", 0, ownUnits, "p1"),
      row("2026-10-24", "units_with_cost", 0, 9, "p1"),
      row("2026-10-24", "product_revenue", otherRevenue, 0, "p2"),
      row("2026-10-24", "units_sold", 0, 10, "p2"),
    ],
  });
  const before = buildCandidates(unknown(10, 10000, 8000)).find(
      (c) => c.cardKey === "7",
    )!,
    after = buildCandidates(unknown(11, 10001, 9000)).find(
      (c) => c.cardKey === "7",
    )!;
  expect(before.subjectKey).toBe("p1");
  expect(after.subjectKey).toBe("p1");
  expect(after.context!.material).toBe(before.context!.material);
  expect(after.amountMinor).toBeGreaterThan(before.amountMinor!);
  expect(
    canReopenContext(
      "unknown-cost",
      { observed: before.context },
      after.context!,
      now,
    ),
  ).toBe(false);
});

it("rebases5 exactly from captured rational units and requires origin-window snapshots for a changed sales window", () => {
  const input = simulationFixture(),
    occurredAt = "2026-10-24T12:00:00.000Z";
  const fact = {
    kind: "unit_cost_change",
    occurredAt,
    locationId: "local",
    itemId: "item",
    itemLabel: "Harina",
    itemUnit: "kg",
    itemUnitCostBefore: "1",
    itemUnitCostAfter: "1.2",
    productId: "product",
    productLabel: "Café",
    unitCostBefore: "0.4",
    unitCostAfter: "0.6",
    currencyCode: "USD",
    minorUnit: 2,
  };
  const state: CardState = {
    cardKey: "5",
    subjectKey: "local:item:product",
    status: "open",
    fingerprint: "same",
    shownDays: 1,
    lastShownDay: "2026-10-24",
    episodeStartedAt: occurredAt,
    expiresAt: "2027-01-22T12:00:00.000Z",
    context: {
      observed: { kind: "cost-rise", eventId: "event5", fact: { occurredAt } },
      sourceFact: {
        kind: "cost-rise",
        eventId: "event5",
        fact,
        emission: {
          amountMinor: 140,
          capture: { salesDays: 28, impactDays: 7 },
          basis: { quantitySold: { numerator: "28", denominator: "1" } },
        },
      },
    },
  };
  const impact = config();
  Object.assign(impact.rules.find((r) => r.id === "5")!.parameters, {
    impactDays: 14,
  });
  expect(
    simulateAnalytics(
      input,
      [state],
      now,
      createAnalyticsPolicy(impact),
    ).candidates.find((c) => c.cardKey === "5"),
  ).toMatchObject({
    amountMinor: 280,
    weightMultiplier: 0.7,
    expiresAt: state.expiresAt,
  });
  const window = config();
  Object.assign(window.rules.find((r) => r.id === "5")!.parameters, {
    salesDays: 42,
  });
  const policy = createAnalyticsPolicy(window),
    missing = simulateAnalytics(input, [state], now, policy);
  expect(missing.unavailableFacts).toEqual([
    {
      cardKey: "5",
      subjectKey: state.subjectKey,
      eventId: "event5",
      originDay: "2026-10-24",
      requiredDays: 42,
    },
  ]);
  expect(missing.rules.find((r) => r.id === "5")?.reason).toBe(
    "requires_origin_snapshot",
  );
  expect(missing.candidates.some((c) => c.cardKey === "5")).toBe(false);
  const original = {
    ...input,
    today: "2026-10-24",
    readWindows: {
      recentDays: 42,
      closedMonths: 3,
      sameWeekdays: 8,
      anomalyDays: 63,
    },
    metrics: [
      ...Array.from({ length: 42 }, (_, i) =>
        row(
          addDays("2026-10-24", -i - 1),
          "units_sold",
          0,
          i < 28 ? 1 : 10,
          "product",
        ),
      ),
      row("2026-10-24", "units_sold", 0, 99999, "product"),
    ],
  };
  const prepared = {
    ...input,
    factSnapshots: [{ eventId: "event5", input: original }],
  };
  const rebased = simulateAnalytics(
    prepared,
    [state],
    now,
    policy,
  ).candidates.find((c) => c.cardKey === "5")!;
  expect(rebased).toMatchObject({
    amountMinor: 560,
    weightMultiplier: 0.7,
    expiresAt: state.expiresAt,
  });
  const closed = {
    ...state,
    status: "ignored" as const,
    decidedAt: "2026-10-24T13:00:00.000Z",
  };
  expect(
    simulateAnalytics(prepared, [closed], now, policy).candidates.find(
      (c) => c.cardKey === "5",
    ),
  ).toMatchObject({
    reopens: false,
    reason: "attended_context",
    expiresAt: state.expiresAt,
  });
});

it("rebases count9 from revenue before its origin when weeklyDays changes, never from future sales", () => {
  const input = simulationFixture(),
    occurredAt = "2026-10-24T12:00:00.000Z",
    fact = {
      kind: "count_gap",
      occurredAt,
      locationId: "local",
      itemId: "item",
      itemLabel: "Harina",
      itemUnit: "kg",
      quantity: "-2",
      amountMinor: "-500",
      currencyCode: "USD",
      minorUnit: 2,
      actionHref: "/count/detail",
    };
  const state: CardState = {
    cardKey: "9",
    subjectKey: "event9:item",
    status: "open",
    fingerprint: "same",
    shownDays: 0,
    lastShownDay: "2026-10-24",
    episodeStartedAt: occurredAt,
    expiresAt: "2027-01-22T12:00:00.000Z",
    context: {
      observed: { kind: "count-gap", eventId: "event9", fact: { occurredAt } },
      sourceFact: {
        kind: "count-gap",
        eventId: "event9",
        fact,
        emission: {
          amountMinor: 500,
          capture: { salesDays: 28, weeklyDays: 7 },
          basis: { totalSales: 140000, tickets: 2800, weeklySales: 35000 },
        },
      },
    },
  };
  expect(
    simulateAnalytics(input, [state], now).candidates.some(
      (c) => c.cardKey === "9",
    ),
  ).toBe(true);
  const changed = config();
  Object.assign(changed.rules.find((r) => r.id === "9")!.parameters, {
    weeklyDays: 14,
  });
  const policy = createAnalyticsPolicy(changed);
  expect(
    simulateAnalytics(input, [state], now, policy).unavailableFacts[0],
  ).toMatchObject({ cardKey: "9", requiredDays: 28 });
  const original = {
    ...input,
    today: "2026-10-24",
    readWindows: {
      recentDays: 45,
      closedMonths: 3,
      sameWeekdays: 8,
      anomalyDays: 63,
    },
    metrics: [
      ...Array.from({ length: 28 }, (_, i) => ({
        ...row(addDays("2026-10-24", -i - 1), "revenue", 5000),
        count: 100,
      })),
      row("2026-10-24", "revenue", 999999),
    ],
  };
  expect(
    simulateAnalytics(
      { ...input, factSnapshots: [{ eventId: "event9", input: original }] },
      [state],
      now,
      policy,
    ).candidates.some((c) => c.cardKey === "9"),
  ).toBe(false);
});

it("does not reopen stock because a later adjustment, rather than its consumption, lowered the attended quantity; honors causal ties", () => {
  const observed = {
    kind: "stock",
    gauge: {
      observedAt: "2026-10-25T11:00:00.000Z",
      eventId: "old",
      quantity: "10",
    },
  };
  expect(
    canReopenContext(
      "stock",
      {
        observed,
        stockEvidence: {
          consumption: {
            at: "2026-10-25T13:00:00.000Z",
            id: "consumption",
            quantity: "10",
          },
        },
      },
      {
        kind: "stock",
        gauge: {
          observedAt: "2026-10-25T14:00:00.000Z",
          eventId: "adjustment",
          quantity: "8",
        },
      },
      "2026-10-25T12:00:00.000Z",
    ),
  ).toBe(false);
  expect(
    canReopenContext(
      "stock",
      {
        observed,
        stockEvidence: {
          recovery: {
            at: "2026-10-25T14:00:00.000Z",
            id: "a",
            quantity: "100",
          },
        },
      },
      {
        kind: "stock",
        gauge: {
          observedAt: "2026-10-25T14:00:00.000Z",
          eventId: "b",
          quantity: "8",
        },
      },
      "2026-10-25T12:00:00.000Z",
    ),
  ).toBe(true);
});

it("rebases a closed calculated subject when capture parameters change, while labels do not absorb new evidence", () => {
  const input = simulationFixture();
  input.metrics = [
    ...input.metrics,
    row("2026-10-24", "product_revenue", 100, 0, "missing"),
    row("2026-10-24", "units_sold", 0, 1, "missing"),
    row("2026-09-10", "product_revenue", 10000, 0, "missing"),
    row("2026-09-10", "units_sold", 0, 100, "missing"),
  ];
  const before = buildCandidates(input).find((c) => c.cardKey === "7")!;
  const state: CardState = {
    cardKey: "7",
    subjectKey: "missing",
    fingerprint: before.fingerprint,
    status: "ignored",
    shownDays: 2,
    lastShownDay: input.today,
    context: { observed: before.context },
    decidedAt: now,
    episodeStartedAt: now,
    expiresAt: "2027-01-23T18:00:00.000Z",
  };
  const c = config();
  c.rules.find((r) => r.id === "7")!.parameters = {
    ...c.rules.find((r) => r.id === "7")!.parameters,
    salesDays: 56,
  };
  const policy = createAnalyticsPolicy(c);
  const changed = buildCandidates(input, [state], policy).find(
    (c) => c.cardKey === "7",
  )!;
  expect(changed.context!.missingUnits).toBe(101);
  expect(
    simulateAnalytics(input, [state], now, policy).candidates.find(
      (c) => c.cardKey === "7",
    ),
  ).toMatchObject({
    reason: "attended_context",
    reopens: false,
    expiresAt: state.expiresAt,
  });
  const rebased = { ...state, context: { observed: changed.context } };
  const withRealData = {
    ...input,
    metrics: [
      ...input.metrics,
      row("2026-10-25", "product_revenue", 30000, 0, "missing"),
      row("2026-10-25", "units_sold", 0, 100, "missing"),
    ],
  };
  // Builders intentionally exclude today's incomplete day: the next evaluation sees this actual new sale.
  withRealData.today = "2026-10-26";
  const text = structuredClone(policy);
  text.texts = { ...text.texts, action_view_day: "Abrir día" };
  text.rules.find((r) => r.id === "7")!.parameters = {
    ...text.rules.find((r) => r.id === "7")!.parameters,
    normalUrgency: 0.4,
    riskUrgency: 0.9,
  };
  expect(
    simulateAnalytics(
      withRealData,
      [rebased],
      "2026-10-26T18:00:00.000Z",
      createAnalyticsPolicy(text),
    ).candidates.find((c) => c.cardKey === "7"),
  ).toMatchObject({ reason: "eligible", reopens: true });
  for (const handler of ["goal", "expenses", "margin", "unknown-cost"] as const)
    expect(
      canReopenContext(
        handler,
        { observed: { calculationKey: "old" } },
        {
          calculationKey: "new",
          month: "new",
          hasFixed: true,
          negative: true,
          missingUnits: 20,
          material: "p:9",
        },
        now,
      ),
    ).toBe(false);
});

it("retains the captured local origin of facts across a business timezone change", () => {
  const input = simulationFixture();
  input.timezone = "Asia/Tokyo";
  const fact = {
    kind: "count_gap" as const,
    occurredAt: "2026-10-24T23:30:00.000Z",
    locationId: "local",
    itemId: "item",
    itemLabel: "Harina",
    itemUnit: "kg",
    quantity: "-5",
    amountMinor: "-500",
    currencyCode: "USD",
    minorUnit: 2,
    actionHref: "/count",
  };
  const state: CardState = {
    cardKey: "9",
    subjectKey: "event-tz:item",
    status: "open",
    fingerprint: "x",
    shownDays: 0,
    lastShownDay: null,
    episodeStartedAt: fact.occurredAt,
    expiresAt: "2027-01-22T23:30:00.000Z",
    context: {
      originDay: "2026-10-24",
      sourceFact: { eventId: "event-tz", fact },
    },
  };
  const original = {
    ...input,
    today: "2026-10-24",
    readWindows: {
      recentDays: 45,
      closedMonths: 3,
      sameWeekdays: 8,
      anomalyDays: 63,
    },
  };
  input.factSnapshots = [{ eventId: "event-tz", input: original }];
  const result = simulateAnalytics(input, [state], now);
  expect(result.unavailableFacts).toEqual([]);
  expect(result.candidates.find((c) => c.cardKey === "9")).toMatchObject({
    originDay: "2026-10-24",
    period: { from: "2026-10-24", to: "2026-10-24" },
  });
});

it("requires a newly applied campaign cursor after closure, and does not renew an open episode", () => {
  const previous = {
    observed: {
      kind: "campaign",
      cycle: { startsAt: "2026-10-01", finish: "2026-10-20" },
      sourceKey: "campaign:stable",
      sourceRevision: 1,
      snapshot: { capturedAt: "2026-10-20T12:00:00Z", eventId: "old" },
    },
  };
  const shifted = {
    ...previous.observed,
    cycle: { startsAt: "2026-09-30", finish: "2026-10-19" },
  };
  expect(canReopenContext("campaign", previous, shifted, now)).toBe(false);
  const updated = {
    ...shifted,
    sourceRevision: 2,
    snapshot: { capturedAt: "2026-10-26T12:00:00Z", eventId: "new" },
  };
  expect(canReopenContext("campaign", previous, updated, now)).toBe(true);
  expect(
    planEpisode(
      "campaign",
      {
        status: "open",
        context: previous,
        episodeStartedAt: "2026-10-20T12:00:00.000Z",
        expiresAt: "2027-01-18T12:00:00.000Z",
      },
      updated,
      "2026-10-26T18:00:00Z",
      90,
      "2026-10-26T12:00:00Z",
    ),
  ).toMatchObject({
    newEpisode: false,
    startedAt: "2026-10-20T12:00:00.000Z",
    expiresAt: "2027-01-18T12:00:00.000Z",
  });
});
