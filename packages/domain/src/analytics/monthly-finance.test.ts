import { describe, expect, it } from "vitest";
import { buildMonthlyFinance, salesBasis } from "./monthly-finance";
import { calculateGoal, buildCandidates } from "./cards/index";
import { summarizeHistory } from "./history";
import { buildDashboardSummary } from "./dashboard-summary-calculation";
import { ANALYTICS_POLICY, createAnalyticsPolicy } from "./policy/index";
import { parseDashboardSummary } from "./dashboard-summary";
import type { AnalyticsInput, AnalyticsMetric } from "./types";

const row = (
  metric: string,
  amountMinor = 0,
  day = "2026-10-18",
  patch: Partial<AnalyticsMetric> = {},
): AnalyticsMetric => ({
  metric,
  amountMinor,
  day,
  quantity: 0,
  count: 1,
  dimensionId: "p",
  locationId: "local",
  currencyCode: "USD",
  minorUnit: 2,
  ...patch,
});
const sale = (
  day: string,
  revenue = 100,
  cost = 40,
  commission = 10,
  product = "p",
) => [
  row("revenue", revenue, day, { dimensionId: null }),
  row("product_revenue", revenue, day, { dimensionId: product }),
  row("units_sold", 0, day, {
    dimensionId: product,
    currencyCode: "",
    minorUnit: 0,
    quantity: 2,
  }),
  row("units_with_cost", 0, day, {
    dimensionId: product,
    currencyCode: "",
    minorUnit: 0,
    quantity: 2,
  }),
  row("cost_of_goods", cost, day, { dimensionId: product }),
  row("revenue_with_cost", revenue, day, { dimensionId: product }),
  row("payment_commission", commission, day, { dimensionId: null, count: 0 }),
  row("payment_commission_with_cost", commission, day, {
    dimensionId: product,
  }),
];
const fixture = (): AnalyticsInput & {
  timezone: string;
  metrics: AnalyticsMetric[];
} => ({
  today: "2026-10-20",
  timezone: "America/Guayaquil",
  currencyCode: "USD",
  minorUnit: 2,
  labels: [{ kind: "concept", id: "rent", label: "Alquiler" }],
  locations: [{ id: "local", name: "Principal" }],
  metrics: [
    row("expense_fixed", 1000, "2026-09-01", { dimensionId: "rent" }),
    row("expense_fixed", 500, "2026-10-01", { dimensionId: "rent" }),
    row("expense_variable", 200, "2026-09-01", { dimensionId: "v" }),
    row("expense_variable", 50, "2026-10-01", { dimensionId: "v" }),
    ...sale("2026-09-25", 1000, 400, 100),
    ...sale("2026-10-18"),
  ],
});

describe("monthly finance v2", () => {
  it("uses actual plus pending, net contribution and an exact remaining-sales quotient", () => {
    const f = buildMonthlyFinance(fixture());
    expect(f).toMatchObject({
      version: 2,
      from: "2026-10-01",
      to: "2026-10-31",
      asOf: "2026-10-20",
      status: "estimated",
      reasons: [],
      recordedExpensesMinor: 550,
      pendingExpensesMinor: 650,
      forecastExpensesMinor: 1200,
      monthRevenueMinor: 100,
      monthContributionMinor: 50,
      remainingSalesMinor: 2300,
      totalSalesTargetMinor: 2400,
      unitCoverage: 1,
      revenueCoverage: 1,
      referenceFrom: "2026-09-22",
      referenceTo: "2026-10-19",
    });
    expect(f.expenses).toEqual([
      {
        id: "rent",
        label: "Alquiler",
        kind: "fixed",
        recordedMinor: 500,
        referenceMinor: 1000,
        referenceMonths: 1,
        pendingMinor: 500,
        forecastMinor: 1000,
      },
      {
        id: "variable",
        label: "Gastos variables",
        kind: "variable",
        recordedMinor: 50,
        referenceMinor: 200,
        referenceMonths: 1,
        pendingMinor: 150,
        forecastMinor: 200,
      },
    ]);
    const goal = calculateGoal(fixture());
    expect(goal.finance).toEqual(f);
    expect(goal.breakEvenMinor).toBe(f.totalSalesTargetMinor);
    expect(goal.expensesMinor).toBe(1200);
    expect(goal.targetMinor).toBe(Math.ceil(2300 / goal.remainingDays));
  });
  it("counts only observed months inside the prior three calendar months and rounds each reference once", () => {
    const i = fixture();
    i.metrics = i.metrics.filter((r) => !r.metric.startsWith("expense_"));
    i.metrics.push(
      row("expense_fixed", 100, "2026-09-01", { dimensionId: "a" }),
      row("expense_fixed", 101, "2026-08-01", { dimensionId: "a" }),
      row("expense_fixed", 9999, "2026-06-01", { dimensionId: "a" }),
      row("expense_variable", 100, "2026-07-01"),
      row("expense_variable", 101, "2026-09-01"),
    );
    const f = buildMonthlyFinance(i);
    expect(
      f.expenses.map((e) => [e.referenceMonths, e.referenceMinor]),
    ).toEqual([
      [2, 101],
      [2, 101],
    ]);
    expect(f.forecastExpensesMinor).toBe(202);
    expect(f.recordedExpensesMinor).toBe(0);
    expect(f.pendingExpensesMinor).toBe(202);
  });
  it("keeps policy overrides aligned with the reader's financial windows", () => {
    const i = fixture(),
      config = structuredClone(ANALYTICS_POLICY);
    config.finance.salesDays = 7;
    config.finance.closedMonths = 1;
    const goal = calculateGoal(i, createAnalyticsPolicy(config));
    expect(goal.finance.referenceFrom).toBe("2026-10-13");
    expect(goal.margin).toBe(0.5); // the recent current sale supplies the shorter reference
    i.metrics = i.metrics.filter(
      (r) => r.metric !== "expense_variable" || r.day !== "2026-09-01",
    );
    i.metrics.push(row("expense_variable", 800, "2026-08-01"));
    expect(calculateGoal(i).finance.forecastExpensesMinor).toBe(1800);
    expect(
      calculateGoal(i, createAnalyticsPolicy(config)).finance,
    ).toMatchObject({
      forecastExpensesMinor: null,
      reasons: ["expense_history"],
    });
  });
  it("never drops current payments above reference and does not add the full reference again", () => {
    const i = fixture();
    i.metrics.find(
      (r) => r.metric === "expense_fixed" && r.day.startsWith("2026-10"),
    )!.amountMinor = 1500;
    i.metrics.find(
      (r) => r.metric === "expense_variable" && r.day.startsWith("2026-10"),
    )!.amountMinor = 350;
    expect(buildMonthlyFinance(i)).toMatchObject({
      recordedExpensesMinor: 1850,
      pendingExpensesMinor: 0,
      forecastExpensesMinor: 1850,
    });
  });
  it("marks missing fixed/variable history unknown regardless of the old closed-month flag", () => {
    const i = fixture();
    i.hasClosedExpenseMonth = true;
    i.metrics.push(
      row("expense_fixed", 777, "2026-10-01", { dimensionId: "new" }),
    );
    let f = buildMonthlyFinance(i);
    expect(f).toMatchObject({
      status: "unavailable",
      reasons: ["expense_history"],
      pendingExpensesMinor: null,
      forecastExpensesMinor: null,
      remainingSalesMinor: null,
      totalSalesTargetMinor: null,
      recordedExpensesMinor: 1327,
    });
    expect(f.expenses.find((e) => e.id === "new")).toMatchObject({
      referenceMonths: 0,
      referenceMinor: null,
      pendingMinor: null,
    });
    expect(calculateGoal(i).expensesMinor).toBe(1327);
    expect(calculateGoal(i).breakEvenMinor).toBeNull();
    expect(buildDashboardSummary(i, new Date()).unavailableReason).toBe(
      "expense_history",
    );
    i.metrics = i.metrics.filter(
      (r) => r.metric !== "expense_variable" || r.day.startsWith("2026-10"),
    );
    f = buildMonthlyFinance(i);
    expect(f.expenses.at(-1)?.referenceMinor).toBeNull();
  });
  it.each([
    "units_with_cost",
    "product_revenue",
    "revenue_with_cost",
    "payment_commission_with_cost",
    "payment_commission",
    "cost_of_goods",
  ])(
    "blocks unknown %s even with 100%% coverage by other measures",
    (metric) => {
      const i = fixture();
      i.metrics = i.metrics.filter(
        (r) => !(r.day === "2026-10-18" && r.metric === metric),
      );
      expect(buildMonthlyFinance(i)).toMatchObject({
        status: "unavailable",
        reasons: ["sales_costs"],
        monthContributionMinor: null,
        remainingSalesMinor: null,
      });
      expect(calculateGoal(i).targetMinor).toBeNull();
      expect(buildCandidates(i).some((c) => c.cardKey === "3")).toBe(false);
    },
  );
  it("blocks today's unknown sales instead of extrapolating the prior valid margin", () => {
    const i = fixture();
    i.metrics.push(
      row("revenue", 9999, i.today),
      row("units_sold", 0, i.today, {
        quantity: 20,
        currencyCode: "",
        minorUnit: 0,
      }),
    );
    expect(buildMonthlyFinance(i)).toMatchObject({
      reasons: ["sales_costs"],
      monthContributionMinor: null,
      remainingSalesMinor: null,
    });
  });
  it("rejects excess known units/revenue/counts and prevents compensation between products", () => {
    for (const field of ["quantity", "amountMinor", "count"] as const) {
      const i = fixture();
      i.metrics.push(...sale("2026-10-18", 100, 40, 10, "other"));
      const metric =
        field === "quantity"
          ? "units_with_cost"
          : field === "count"
            ? "cost_of_goods"
            : "revenue_with_cost";
      const a = i.metrics.find(
        (r) =>
          r.day === "2026-10-18" &&
          r.dimensionId === "p" &&
          r.metric === metric,
      )!;
      const b = i.metrics.find(
        (r) =>
          r.day === "2026-10-18" &&
          r.dimensionId === "other" &&
          r.metric === metric,
      )!;
      a[field] += 1;
      b[field] -= 1;
      expect(buildMonthlyFinance(i).reasons).toContain("sales_costs");
    }
  });
  it("does not offset missing costs between days or locals and rejects fractional legacy units", () => {
    for (const segment of ["day", "locationId"] as const) {
      const i = fixture();
      const second = sale("2026-10-18").map((r) => ({
        ...r,
        [segment]: segment === "day" ? "2026-10-19" : "north",
      }));
      i.metrics.push(...second);
      const known = i.metrics.filter(
        (r) => r.metric === "units_with_cost" && r.day !== "2026-09-25",
      );
      known[0]!.quantity = 1;
      known[1]!.quantity = 3;
      expect(buildMonthlyFinance(i).reasons).toContain("sales_costs");
    }
    const i = fixture();
    i.metrics = i.metrics.flatMap((r) =>
      r.metric === "units_sold"
        ? [
            { ...r, quantity: 0.1 },
            { ...r, quantity: 0.2 },
          ]
        : r.metric === "units_with_cost"
          ? [{ ...r, quantity: 0.3 }]
          : [r],
    );
    expect(buildMonthlyFinance(i).reasons).toContain("sales_costs");
    i.metrics = fixture().metrics;
    // Editing/deleting a source leaves zero daily aggregates; they are not missing sales.
    i.metrics.push(
      row("cost_of_goods", 0, "2026-10-18", {
        dimensionId: "deleted",
        count: 0,
      }),
    );
    expect(buildMonthlyFinance(i).reasons).toEqual([]);
  });
  it("accepts no current sales as contribution zero, but requires positive complete reference sales", () => {
    const i = fixture();
    i.metrics = i.metrics.filter((r) => r.day !== "2026-10-18");
    expect(buildMonthlyFinance(i)).toMatchObject({
      monthContributionMinor: 0,
      remainingSalesMinor: 2400,
      totalSalesTargetMinor: 2400,
    });
    i.metrics = i.metrics.filter((r) => r.day !== "2026-09-25");
    expect(buildMonthlyFinance(i)).toMatchObject({
      reasons: ["reference_sales"],
      remainingSalesMinor: null,
    });
  });
  it.each([0, -10])(
    "blocks reference margin %s and preserves multiple reasons in priority order",
    (profit) => {
      const i = fixture();
      i.metrics = i.metrics.filter(
        (r) => r.day !== "2026-09-25" && r.day !== "2026-10-18",
      );
      i.metrics.push(...sale("2026-09-25", 100, 100 - profit, 0));
      expect(buildMonthlyFinance(i)).toMatchObject({
        reasons: ["positive_margin"],
        remainingSalesMinor: null,
      });
      i.metrics = i.metrics.filter((r) => r.metric !== "expense_variable");
      expect(buildMonthlyFinance(i).reasons).toEqual([
        "expense_history",
        "positive_margin",
      ]);
    },
  );
  it("allows flat zero costs/commissions and covered zero remaining without inventing profit", () => {
    const i = fixture();
    i.metrics = i.metrics.filter((r) => r.day !== "2026-10-18");
    i.metrics.push(...sale("2026-10-18", 3000, 0, 0));
    const f = buildMonthlyFinance(i);
    expect(f).toMatchObject({
      status: "covered",
      monthContributionMinor: 3000,
      remainingSalesMinor: 0,
      totalSalesTargetMinor: 3000,
    });
    expect(calculateGoal(i).targetMinor).toBeNull();
  });
  it("filters foreign currencies/minor units but preserves quantity facts across all shared consumers", () => {
    const i = fixture(),
      baseline = buildMonthlyFinance(i);
    const foreign = [
      ...i.metrics.filter((r) => r.currencyCode),
      row("revenue", 999, i.today),
    ].flatMap((r) => [
      { ...r, currencyCode: "MXN", amountMinor: 999999 },
      { ...r, minorUnit: 0, amountMinor: 999999 },
    ]);
    i.metrics.push(...foreign);
    expect(buildMonthlyFinance(i)).toEqual(baseline);
    expect(summarizeHistory(i, i.metrics)).toEqual(
      summarizeHistory(fixture(), fixture().metrics),
    );
    expect(buildDashboardSummary(i, new Date()).todayRevenueMinor).toBe(0);
    expect(buildCandidates(i)).toEqual(buildCandidates(fixture()));
  });
  it("ignores future expenses/sales, preserves input and emits calculation version 2 in goal contexts", () => {
    const i = fixture(),
      snapshot = structuredClone(i);
    i.metrics.push(
      row("expense_fixed", 99999, "2026-11-01"),
      ...sale("2026-11-01", 99999),
    );
    expect(buildMonthlyFinance(i)).toEqual(buildMonthlyFinance(snapshot));
    const before = structuredClone(i);
    buildMonthlyFinance(i);
    expect(i).toEqual(before);
    expect(
      buildCandidates(snapshot).find((c) => c.cardKey === "3")?.context,
    ).toMatchObject({ calculationVersion: 2 });
    expect(
      parseDashboardSummary({
        ...buildDashboardSummary(snapshot, new Date()),
        monthBreakEvenMinor: null,
        dailyBreakEvenMinor: null,
        unavailableReason: "expense_history",
      }).version,
    ).toBe(1);
  });
});

const measuredSale = (
  day = "2026-10-18",
  grams = "1250.00000000000001",
  revenue = 100,
  cost = 40,
  commission = 10,
) =>
  sale(day, revenue, cost, commission).map((r) =>
    r.metric === "units_sold" || r.metric === "units_with_cost"
      ? {
          ...r,
          metric:
            r.metric === "units_sold" ? "mass_sold_g" : "mass_with_cost_g",
          quantity: 0,
          quantityExact: grams,
        }
      : r,
  );

describe("exact physical financial basis", () => {
  it.each(["unit", "mass", "mixed"])(
    "certifies %s contribution without changing captured money",
    (kind) => {
      const rows = kind === "unit" ? sale("2026-10-18") : measuredSale();
      if (kind === "mixed")
        rows.push(...sale("2026-10-18", 200, 60, 20, "unit-product"));
      expect(salesBasis(rows)).toMatchObject({
        hasSales: true,
        complete: true,
        contribution: kind === "mixed" ? 170 : 50,
        unitCoverage: kind === "mass" ? 0 : 1,
      });
    },
  );
  it("requires both dimensions within the same mixed product, including a zero exact authority", () => {
    const rows = [...sale("2026-10-18"), ...measuredSale()];
    expect(salesBasis(rows)).toMatchObject({
      complete: true,
      contribution: 100,
      unitCoverage: 1,
    });
    rows.find((r) => r.metric === "units_with_cost")!.quantityExact = "1";
    rows.find((r) => r.metric === "mass_with_cost_g")!.quantityExact =
      "1251.00000000000001";
    expect(salesBasis(rows)).toMatchObject({
      complete: false,
      contribution: null,
    });
    const zero = [
      row("mass_sold_g", 0, undefined, {
        quantity: 999,
        quantityExact: "0",
        count: 0,
      }),
    ];
    expect(salesBasis(zero)).toMatchObject({
      hasSales: false,
      complete: true,
      contribution: 0,
    });
  });
  it("uses exact decimal addition beyond capture precision and amount bounds", () => {
    const rows = measuredSale(
      undefined,
      "999999999999999999999999999999.00000000000003",
    );
    const sold = rows.find((r) => r.metric === "mass_sold_g")!;
    sold.quantityExact = "999999999999999999999999999999.00000000000001";
    rows.push({ ...sold, quantityExact: "0.00000000000002" });
    expect(salesBasis(rows).complete).toBe(true);
    rows.at(-1)!.quantityExact = "0.00000000000001";
    expect(salesBasis(rows)).toMatchObject({
      complete: false,
      contribution: null,
    });
  });
  it("honors exact fields over contradictory and nonfinite Number projections", () => {
    const rows = measuredSale();
    for (const r of rows.filter((r) => r.metric.startsWith("mass_")))
      r.quantity = Number.NaN;
    expect(salesBasis(rows).complete).toBe(true);
    rows.find((r) => r.metric === "mass_with_cost_g")!.quantityExact = "1250";
    expect(salesBasis(rows).complete).toBe(false);
    const unit = sale("2026-10-18");
    for (const r of unit.filter((r) => r.metric.startsWith("units_"))) {
      r.quantityExact = "3";
      r.quantity = 0;
    }
    expect(salesBasis(unit)).toMatchObject({ complete: true, unitCoverage: 1 });
  });
  it.each(["units_sold", "units_with_cost", "mass_sold_g", "mass_with_cost_g"])(
    "never offsets a deficit in %s with excess in the other dimension",
    (metric) => {
      const rows = [
        ...sale("2026-10-18"),
        ...measuredSale().map((r) => ({
          ...r,
          dimensionId: r.dimensionId === null ? null : "mass-product",
        })),
      ];
      for (const r of rows) {
        if (r.metric === metric) {
          r.quantityExact = metric.startsWith("units_") ? "1" : "1000";
        }
        if (
          r.metric ===
          (metric.startsWith("units_") ? "mass_with_cost_g" : "units_with_cost")
        ) {
          r.quantityExact = "999999";
        }
      }
      expect(salesBasis(rows)).toMatchObject({
        complete: false,
        contribution: null,
      });
    },
  );
  it.each(["dimensionId", "day", "locationId"] as const)(
    "prevents exact mass compensation across %s",
    (field) => {
      const first = measuredSale(undefined, "1");
      const second = measuredSale(undefined, "1").map((r) => ({
        ...r,
        [field]:
          field === "day"
            ? "2026-10-19"
            : field === "locationId"
              ? "other-local"
              : r.dimensionId === null
                ? null
                : "other-product",
      }));
      first.find((r) => r.metric === "mass_with_cost_g")!.quantityExact =
        "0.99999999999999";
      second.find((r) => r.metric === "mass_with_cost_g")!.quantityExact =
        "1.00000000000001";
      expect(salesBasis([...first, ...second])).toMatchObject({
        complete: false,
        contribution: null,
      });
    },
  );
  it.each([undefined, "", "NaN", "-1", "1e3", "1/3"])(
    "does not certify missing or invalid exact mass %s even if Number matches",
    (value) => {
      const rows = measuredSale();
      for (const r of rows.filter((r) => r.metric.startsWith("mass_"))) {
        r.quantity = 1250;
        r.quantityExact = value;
      }
      expect(salesBasis(rows)).toMatchObject({
        complete: false,
        contribution: null,
      });
    },
  );
  it.each([
    0.1,
    Number.MAX_SAFE_INTEGER + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
  ])("rejects nonlegacy fallback units %s", (quantity) => {
    const rows = sale("2026-10-18");
    for (const r of rows.filter((r) => r.metric.startsWith("units_")))
      r.quantity = quantity;
    expect(salesBasis(rows)).toMatchObject({
      complete: false,
      contribution: null,
    });
  });
  it("recognizes tiny zero-projection mass sales and requires their captured cost counts", () => {
    const rows = measuredSale(undefined, "0.00000000000001", 0, 0, 0);
    expect(salesBasis(rows)).toMatchObject({
      hasSales: true,
      complete: true,
      contribution: 0,
      unitCoverage: 0,
    });
    rows.find((r) => r.metric === "cost_of_goods")!.count = 0;
    expect(salesBasis(rows)).toMatchObject({
      hasSales: true,
      complete: false,
      contribution: null,
    });
    expect(
      salesBasis([
        row("mass_sold_g", 0, undefined, {
          quantity: 0,
          quantityExact: "0.00000000000001",
          count: 0,
        }),
      ]),
    ).toMatchObject({ hasSales: true, complete: false });
  });
  it("preserves empty and orphan invariants for mass with exact zero or invalid quantities", () => {
    expect(salesBasis([])).toMatchObject({
      hasSales: false,
      complete: true,
      contribution: 0,
    });
    expect(
      salesBasis([
        row("mass_sold_g", 0, undefined, { quantityExact: "0", count: 0 }),
      ]),
    ).toMatchObject({ hasSales: false, complete: true });
    expect(
      salesBasis([
        row("mass_with_cost_g", 0, undefined, { quantityExact: "1", count: 0 }),
      ]),
    ).toMatchObject({ hasSales: false, complete: false, contribution: null });
    expect(
      salesBasis([
        row("mass_with_cost_g", 0, undefined, {
          quantityExact: "invalid",
          count: 0,
        }),
      ]),
    ).toMatchObject({ complete: false, contribution: null });
    const rows = measuredSale();
    rows.push(
      row("mass_sold_g", 0, undefined, {
        dimensionId: "hidden",
        quantityExact: "0.00000000000001",
        count: 0,
      }),
      row("mass_with_cost_g", 0, undefined, {
        dimensionId: "hidden",
        quantityExact: "0.00000000000001",
        count: 0,
      }),
    );
    expect(salesBasis(rows).complete).toBe(false);
  });
  it.each(["currencyCode", "minorUnit"] as const)(
    "physical equality never admits money with a foreign %s",
    (field) => {
      const i = fixture();
      i.metrics = [
        ...i.metrics.filter((r) => r.day !== "2026-10-18"),
        ...measuredSale(),
      ];
      expect(buildMonthlyFinance(i).monthContributionMinor).toBe(50);
      for (const r of i.metrics.filter(
        (r) => r.day === "2026-10-18" && r.metric === "cost_of_goods",
      )) {
        if (field === "currencyCode") r.currencyCode = "MXN";
        else r.minorUnit = 0;
      }
      expect(buildMonthlyFinance(i)).toMatchObject({
        monthContributionMinor: null,
        reasons: ["sales_costs"],
      });
    },
  );
});
