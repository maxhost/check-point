import { describe, expect, it } from "vitest";
import {
  UTILITY_TEXT_CAP,
  utilityText,
  type UtilityProgram,
  type UtilityReward,
} from "./utility-text";

const POINTS: UtilityProgram = { kind: "points", configuration: {} };
const STAMPS: UtilityProgram = {
  kind: "stamps",
  configuration: { target: 10 },
};

function membership(
  balance: number,
  businessName = "Café Luis",
): { businessName: string; pointsBalance: number; stampsCount: number } {
  return { businessName, pointsBalance: balance, stampsCount: balance };
}

const TWO_REWARDS: UtilityReward[] = [{ pointsCost: 200 }, { pointsCost: 50 }];

describe("utilityText — Puntos", () => {
  it("announces the redeemable reward when the balance already reaches the cheapest one", () => {
    expect(utilityText(membership(60), POINTS, TWO_REWARDS)).toBe(
      "Café Luis: tenes un premio para canjear",
    );
  });

  it("says how many units are missing against the CHEAPEST reward", () => {
    expect(utilityText(membership(30), POINTS, TWO_REWARDS)).toBe(
      "Café Luis: te faltan 20 puntos",
    );
  });

  it("falls back to the plain balance with no rewards", () => {
    expect(utilityText(membership(30), POINTS, [])).toBe(
      "Café Luis: 30 puntos",
    );
  });

  it("ignores a reward without a usable cost (`points_cost` is nullable)", () => {
    expect(utilityText(membership(30), POINTS, [{ pointsCost: null }])).toBe(
      "Café Luis: 30 puntos",
    );
  });
});

describe("utilityText — Sellos", () => {
  it("announces the reward when the card is complete", () => {
    expect(utilityText(membership(10), STAMPS, [{ pointsCost: null }])).toBe(
      "Café Luis: tenes un premio para canjear",
    );
  });

  it("reads the target of the program, accepting a numeric string", () => {
    const program: UtilityProgram = {
      kind: "stamps",
      configuration: { target: "10" },
    };
    expect(utilityText(membership(8), program, [{ pointsCost: null }])).toBe(
      "Café Luis: te faltan 2 sellos",
    );
  });

  it("falls back to the balance with no reward row", () => {
    expect(utilityText(membership(8), STAMPS, [])).toBe("Café Luis: 8 sellos");
  });

  it("falls back to the balance with a broken target instead of promising a reward", () => {
    const broken: UtilityProgram = {
      kind: "stamps",
      configuration: { target: null },
    };
    expect(utilityText(membership(8), broken, [{ pointsCost: null }])).toBe(
      "Café Luis: 8 sellos",
    );
  });
});

describe("utilityText — cap", () => {
  it("truncates at 60 characters and marks the cut", () => {
    const long = "Panadería y Confitería La Esquina de San Telmo desde 1904";
    const text = utilityText(membership(3), POINTS, []);
    expect(text.length).toBeLessThanOrEqual(UTILITY_TEXT_CAP);
    const truncated = utilityText(membership(3, long), POINTS, []);
    expect(truncated).toBe(
      "Panadería y Confitería La Esquina de San Telmo desde 1904:…",
    );
    expect(truncated.length).toBeLessThanOrEqual(UTILITY_TEXT_CAP);
    expect(`${long}: 3 puntos`.length).toBeGreaterThan(UTILITY_TEXT_CAP);
  });
});
