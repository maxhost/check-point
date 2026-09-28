import { describe, expect, it } from "vitest";
import { parseRewardRange } from "./reward-results";

/** Spec 0106 E4 — the range of the results by reward: real days, `from <= to`, at most
 * 366 days both included. PURE; the SQL half is `marketing-reward-results.neon…`. */
describe("parseRewardRange", () => {
  it("accepts a real range, up to 366 days (a leap year included)", () => {
    expect(parseRewardRange("2026-09-01", "2026-09-30")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(parseRewardRange("2028-01-01", "2028-12-31")).toMatchObject({
      to: "2028-12-31",
    });
    expect(parseRewardRange("2026-09-27", "2026-09-27")).toMatchObject({
      from: "2026-09-27",
    });
  });

  it.each([
    ["missing from", null, "2026-09-30", ["from"]],
    ["not a date", "2026-02-30", "2026-03-01", ["from"]],
    ["wrong format", "2026-9-1", "01/10/2026", ["from", "to"]],
    ["to before from", "2026-09-30", "2026-09-01", ["to"]],
    ["367 days", "2026-01-01", "2027-01-02", ["to"]],
  ])("%s → 400 validation on %s", (_name, from, to, fields) => {
    try {
      parseRewardRange(from, to);
      throw new Error("esperaba un 400");
    } catch (error) {
      expect(error).toMatchObject({ status: 400, code: "validation" });
      expect(Object.keys((error as { fields: object }).fields).sort()).toEqual(
        fields,
      );
    }
  });
});
