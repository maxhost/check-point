import { describe, expect, it } from "vitest";
import { timezoneFor } from "./timezone";

describe("timezoneFor (spec 0155, ADR 0121 §7)", () => {
  it.each([
    ["Cuenca EC", -2.9, -79.0, "America/Guayaquil"],
    ["Trujui AR", -34.6, -58.7, "America/Argentina/Buenos_Aires"],
    ["Manaus BR", -3.1, -60.0, "America/Manaus"],
    ["Tijuana MX", 32.5, -117.0, "America/Tijuana"],
  ])("%s → %s", (_place, latitude, longitude, zone) => {
    expect(timezoneFor(latitude, longitude)).toBe(zone);
  });

  it("coordenadas invalidas lanzan: no se inventa una zona", () => {
    expect(() => timezoneFor(Number.NaN, 0)).toThrow();
    expect(() => timezoneFor(120, 0)).toThrow();
  });
});
