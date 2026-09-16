import { describe, expect, it } from "vitest";
import { planConsumerPlacement } from "./placement-plan";
import {
  DAY_MS,
  NOW,
  active,
  input,
  northOf,
  utility,
} from "./placement-plan-cases";

describe("planConsumerPlacement — the pass", () => {
  it("(f) keeps the 3 most recent relationships when there are more", () => {
    const four = ["a", "b", "c", "d"].map((id, index) =>
      utility(id, {
        ...northOf(index * 900),
        lastActivityAt: new Date(NOW.getTime() - (index + 1) * DAY_MS),
      }),
    );
    const plan = planConsumerPlacement(input({ utility: four }));
    expect(plan.placements.map((slot) => slot.locationId)).toEqual([
      "location-a",
      "location-b",
      "location-c",
    ]);
    expect(plan.placements.every((slot) => slot.slotKind === "utility")).toBe(
      true,
    );
  });

  it("(g) does not ask for a refresh when the target set is the one already placed", () => {
    const current = [
      {
        locationId: "location-a",
        slotKind: "utility" as const,
        relevantText: "Negocio a: 3 sellos",
      },
    ];
    const same = planConsumerPlacement(
      input({ utility: [utility("a")], currentPlacement: current }),
    );
    expect(same.refresh).toBe(false);
    const changed = planConsumerPlacement(
      input({
        utility: [utility("a", { text: "Negocio a: 4 sellos" })],
        currentPlacement: current,
      }),
    );
    expect(changed.refresh).toBe(true);
  });

  it("(h) fuses one door that falls in both bags into a single row", () => {
    const door = {
      businessId: "business-bar",
      locationId: "location-bar",
      businessName: "Bar La Esquina",
    };
    const plan = planConsumerPlacement(
      input({
        utility: [
          utility("bar", {
            ...door,
            text: "Bar La Esquina: te faltan 2 sellos",
          }),
        ],
        activeTurns: [
          active("bar", {
            ...door,
            message: "2x1 en picadas hasta el domingo",
          }),
        ],
      }),
    );
    expect(plan.placements).toHaveLength(1);
    const slot = plan.placements[0]!;
    expect(slot.slotKind).toBe("both");
    expect(slot.turnId).toBe("turn-bar");
    expect(slot.relevantText).toBe(
      "Bar La Esquina: te faltan 2 sellos · 2x1 en picadas hasta el domingo",
    );
    expect(slot.relevantText.split("Bar La Esquina").length - 1).toBe(1);
  });

  it("writes `{negocio}: {mensaje}` for a door that only carries a turn", () => {
    const plan = planConsumerPlacement(
      input({
        activeTurns: [
          active("bar", {
            businessName: "Bar La Esquina",
            message: "2x1 en picadas",
          }),
        ],
      }),
    );
    expect(plan.placements[0]!.slotKind).toBe("turn");
    expect(plan.placements[0]!.relevantText).toBe(
      "Bar La Esquina: 2x1 en picadas",
    );
  });
});
