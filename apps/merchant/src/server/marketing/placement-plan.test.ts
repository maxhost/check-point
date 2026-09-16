import { describe, expect, it } from "vitest";
import { planConsumerPlacement } from "./placement-plan";
import {
  DAY_MS,
  NOW,
  draws,
  input,
  northOf,
  queued,
} from "./placement-plan-cases";

const ids = (plan: { activations: { turnId: string }[] }) =>
  plan.activations.map((activation) => activation.turnId);

describe("planConsumerPlacement — activation", () => {
  it("(a) activates 5 of 7 queued, respecting the 400 m rule and FIFO", () => {
    const seven = Array.from({ length: 7 }, (_, index) =>
      queued(String(index + 1), {
        ...northOf(index * 1200),
        queuedAt: new Date(NOW.getTime() - (7 - index) * DAY_MS),
      }),
    );
    const plan = planConsumerPlacement(input({ queued: seven }));
    expect(ids(plan)).toEqual([
      "turn-1",
      "turn-2",
      "turn-3",
      "turn-4",
      "turn-5",
    ]);
    expect(plan.placements).toHaveLength(5);
    expect(plan.refresh).toBe(true);
    const first = plan.activations[0]!;
    expect(first.windowStart).toEqual(NOW);
    expect(first.windowEnd).toEqual(new Date(NOW.getTime() + 5 * DAY_MS));
    expect(first.messageSnapshot).toBe("Promo 1");
    expect(first.holdout).toBe(false);
  });

  it("(b) activates one of two queued 200 m apart of DIFFERENT businesses", () => {
    const near = [
      queued("a", {
        ...northOf(0),
        queuedAt: new Date(NOW.getTime() - 2 * DAY_MS),
      }),
      queued("b", {
        ...northOf(200),
        queuedAt: new Date(NOW.getTime() - DAY_MS),
      }),
    ];
    expect(ids(planConsumerPlacement(input({ queued: near })))).toEqual([
      "turn-a",
    ]);
    // Control: the same two doors 500 m apart both fit, so the red above is the
    // separation rule and not the pair of businesses.
    const far = [near[0]!, { ...near[1]!, ...northOf(500) }];
    expect(ids(planConsumerPlacement(input({ queued: far })))).toEqual([
      "turn-a",
      "turn-b",
    ]);
  });

  it("(c) activates one turn only when the same business is queued twice", () => {
    const twice = [
      queued("c1", {
        businessId: "business-x",
        ...northOf(0),
        queuedAt: new Date(NOW.getTime() - 2 * DAY_MS),
      }),
      queued("c2", {
        businessId: "business-x",
        ...northOf(2000),
        queuedAt: new Date(NOW.getTime() - DAY_MS),
      }),
    ];
    expect(ids(planConsumerPlacement(input({ queued: twice })))).toEqual([
      "turn-c1",
    ]);
  });

  it("(d) leaves the turn queued when the business quota is used up", () => {
    const plan = planConsumerPlacement(
      input({
        queued: [queued("d")],
        businessActiveTurns: new Map([["business-d", 2]]),
        limits: { businessQuota: 2 },
      }),
    );
    expect(plan.activations).toEqual([]);
    expect(plan.placements).toEqual([]);
    expect(plan.refresh).toBe(false);
  });

  it("(e) a holdout is activated, stays out of the pass and does not fill a slot", () => {
    const six = Array.from({ length: 6 }, (_, index) =>
      queued(String(index + 1), {
        ...northOf(index * 1200),
        queuedAt: new Date(NOW.getTime() - (6 - index) * DAY_MS),
      }),
    );
    const plan = planConsumerPlacement(
      input({ queued: six, random: draws([0.05]) }),
    );
    expect(plan.activations).toHaveLength(6);
    expect(plan.activations[0]!.holdout).toBe(true);
    expect(plan.activations.slice(1).map((a) => a.holdout)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(plan.placements.map((slot) => slot.locationId)).toEqual([
      "location-2",
      "location-3",
      "location-4",
      "location-5",
      "location-6",
    ]);
  });

  it("(i) does not activate a queued turn whose business is in cooldown", () => {
    const inCooldown = planConsumerPlacement(
      input({
        queued: [queued("i")],
        lastWindowEndByBusiness: new Map([
          ["business-i", new Date(NOW.getTime() - 10 * DAY_MS)],
        ]),
      }),
    );
    expect(inCooldown.activations).toEqual([]);
    // Control: the same turn with the window closed 40 days ago does activate.
    const expired = planConsumerPlacement(
      input({
        queued: [queued("i")],
        lastWindowEndByBusiness: new Map([
          ["business-i", new Date(NOW.getTime() - 40 * DAY_MS)],
        ]),
      }),
    );
    expect(ids(expired)).toEqual(["turn-i"]);
  });

  it("orders by merit (ADR 0066) and breaks the tie by `queued_at asc`", () => {
    const pair = [
      queued("old", { queuedAt: new Date(NOW.getTime() - 9 * DAY_MS) }),
      queued("new", {
        ...northOf(1200),
        queuedAt: new Date(NOW.getTime() - DAY_MS),
      }),
    ];
    const byScore = planConsumerPlacement(
      input({
        queued: pair,
        businessScores: new Map([
          ["business-new", 0.4],
          ["business-old", 0.05],
        ]),
        limits: { maxActiveTurns: 1 },
      }),
    );
    expect(ids(byScore)).toEqual(["turn-new"]);
    const tied = planConsumerPlacement(
      input({ queued: pair, limits: { maxActiveTurns: 1 } }),
    );
    expect(ids(tied)).toEqual(["turn-old"]);
  });
});
