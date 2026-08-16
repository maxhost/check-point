import { describe, expect, it } from "vitest";
import { readableTextColor } from "./brand-color";

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
