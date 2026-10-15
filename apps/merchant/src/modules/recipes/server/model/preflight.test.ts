import { describe, expect, it } from "vitest";
import { comparePreservedR1, type PreservedR1 } from "./preflight";
const unchanged: PreservedR1 = {
  legacyLines: { count: 1, fingerprint: "lines" },
  legacyRevisions: { count: 2, fingerprint: "revisions" },
  saleEvents: { count: 3, fingerprint: "events" },
  deliveries: { count: 4, fingerprint: "deliveries" },
  ledger: { count: 5, fingerprint: "monetary-null-zero" },
  itemLocations: { count: 6, fingerprint: "stock-cost-local" },
};
describe("R1 cut preservation comparison", () => {
  it("requires exact snapshots even when ledger row counts are identical", () => {
    expect(
      comparePreservedR1(unchanged, {
        ...unchanged,
        ledger: { count: 5, fingerprint: "changed-zero-to-null" },
      }),
    ).toEqual({ unchanged: false, changed: ["ledger"] });
  });
  it("detects additions and preserves an identical snapshot", () => {
    expect(comparePreservedR1(unchanged, unchanged)).toEqual({
      unchanged: true,
      changed: [],
    });
    expect(
      comparePreservedR1(unchanged, {
        ...unchanged,
        itemLocations: { ...unchanged.itemLocations, count: 7 },
      }),
    ).toEqual({ unchanged: false, changed: ["itemLocations"] });
  });
});
