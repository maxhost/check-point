import { describe, expect, it } from "vitest";
import { suggestPointsCost } from "./use-rewards";

describe("suggestPointsCost (referential reward cost)", () => {
  // Rate 100 pts / $5. A $8 product needs the next $5 block (=$10) → 200 pts,
  // so redeeming it always requires spending at least its price (no lost money).
  it("rounds the required spend up to the next block above the product price", () => {
    expect(suggestPointsCost(8, 100, 5)).toBe(200); // spend $10 ≥ $8
    expect(suggestPointsCost(10, 100, 5)).toBe(200); // exact block → spend $10
    expect(suggestPointsCost(11, 100, 5)).toBe(300); // spend $15 ≥ $11
  });

  it("scales with the rate (X pts per $Y)", () => {
    expect(suggestPointsCost(3, 10, 3)).toBe(10); // spend $3, 10 pts
    expect(suggestPointsCost(4, 10, 3)).toBe(20); // next $3 block = $6 → 20 pts
    expect(suggestPointsCost(6, 1, 5)).toBe(2); // 1 pt per $5, $6 → $10 → 2 pts
  });

  it("returns 0 when it cannot be computed (no price or no rate)", () => {
    expect(suggestPointsCost(0, 100, 5)).toBe(0);
    expect(suggestPointsCost(-5, 100, 5)).toBe(0);
    expect(suggestPointsCost(8, 0, 5)).toBe(0);
    expect(suggestPointsCost(8, 100, 0)).toBe(0);
    expect(suggestPointsCost(8, 100, Number.NaN)).toBe(0);
  });
});
