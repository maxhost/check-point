import { describe, expect, it } from "vitest";
import {
  buildCandidates,
  calculateGoal,
} from "@mi-pasaporte/domain/analytics/cards/index";
import {
  addDays,
  localDay,
  validDay,
} from "@mi-pasaporte/domain/analytics/date";
import { buildDay, buildHistory } from "@mi-pasaporte/domain/analytics/history";
import {
  cardWeight,
  materialFingerprint,
  novelty,
  selectCards,
} from "@mi-pasaporte/domain/analytics/weights";
import type {
  AnalyticsInput,
  AnalyticsMetric,
  CardCandidate,
  CardState,
} from "@mi-pasaporte/domain/analytics/types";
const row = (
  day: string,
  metric: string,
  amountMinor = 0,
  dimensionId: string | null = null,
  quantity = 0,
  count = 0,
): AnalyticsMetric => ({
  day,
  metric,
  amountMinor,
  dimensionId,
  quantity,
  count,
  currencyCode: "USD",
  minorUnit: 2,
  locationId: "local",
});
function fixture(): AnalyticsInput {
  const metrics: AnalyticsMetric[] = [];
  for (let i = 1; i <= 63; i++) {
    const day = addDays("2026-10-20", -i);
    const slow = new Date(`${day}T12:00Z`).getUTCDay() === 2;
    const revenue = slow ? 1000 : 10000;
    metrics.push(row(day, "revenue", revenue, null, 0, 10));
    for (const id of ["coffee", "pizza"])
      metrics.push(
        row(day, "product_revenue", revenue / 2, id, 0, 5),
        row(day, "units_sold", 0, id, 5),
        row(day, "units_with_cost", 0, id, 5),
        row(day, "cost_of_goods", revenue / 4, id),
      );
  }
  metrics.push(
    row("2026-09-05", "expense_fixed", 600000, "rent"),
    row("2026-08-05", "expense_fixed", 400000, "rent"),
    row("2026-10-01", "expense_fixed", 10000, "electricity"),
    row("2026-09-01", "expense_variable", 30000, "misc"),
  );
  return {
    today: "2026-10-20",
    metrics,
    labels: [
      { kind: "product", id: "coffee", label: "Café" },
      { kind: "product", id: "pizza", label: "Pizza" },
    ],
    locations: [{ id: "local", name: "Centro" }],
    currencyCode: "USD",
    minorUnit: 2,
  };
}
describe("AN-1 weights and selection", () => {
  it("caps five, includes yesterday and excludes below threshold", () => {
    const cards = Array.from({ length: 9 }, (_, i) => ({
      cardKey: String(i),
      subjectKey: String(i),
      weight: i === 0 ? 10 : i / 10,
    }));
    expect(selectCards(cards)).toHaveLength(5);
    expect(selectCards(cards)[0]?.weight).toBe(10);
    expect(
      selectCards([{ cardKey: "4", subjectKey: "", weight: 0.049 }]),
    ).toEqual([]);
  });
  it("decays by days shown and suppresses accepted/dismissed until material change", () => {
    const fingerprint = materialFingerprint("coffee", 100);
    const state: CardState = {
      cardKey: "7",
      subjectKey: "coffee",
      fingerprint,
      status: "shown",
      shownDays: 3,
      lastShownDay: "2026-10-19",
    };
    expect(novelty(fingerprint, state)).toBeCloseTo(0.6 ** 3);
    for (const status of ["accepted", "dismissed"] as const) {
      expect(novelty(fingerprint, { ...state, status })).toBe(0);
      expect(
        novelty(materialFingerprint("coffee", 127), { ...state, status }),
      ).toBe(0);
      expect(
        novelty(materialFingerprint("coffee", 128), { ...state, status }),
      ).toBe(1);
      expect(
        novelty(materialFingerprint("pizza", 100), { ...state, status }),
      ).toBe(1);
    }
    expect(
      cardWeight(
        {
          cardKey: "7",
          subjectKey: "coffee",
          fingerprint,
          amountMinor: 6000,
          minorUnit: 2,
          urgency: 1,
        } as CardCandidate,
        0,
      ),
    ).toBe(3);
  });
});
describe("AN-1 cards and daily goal", () => {
  it("uses paid concepts and estimates from only paid closed months", () => {
    const goal = calculateGoal(fixture());
    expect(goal.expensesMinor).toBe(520000);
    expect(goal.coverage).toBe(1);
    expect(goal.margin).toBe(0.5);
    expect(goal.breakEvenMinor).toBe(1040000);
    expect(goal.estimated).toBe(true);
    expect(goal.concepts.find((c) => c.id === "rent")).toMatchObject({
      amountMinor: 500000,
      estimated: true,
    });
    expect(goal.concepts.find((c) => c.id === "electricity")).toMatchObject({
      amountMinor: 10000,
      estimated: false,
    });
    expect(goal.remainingDays).toBe(12);
    expect(goal.targetMinor).toBe(
      Math.ceil((1040000 - goal.monthRevenueMinor) / 12),
    );
    expect(buildCandidates(fixture()).map((c) => c.cardKey)).toEqual(
      expect.arrayContaining(["1", "2", "3", "13"]),
    );
  });
  it("does not invent a goal in first month, low coverage, covered month, or nonpositive margin", () => {
    const input = fixture();
    const first = {
      ...input,
      metrics: input.metrics.filter((r) => r.day >= "2026-10-01"),
    };
    expect(calculateGoal(first).targetMinor).toBeNull();
    expect(
      buildCandidates(first).find((c) => c.cardKey === "4")?.body,
    ).toContain("primer mes");
    const low = {
      ...input,
      metrics: input.metrics.filter((r) => r.metric !== "units_with_cost"),
    };
    expect(calculateGoal(low).targetMinor).toBeNull();
    expect(buildCandidates(low).some((c) => c.cardKey === "7")).toBe(true);
    const covered = {
      ...input,
      metrics: [...input.metrics, row("2026-10-20", "revenue", 10000000)],
    };
    expect(calculateGoal(covered).targetMinor).toBeNull();
    const negative = {
      ...input,
      metrics: input.metrics.map((r) =>
        r.metric === "cost_of_goods"
          ? { ...r, amountMinor: r.amountMinor * 4 }
          : r,
      ),
    };
    expect(calculateGoal(negative).targetMinor).toBeNull();
    expect(buildCandidates(negative).some((c) => c.cardKey === "6")).toBe(true);
  });
  it("requires 28 days and four same weekdays, includes zero product days in median", () => {
    const input = fixture();
    expect(
      buildCandidates(input).find((c) => c.cardKey === "2")?.body,
    ).toContain("se suelen vender");
    const short = {
      ...input,
      metrics: input.metrics.filter((r) => r.day >= "2026-10-01"),
    };
    expect(
      buildCandidates(short).find((c) => c.cardKey === "2")?.body,
    ).toContain("Necesito");
    expect(buildCandidates(short).some((c) => c.cardKey === "13")).toBe(false);
    const three = {
      ...input,
      metrics: input.metrics.filter(
        (r) =>
          new Date(`${r.day}T12:00Z`).getUTCDay() !== 2 ||
          r.day >= "2026-10-01",
      ),
    };
    expect(buildCandidates(three).some((c) => c.cardKey === "13")).toBe(false);
  });
  it("invites fixed expenses without data; does not expose external context", () => {
    const input = { ...fixture(), metrics: [] };
    expect(buildCandidates(input)).toHaveLength(1);
    expect(buildCandidates(input)[0]?.cardKey).toBe("4");
    expect(JSON.stringify(buildCandidates(input))).not.toMatch(
      /weather|calendar|forecast/,
    );
  });
  it("groups missing costs under the top selling subject and calculates weekly at stake", () => {
    const input = fixture();
    const unknown = {
      ...input,
      metrics: input.metrics.filter((r) => r.metric !== "units_with_cost"),
    };
    const c = buildCandidates(unknown).find((c) => c.cardKey === "7")!;
    expect(c.amountMinor).toBe(61000);
    expect(c.urgency).toBe(1);
    expect(c.body).toContain("1 productos más");
  });
});
describe("AN-1 history, dates and completeness", () => {
  it("supports all periods, local and day, hides incomplete annual comparison", () => {
    const input = fixture();
    for (const period of ["month", "3m", "6m", "9m", "12m"] as const) {
      const history = buildHistory(input, period);
      expect(history.period).toBe(period);
      expect(history.annual).toBeNull();
      expect(history.topProducts).toHaveLength(2);
      expect(history.coverage).toBe(1);
    }
    expect(buildHistory(input, "month", "other").revenueMinor).toBe(0);
    expect(buildDay(input, "2026-10-19").products).toHaveLength(2);
  });
  it("shows annual only when every calendar day is covered", () => {
    const input = fixture();
    const metrics = [...input.metrics];
    for (let i = 1; i <= 20; i++)
      metrics.push(
        row(`2025-10-${String(i).padStart(2, "0")}`, "revenue", 100),
      );
    expect(
      buildHistory({ ...input, metrics }, "month").annual?.revenueMinor,
    ).toBe(2000);
  });
  it("uses business timezone, validates real dates", () => {
    expect(localDay(new Date("2026-10-20T04:30Z"), "America/Guayaquil")).toBe(
      "2026-10-19",
    );
    expect(validDay("2026-02-30")).toBe(false);
    expect(validDay("2026-02-28")).toBe(true);
  });
});

it("history uses full revenue less recorded goods and commission while showing partial coverage", () => {
  const input = fixture();
  input.metrics = [
    row("2026-10-19", "revenue", 10000),
    row("2026-10-19", "product_revenue", 10000, "coffee"),
    row("2026-10-19", "units_sold", 0, "coffee", 10),
    row("2026-10-19", "units_with_cost", 0, "coffee", 5),
    row("2026-10-19", "cost_of_goods", 2000, "coffee"),
    row("2026-10-19", "payment_commission", 1000),
  ];
  expect(buildHistory(input, "month")).toMatchObject({
    grossProfitMinor: 7000,
    coverage: 0.5,
    resultMinor: null,
  });
});
it("learning invitation appears at most once in seven days across all weekdays", () => {
  const input = fixture();
  input.metrics = input.metrics.filter((r) => r.day >= "2026-10-10");
  const state: CardState = {
    cardKey: "2",
    subjectKey: "learning:2026-10-19",
    fingerprint: "x",
    status: "shown",
    shownDays: 1,
    lastShownDay: "2026-10-19",
  };
  expect(buildCandidates(input, [state]).some((c) => c.cardKey === "2")).toBe(
    false,
  );
  expect(
    buildCandidates({ ...input, today: "2026-10-26" }, [state]).some(
      (c) => c.cardKey === "2",
    ),
  ).toBe(true);
});
it("end-of-month goal multiplier survives urgency bounds", () => {
  const input = fixture();
  const card = buildCandidates({ ...input, today: "2026-10-25" }).find(
    (c) => c.cardKey === "3",
  )!;
  expect(card.weightMultiplier).toBe(1.5);
  expect(cardWeight({ ...card, fixedPlata: 1 }, 10000)).toBeCloseTo(
    (1 - 7 / 31) * 1.5,
  );
});
it("fixed estimates take the last three paid months even across gaps, ignoring residual zero rows", () => {
  const input = fixture();
  input.metrics = input.metrics.filter((r) => !r.metric.startsWith("expense_"));
  (input.metrics as AnalyticsMetric[]).push(
    row("2026-05-01", "expense_fixed", 10000, "rent"),
    row("2026-09-01", "expense_fixed", 30000, "rent"),
    row("2026-10-01", "expense_fixed", 0, "rent"),
  );
  expect(calculateGoal(input).concepts[0]).toMatchObject({
    amountMinor: 20000,
    estimated: true,
  });
});
it("low-margin median includes known products with fewer than ten sales", () => {
  const input = fixture();
  input.metrics = [];
  for (const [id, units, profit] of [
    ["target", 10, 100],
    ["a", 1, 1000],
    ["b", 1, 1000],
  ] as const)
    (input.metrics as AnalyticsMetric[]).push(
      row("2026-10-19", "product_revenue", profit * units, id, 0, units),
      row("2026-10-19", "units_sold", 0, id, units),
      row("2026-10-19", "units_with_cost", 0, id, units),
      row("2026-10-19", "cost_of_goods", 0, id),
    );
  expect(
    buildCandidates(input).find((c) => c.cardKey === "6")?.subjectKey,
  ).toBe("target");
});
it("includes uncatalogued sales in coverage and missing-cost cards", () => {
  const input = fixture();
  input.metrics = [
    row("2026-10-19", "revenue", 10000, null, 0, 10),
    row("2026-10-19", "product_revenue", 5000, "coffee", 0, 5),
    row("2026-10-19", "product_revenue", 5000, null, 0, 5),
    row("2026-10-19", "units_sold", 0, "coffee", 5),
    row("2026-10-19", "units_sold", 0, null, 5),
    row("2026-10-19", "units_with_cost", 0, "coffee", 5),
  ];
  expect(buildHistory(input, "month").coverage).toBe(0.5);
  expect(
    buildCandidates(input).find((c) => c.cardKey === "7")?.subjectKey,
  ).toBe("unlisted");
});
