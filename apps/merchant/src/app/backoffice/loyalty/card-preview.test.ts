import { describe, expect, it } from "vitest";
import {
  cardBackground,
  filledCount,
} from "../../../components/loyalty/card-preview";

describe("card preview helpers", () => {
  it("builds a linear gradient at the angle when a second color is present", () => {
    expect(
      cardBackground({
        backgroundColor: "#111111",
        backgroundColor2: "#222222",
        gradientAngle: 135,
        borderColor: "#000000",
      }),
    ).toBe("linear-gradient(135deg, #111111, #222222)");
  });

  it("uses a solid background without a second color", () => {
    expect(
      cardBackground({
        backgroundColor: "#123456",
        backgroundColor2: null,
        gradientAngle: null,
        borderColor: "#000000",
      }),
    ).toBe("#123456");
  });

  it("defaults the gradient angle to 180 when it is missing", () => {
    expect(
      cardBackground({
        backgroundColor: "#111111",
        backgroundColor2: "#222222",
        gradientAngle: null,
        borderColor: "#000000",
      }),
    ).toBe("linear-gradient(180deg, #111111, #222222)");
  });

  it("fills half the objective, rounded (2→1, 5→3, 10→5)", () => {
    expect(filledCount(2)).toBe(1);
    expect(filledCount(5)).toBe(3);
    expect(filledCount(10)).toBe(5);
    expect(filledCount(0)).toBe(0);
    expect(filledCount(-3)).toBe(0);
  });
});
