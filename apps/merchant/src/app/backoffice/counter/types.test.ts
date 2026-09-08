import { describe, expect, it } from "vitest";
import { type ResolveResponse, canRedeem, rewardState } from "./types";
import { CASES } from "./redeem-state-cases";

/**
 * Spec 0055 — the per-reward state the Canjear mode paints, as a case table oracle.
 *
 * The table mirrors §2 of `docs/specs/0055-contratos-del-orquestador.md` (the server's
 * `planRedemption`) case by case, because the point of this function is that the operator
 * never sees "Canjeable" on something the server answers `422` to. Where the two differ
 * on purpose it is spelled out: `insufficient_balance` is not an error here — it is the
 * "Faltan N" state, enabled only when the program dispenses (spec 0055 §5/§9).
 */
describe("rewardState — Canjear mode, case table (spec 0055)", () => {
  for (const testCase of CASES) {
    it(`#${testCase.n} ${testCase.kind} balance=${testCase.balance} target=${String(
      testCase.target,
    )} cost=${String(testCase.pointsCost)} allow=${testCase.allow} → ${
      testCase.expected.status
    }`, () => {
      expect(
        rewardState({
          kind: testCase.kind,
          balance: testCase.balance,
          target: testCase.target,
          reward: { pointsCost: testCase.pointsCost },
          redeemAllowInsufficient: testCase.allow,
        }),
      ).toEqual(testCase.expected);
    });
  }

  it("case 24 is the one that blocks the easy cheat: the dispensation is not the state", () => {
    const dispensing = rewardState({
      kind: "points",
      balance: 100,
      target: undefined,
      reward: { pointsCost: 30 },
      redeemAllowInsufficient: true,
    });
    expect(dispensing.status).toBe("redeemable");
    expect(dispensing.label).toBe("Canjeable");
  });
});

const resolved = {
  consumer: { displayName: "Marcos" },
  membership: {
    id: "m1",
    pointsBalance: 50,
    stampsCount: 0,
    justEnrolled: false,
  },
  program: {
    id: "p1",
    kind: "points",
    redeemAllowInsufficient: false,
    accrual: { mode: "per_amount", grant: 10, blockAmount: 3 },
    cardDesign: {
      backgroundColor: null,
      backgroundColor2: null,
      gradientAngle: null,
      borderColor: null,
    },
  },
  catalog: { products: [], categories: [] },
  rewards: [
    {
      id: "r-cheap",
      type: "custom",
      label: "Café",
      productId: null,
      discountPercent: null,
      pointsCost: 30,
      position: 0,
      imagePath: null,
    },
    {
      id: "r-dear",
      type: "custom",
      label: "Torta",
      productId: null,
      discountPercent: null,
      pointsCost: 90,
      position: 1,
      imagePath: null,
    },
  ],
} as ResolveResponse;

describe("canRedeem — the Confirm button of the Canjear mode", () => {
  it("allows the affordable reward and blocks the dear one", () => {
    expect(canRedeem(resolved, "r-cheap")).toBe(true);
    expect(canRedeem(resolved, "r-dear")).toBe(false);
  });

  it("allows the dear one when the program dispenses (§5/§9)", () => {
    const dispensing = {
      ...resolved,
      program: { ...resolved.program, redeemAllowInsufficient: true },
    } as ResolveResponse;
    expect(canRedeem(dispensing, "r-dear")).toBe(true);
  });

  it("blocks nothing selected, an unknown id and a missing scan", () => {
    expect(canRedeem(resolved, null)).toBe(false);
    expect(canRedeem(resolved, "r-ghost")).toBe(false);
    expect(canRedeem(null, "r-cheap")).toBe(false);
  });
});
