import { describe, expect, it } from "vitest";
import { validateCardDesign } from "./loyalty-program";

describe("card design validation", () => {
  it("rejects a design on Puntos and allows omitting it on Sellos", () => {
    expect(() =>
      validateCardDesign("points", {
        backgroundColor: "#111111",
        backgroundColor2: null,
        borderColor: "#222222",
      }),
    ).toThrow("Solo los Sellos");
    expect(validateCardDesign("stamps", null)).toBeNull();
    expect(validateCardDesign("points", null)).toBeNull();
  });

  it("normalizes colors to uppercase and drops the angle without a gradient", () => {
    expect(
      validateCardDesign("stamps", {
        backgroundColor: "#abcdef",
        backgroundColor2: null,
        gradientAngle: 90,
        borderColor: "#012345",
      }),
    ).toEqual({
      backgroundColor: "#ABCDEF",
      backgroundColor2: null,
      gradientAngle: null,
      borderColor: "#012345",
    });
  });

  it("defaults the gradient angle to 180 when omitted", () => {
    expect(
      validateCardDesign("stamps", {
        backgroundColor: "#111111",
        backgroundColor2: "#222222",
        borderColor: "#333333",
      }),
    ).toEqual({
      backgroundColor: "#111111",
      backgroundColor2: "#222222",
      gradientAngle: 180,
      borderColor: "#333333",
    });
  });

  it("rejects invalid hex and an out-of-range angle", () => {
    expect(() =>
      validateCardDesign("stamps", {
        backgroundColor: "red",
        backgroundColor2: null,
        borderColor: "#333333",
      }),
    ).toThrow("#RRGGBB");
    expect(() =>
      validateCardDesign("stamps", {
        backgroundColor: "#111111",
        backgroundColor2: "#222222",
        gradientAngle: 400,
        borderColor: "#333333",
      }),
    ).toThrow("ángulo");
  });
});
