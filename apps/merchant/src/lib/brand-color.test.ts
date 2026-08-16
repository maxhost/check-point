import { describe, expect, it } from "vitest";
import { readableTextColor, shade, tint } from "./brand-color";

describe("readableTextColor", () => {
  it("picks white text over the dark default brand green (#176548)", () => {
    expect(readableTextColor("#176548")).toBe("#ffffff");
  });

  it("picks near-black text over white (#ffffff)", () => {
    expect(readableTextColor("#ffffff")).toBe("#111111");
  });

  it("picks white text over pure black (#000000)", () => {
    expect(readableTextColor("#000000")).toBe("#ffffff");
  });

  it("picks near-black text over a light/warm color (#E78132)", () => {
    expect(readableTextColor("#E78132")).toBe("#111111");
  });

  it("is case-insensitive and tolerant of surrounding whitespace", () => {
    expect(readableTextColor("  #FFFFFF  ")).toBe("#111111");
  });

  it("falls back to the documented default (#ffffff) on invalid input", () => {
    expect(readableTextColor("")).toBe("#ffffff");
    expect(readableTextColor("#fff")).toBe("#ffffff");
    expect(readableTextColor("176548")).toBe("#ffffff");
    expect(readableTextColor("#gggggg")).toBe("#ffffff");
    expect(readableTextColor("rgb(23,101,72)")).toBe("#ffffff");
  });
});

describe("tint / shade", () => {
  it("amount 0 leaves the color unchanged; amount 1 reaches the target", () => {
    expect(tint("#176548", 0)).toBe("#176548");
    expect(tint("#176548", 1)).toBe("#ffffff");
    expect(shade("#176548", 0)).toBe("#176548");
    expect(shade("#176548", 1)).toBe("#000000");
  });

  it("tint lightens and shade darkens toward the endpoints", () => {
    // Half-way from #808080 toward white / black is a clean midpoint.
    expect(tint("#808080", 0.5)).toBe("#c0c0c0");
    expect(shade("#808080", 0.5)).toBe("#404040");
  });

  it("a light tint of the default blue reproduces a pale surface (bug-2 palette)", () => {
    // The card fill/border are tints of the accent; for the neutral #2563eb these stay
    // in the same pale-blue family the design used before (no clash with the accent).
    expect(tint("#2563eb", 0.9)).toBe("#e9effd");
    expect(tint("#2563eb", 0.68)).toBe("#b9cdf9");
  });

  it("returns the input unchanged on invalid hex (harmless CSS value)", () => {
    expect(tint("nope", 0.5)).toBe("nope");
    expect(shade("#fff", 0.5)).toBe("#fff");
  });
});
