import { describe, expect, it } from "vitest";
import { type DayHistoryRow, mergeDayHistory } from "./counter/history";

/**
 * The day history now carries TWO kinds of value event (spec 0055): accreditations and
 * redemptions. The merge/classification is extracted as a pure function precisely so it
 * has an oracle — telling a debit apart from a credit is a decision, and no static
 * sweep of the query can pin it down.
 */

function row(overrides: Partial<DayHistoryRow> = {}): DayHistoryRow {
  return {
    id: "row-1",
    createdAt: new Date("2026-09-07T12:00:00Z"),
    units: 10,
    accrualKind: "points",
    rewardLabel: null,
    operatorName: "Dana",
    operatorEmail: "dana@example.test",
    consumerFirstName: "Marcos",
    consumerLastName: "Pérez",
    ...overrides,
  };
}

describe("mergeDayHistory (spec 0055)", () => {
  it("tags each stream and only a redemption carries the reward label", () => {
    const merged = mergeDayHistory(
      [row({ id: "order-1", units: 30 })],
      [
        row({
          id: "redeem-1",
          units: 50,
          rewardLabel: "Café gratis",
          createdAt: new Date("2026-09-07T13:00:00Z"),
        }),
      ],
    );
    expect(merged.map((entry) => [entry.id, entry.entryKind])).toEqual([
      ["redeem-1", "redemption"],
      ["order-1", "accrual"],
    ]);
    expect(merged[0].rewardLabel).toBe("Café gratis");
    expect(merged[0].unitsGranted).toBe(50);
    expect(merged[1].rewardLabel).toBeNull();
    expect(merged[1].unitsGranted).toBe(30);
  });

  it("an accrual never inherits a reward label even if the row carries one", () => {
    // Defensive: the accrual query selects NULL, but the classification must not rely
    // on the query — that is exactly the coupling this extraction removes.
    const [entry] = mergeDayHistory([row({ rewardLabel: "no debería" })], []);
    expect(entry.entryKind).toBe("accrual");
    expect(entry.rewardLabel).toBeNull();
  });

  it("interleaves both streams newest first, not one block after the other", () => {
    const merged = mergeDayHistory(
      [
        row({ id: "o-late", createdAt: new Date("2026-09-07T15:00:00Z") }),
        row({ id: "o-early", createdAt: new Date("2026-09-07T09:00:00Z") }),
      ],
      [
        row({ id: "r-mid", createdAt: new Date("2026-09-07T12:00:00Z") }),
        row({ id: "r-earliest", createdAt: new Date("2026-09-07T08:00:00Z") }),
      ],
    );
    expect(merged.map((entry) => entry.id)).toEqual([
      "o-late",
      "r-mid",
      "o-early",
      "r-earliest",
    ]);
  });

  it("falls back to the operator email when the user has no name, on both kinds", () => {
    const merged = mergeDayHistory(
      [row({ operatorName: null })],
      [row({ operatorName: "   " })],
    );
    expect(merged.map((entry) => entry.operator)).toEqual([
      "dana@example.test",
      "dana@example.test",
    ]);
  });

  it("serializes createdAt as ISO and joins the consumer name", () => {
    const [entry] = mergeDayHistory([row()], []);
    expect(entry.createdAt).toBe("2026-09-07T12:00:00.000Z");
    expect(entry.consumer).toBe("Marcos Pérez");
  });
});
