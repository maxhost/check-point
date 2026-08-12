import { describe, expect, it } from "vitest";
import { analyticsFixtures, isValidFixture } from "./analytics";

describe("analytics fixtures", () => {
  it("keeps every campaign funnel non-increasing", () => {
    expect(Object.values(analyticsFixtures).every(isValidFixture)).toBe(true);
  });
  it("keeps sector lenses distinct", () => {
    expect(analyticsFixtures.hotel.lens.title).not.toBe(
      analyticsFixtures.retail.lens.title,
    );
  });
});
