import { describe, expect, it } from "vitest";
import { kitBusinessDTO, kitDefaults } from "./data";

const baseRow = {
  id: "biz-1",
  name: "La Gringa",
  brandPrimaryColor: "#176548",
  brandComplementaryColor: "#2D8B68",
  brandAccentColor: "#E78132",
  logoObjectKey: "brands/biz-1/logo",
  logoVersion: 3,
};

describe("kitBusinessDTO", () => {
  it("never serializes the internal R2 logoObjectKey", () => {
    const dto = kitBusinessDTO(baseRow);
    expect(dto).not.toHaveProperty("logoObjectKey");
    expect(JSON.stringify(dto)).not.toContain("logoObjectKey");
  });

  it("exposes the 3 colors and a public logoPath (with version) when a logo exists", () => {
    const dto = kitBusinessDTO(baseRow);
    expect(dto).toMatchObject({
      name: "La Gringa",
      brandPrimaryColor: "#176548",
      brandComplementaryColor: "#2D8B68",
      brandAccentColor: "#E78132",
    });
    expect(dto.logoPath).toBe("/api/public/brands/biz-1/logo?v=3");
  });

  it("logoPath is null when the business has no logo", () => {
    expect(kitBusinessDTO({ ...baseRow, logoObjectKey: null }).logoPath).toBeNull();
  });
});

describe("kitDefaults", () => {
  it("gives stamp-flavored copy for a stamps program", () => {
    const d = kitDefaults("stamps");
    expect(d.headline).toMatch(/sello|tarjeta/i);
    expect(d.subheadline).toBeTruthy();
  });

  it("gives points-flavored copy for a points program", () => {
    expect(kitDefaults("points").headline).toMatch(/punto/i);
  });

  it("falls back to a generic default for an unknown kind", () => {
    const d = kitDefaults("tiers");
    expect(d.headline).toBeTruthy();
    expect(d.subheadline).toBeTruthy();
  });
});
