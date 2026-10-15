import { describe, expect, it } from "vitest";
import { assertRevision, locationIds, staffMonth } from "./input";

describe("0231 staff input boundaries", () => {
  it("normalizes UUID casing/whitespace before deduplicating and binary ordering", () => {
    const a = "00000000-0000-4000-8000-00000000000a",
      b = "00000000-0000-4000-8000-00000000000b";
    expect(locationIds([b.toUpperCase(), a, ` ${a.toUpperCase()} `])).toEqual([
      a,
      b,
    ]);
  });
  it("never accepts an empty/foreign-shaped set or an invalid monthly frontier", () => {
    for (const input of [[], null, ["bad"]])
      expect(() => locationIds(input)).toThrow();
    for (const month of ["2026-13", "2026-02-01", "infinity", "2026-2"])
      expect(() => staffMonth(month)).toThrow();
    expect(staffMonth("2026-02")).toBe("2026-02-01");
    expect(() => assertRevision(2, 1)).toThrow();
  });
});
