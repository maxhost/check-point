import { describe, expect, it } from "vitest";
import { planRedemption } from "./counter/redeem-plan";
import { CASES } from "./counter-redeem-plan-cases";

/**
 * The oracle of `planRedemption` (spec 0055): the 24-case table of
 * `docs/specs/0055-contratos-del-orquestador.md` §2, transcribed verbatim, in the same
 * order and with the same numbering, so a reviewer can diff table against table.
 *
 * It is a table and not a re-implementation on purpose: a second arithmetic that
 * computes the expectation would agree with a wrong function.
 *
 * What this file does NOT cover, declared instead of papered over: that the caller
 * invokes the function with the LOCKED balance and with the reward the operator chose.
 * No unit can see that — it is `counter-redeem.neon.integration.test.ts`'s job
 * (`insufficient_override` under concurrency).
 */

describe("planRedemption — contract table (spec 0055 annex §2)", () => {
  it.each(CASES)(
    "case $n: $kind balance=$balance target=$target cost=$pointsCost allow=$allow",
    ({ kind, balance, target, pointsCost, allow, expected }) => {
      expect(
        planRedemption({
          kind,
          balance,
          target,
          reward: { pointsCost },
          allowInsufficient: allow,
        }),
      ).toEqual(expected);
    },
  );

  it("transcribes all 24 rows of the table (a shorter table is a weaker oracle)", () => {
    expect(CASES).toHaveLength(24);
    expect(CASES.map((c) => c.n)).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1),
    );
  });

  it("case 24 is the one that forbids the easy cheat: `override` means THIS operation used the dispensation, not that the program allows it", () => {
    const enough = planRedemption({
      kind: "points",
      balance: 100,
      target: undefined,
      reward: { pointsCost: 30 },
      allowInsufficient: true,
    });
    expect(enough).toEqual({
      unitsToDebit: 30,
      balanceAfter: 70,
      override: false,
    });
  });

  it("never returns a negative balanceAfter, for any combination of the table", () => {
    for (const testCase of CASES) {
      const plan = planRedemption({
        kind: testCase.kind,
        balance: testCase.balance,
        target: testCase.target,
        reward: { pointsCost: testCase.pointsCost },
        allowInsufficient: testCase.allow,
      });
      if ("error" in plan) continue;
      expect(plan.balanceAfter, `case ${testCase.n}`).toBeGreaterThanOrEqual(0);
      expect(plan.unitsToDebit, `case ${testCase.n}`).toBeGreaterThanOrEqual(0);
      // The debit is exactly the balance the card lost.
      expect(plan.balanceAfter, `case ${testCase.n}`).toBe(
        testCase.balance - plan.unitsToDebit,
      );
    }
  });

  it("a non-integer / negative balance is a defensive invalid_program, never a redemption", () => {
    for (const balance of [-1, 1.5, Number.NaN]) {
      expect(
        planRedemption({
          kind: "points",
          balance,
          target: undefined,
          reward: { pointsCost: 1 },
          allowInsufficient: true,
        }),
      ).toEqual({ error: "invalid_program" });
    }
  });

  it("an object or an array as `target` is invalid_program (Number({}) is NaN, Number([]) is 0)", () => {
    for (const target of [{}, [], undefined]) {
      expect(
        planRedemption({
          kind: "stamps",
          balance: 5,
          target,
          reward: { pointsCost: null },
          allowInsufficient: false,
        }),
      ).toEqual({ error: "invalid_program" });
    }
  });
});
