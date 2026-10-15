import { describe, expect, it } from "vitest";
import {
  equivalentPeriods,
  replaceInterval,
  salaryPeriods,
  type Period,
} from "./intervals";

const period = (
  fromMonth: string,
  untilMonth: string | null,
  total = "100.00",
): Period => ({
  id: fromMonth,
  fromMonth,
  untilMonth,
  label: "Sueldo",
  monthlyTotal: total,
  currencyCode: "USD",
  minorUnit: 2,
  distribution: "equal",
  staffLocationPeriodId: null,
  allocations: [],
});
describe("0231 monthly history", () => {
  it("corrects only the requested historical month and preserves future raises", () => {
    const before = [
      period("2026-01-01", "2026-06-01"),
      period("2026-06-01", null, "200.00"),
    ];
    const edited = replaceInterval(
      before,
      period("2026-02-01", "2026-03-01", "130.00"),
    );
    expect(
      edited.map((p) => [p.fromMonth, p.untilMonth, p.monthlyTotal]),
    ).toEqual([
      ["2026-01-01", "2026-02-01", "100.00"],
      ["2026-02-01", "2026-03-01", "130.00"],
      ["2026-03-01", "2026-06-01", "100.00"],
      ["2026-06-01", null, "200.00"],
    ]);
    const assigned = salaryPeriods(edited, [
      {
        id: "old",
        fromMonth: "2026-01-01",
        untilMonth: "2026-03-01",
        locationIds: ["a"],
      },
      {
        id: "new",
        fromMonth: "2026-03-01",
        untilMonth: null,
        locationIds: ["b", "a"],
      },
    ]);
    expect(assigned[0].allocations).toEqual([
      { locationId: "a", monthlyAmount: "100.00" },
    ]);
    expect(assigned[3].allocations).toEqual([
      { locationId: "a", monthlyAmount: "100.00" },
      { locationId: "b", monthlyAmount: "100.00" },
    ]);
    expect(
      equivalentPeriods(
        assigned,
        salaryPeriods(assigned, [
          {
            id: "old",
            fromMonth: "2026-01-01",
            untilMonth: "2026-03-01",
            locationIds: ["a"],
          },
          {
            id: "new",
            fromMonth: "2026-03-01",
            untilMonth: null,
            locationIds: ["a", "b"],
          },
        ]),
      ),
    ).toBe(true);
  });
  it("requires coverage for the whole salary interval, including an open future", () => {
    expect(() => salaryPeriods([period("2026-01-01", null)], [])).toThrow();
    expect(() =>
      salaryPeriods(
        [period("2026-01-01", null)],
        [
          {
            id: "a",
            fromMonth: "2026-02-01",
            untilMonth: null,
            locationIds: ["a"],
          },
        ],
      ),
    ).toThrow();
    expect(() =>
      salaryPeriods(
        [period("2026-01-01", null)],
        [
          {
            id: "a",
            fromMonth: "2026-01-01",
            untilMonth: "2026-02-01",
            locationIds: ["a"],
          },
        ],
      ),
    ).toThrow();
  });
});
