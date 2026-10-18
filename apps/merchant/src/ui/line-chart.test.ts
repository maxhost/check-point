import { describe, expect, it } from "vitest";
import { lineChartGeometry } from "./line-chart";

describe("honest line geometry", () => {
  it("positions observations by elapsed time rather than record index", () => {
    const geometry = lineChartGeometry([
      { x: 0, y: 10 },
      { x: 1, y: 20 },
      { x: 10, y: 30 },
    ])!;
    expect(geometry.coordinates[1].x).toBeCloseTo(76.8);
    expect(geometry.path).toMatch(/^M.* L.* L/);
    expect(geometry.path).not.toMatch(/[CQ]/);
  });
  it("keeps a flat series visible including zero and refuses one-point trends", () => {
    expect(
      lineChartGeometry([
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ])?.coordinates.map((p) => p.y),
    ).toEqual([110, 110]);
    expect(lineChartGeometry([{ x: 1, y: 20 }])).toBeNull();
    expect(
      lineChartGeometry([
        { x: 1, y: NaN },
        { x: 2, y: 2 },
      ]),
    ).toBeNull();
    expect(
      lineChartGeometry([
        { x: 1, y: 2 },
        { x: 1, y: 2 },
      ]),
    ).toBeNull();
    expect(
      lineChartGeometry([
        { x: 1, y: 1 },
        { x: 2, y: Number.MAX_VALUE },
      ])?.path,
    ).not.toMatch(/Infinity|NaN/);
  });
});
