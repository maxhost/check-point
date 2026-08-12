import { describe, expect, it } from "vitest";
import { canonicalAddress } from "./location-address";

describe("canonicalAddress", () => {
  it("excludes the POI name from a Geoapify result", () => {
    expect(
      canonicalAddress({
        formatted:
          "LaCraft beer garden, Rafael Torres Beltrán, 010204, Cuenca, Ecuador",
        address_line1: "LaCraft beer garden",
        street: "Rafael Torres Beltrán",
        postcode: "010204",
        city: "Cuenca",
        country: "Ecuador",
      }),
    ).toBe("Rafael Torres Beltrán, 010204, Cuenca, Ecuador");
  });

  it("uses the provider formatted string only if no structured address exists", () => {
    expect(canonicalAddress({ formatted: "Cuenca, Ecuador" })).toBe(
      "Cuenca, Ecuador",
    );
  });
});
