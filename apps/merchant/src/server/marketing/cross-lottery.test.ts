import { describe, expect, it } from "vitest";
import {
  type LotteryCandidate,
  drawCrossLottery,
  lotteryEntries,
} from "@mi-pasaporte/domain/server/marketing/cross-lottery";

/**
 * THE H4 LOTTERY (spec 0143 §3), PURE, against the worked example of
 * `docs/notificaciones/venta-cruzada-algoritmo.md` §2: A is a café; B (bakery) at 300 m,
 * C (hairdresser) at 900 m, D (bookshop) at 1.8 km. 60 decisions in the month with the
 * three as candidates: the fair share is 20 each — 19 + 2/3 from the previous decisions plus
 * the 1/3 of THIS one —, and they received 40 / 15 / 5. ε = 0.2, no bonus:
 * B 0.3107 · C 0.4099 · D 0.2793 (recalculated by the orchestrator).
 *
 * ORACULO DE M4 (without the clamp, D's behind is 3.5 and D goes to 0.377) and of M5 (without
 * this decision's 1/k, F = 19 + 2/3 and B goes to 0.3097, which `toBeCloseTo(_, 3)` refuses).
 * The ids sort B < C < D, the order of the draw.
 */

const B = "0143b000-0000-4000-8000-00000000000b";
const C = "0143c000-0000-4000-8000-00000000000c";
const D = "0143d000-0000-4000-8000-00000000000d";
const PREVIOUS = 19 + 2 / 3;

const example = (noNewCustomerD = false): LotteryCandidate[] => [
  // Out of order on purpose: the lottery sorts by campaign id.
  {
    campaignId: D,
    distanceMeters: 1800,
    previousShare: PREVIOUS,
    received: 5,
    noNewCustomer: noNewCustomerD,
  },
  {
    campaignId: B,
    distanceMeters: 300,
    previousShare: PREVIOUS,
    received: 40,
    noNewCustomer: false,
  },
  {
    campaignId: C,
    distanceMeters: 900,
    previousShare: PREVIOUS,
    received: 15,
    noNewCustomer: false,
  },
];

const probabilities = (candidates: LotteryCandidate[]) =>
  lotteryEntries(candidates).map((entry) => entry.probability);

describe("cross lottery H4 — the worked example (§2)", () => {
  it("B 0.3107 · C 0.4099 · D 0.2793, by campaign id, summing 1", () => {
    const entries = lotteryEntries(example());
    expect(entries.map((e) => e.campaignId)).toEqual([B, C, D]);
    const [b, c, d] = entries.map((e) => e.probability);
    expect(b).toBeCloseTo(0.3107, 3);
    expect(c).toBeCloseTo(0.4099, 3);
    expect(d).toBeCloseTo(0.2793, 3);
    expect(b + c + d).toBeCloseTo(1, 12);
  });

  it("the factors: closeness e^(−d/1 km), behind clamped to [0.5, 2], no bonus", () => {
    const [b, c, d] = lotteryEntries(example());
    expect(b.closeness).toBeCloseTo(Math.exp(-0.3), 12);
    expect(c.closeness).toBeCloseTo(Math.exp(-0.9), 12);
    expect(d.closeness).toBeCloseTo(Math.exp(-1.8), 12);
    expect(b.behind).toBeCloseTo(21 / 41, 12);
    expect(c.behind).toBeCloseTo(21 / 16, 12);
    expect(d.behind).toBe(2); // 21 / 6 = 3.5, clamped
    expect([b.bonus, c.bonus, d.bonus]).toEqual([1, 1, 1]);
  });

  it("the draw: u = 0.30 → B, u = 0.32 → C, u = 0.99 → D", () => {
    expect(drawCrossLottery(example(), 0.3)?.chosen).toBe(B);
    expect(drawCrossLottery(example(), 0.32)?.chosen).toBe(C);
    expect(drawCrossLottery(example(), 0.99)?.chosen).toBe(D);
    expect(drawCrossLottery(example(), 0.32)?.draw).toBe(0.32);
  });

  it("H4's bonus: D without new customers this month → [0.2821, 0.3697, 0.3482]", () => {
    const [b, c, d] = probabilities(example(true));
    expect(b).toBeCloseTo(0.2821, 3);
    expect(c).toBeCloseTo(0.3697, 3);
    expect(d).toBeCloseTo(0.3482, 3);
    expect(lotteryEntries(example(true))[2].bonus).toBe(1.5);
  });

  it("one candidate → p = 1 and it is drawn whatever u is", () => {
    const [only] = example();
    expect(probabilities([only])).toEqual([1]);
    expect(drawCrossLottery([only], 0.999999)?.chosen).toBe(D);
  });

  it("no candidates → nothing to draw", () => {
    expect(lotteryEntries([])).toEqual([]);
    expect(drawCrossLottery([], 0.5)).toBeNull();
  });
});
