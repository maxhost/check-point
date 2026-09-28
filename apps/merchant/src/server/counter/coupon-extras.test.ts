import { describe, expect, it } from "vitest";
import { decideExtraGrant } from "./coupon-extras";

/** Spec 0106 / ADR 0098 §6 — when an extra coupon may credit. PURE; the wiring and the
 * lock are pinned by `counter-coupon-extras` and `counter-coupon-races`. */
describe("decideExtraGrant", () => {
  const membership = { programId: "p1", stampsCount: 4, pointsBalance: 70 };
  const program = { id: "p1", status: "active", kind: "stamps" };

  it("credits the coupon's unit on top of the locked balance", () => {
    expect(
      decideExtraGrant({ kind: "extra_stamps", units: 3, membership, program }),
    ).toEqual({ ok: true, column: "stamps", balanceAfter: 7 });
    expect(
      decideExtraGrant({
        kind: "extra_points",
        units: 5,
        membership,
        program: { ...program, kind: "points", status: "closing" },
      }),
    ).toEqual({ ok: true, column: "points", balanceAfter: 75 });
  });

  it.each([
    ["no operational program", null],
    ["a program of the other unit", { ...program, kind: "points" }],
    ["a closed program", { ...program, status: "closed" }],
    ["another program than the membership's", { ...program, id: "p2" }],
  ])("refuses %s", (_name, which) => {
    expect(
      decideExtraGrant({
        kind: "extra_stamps",
        units: 3,
        membership,
        program: which,
      }),
    ).toEqual({ ok: false });
  });
});
