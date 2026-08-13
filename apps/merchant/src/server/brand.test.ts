import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { BrandError, normalizeLogo, validateBrandInput } from "./brand";
import { isIanaTimezone } from "./timezone";

const valid = {
  name: "La Craft Beer Garden",
  timezone: "America/Guayaquil",
  brandPrimaryColor: "#176548",
  brandComplementaryColor: "#2d8b68",
  brandAccentColor: "#E78132",
  revision: 1,
  logoAction: "keep",
};

describe("brand contract", () => {
  it("normalizes valid brand input and colors", () => {
    expect(
      validateBrandInput({ ...valid, name: "  La   Craft  " }),
    ).toMatchObject({
      name: "La Craft",
      brandComplementaryColor: "#2D8B68",
    });
  });

  it("rejects malformed, foreign and stale-logo payload shapes as 422", () => {
    for (const payload of [
      null,
      { ...valid, brandPrimaryColor: "green" },
      { ...valid, timezone: "not-a-timezone" },
      { ...valid, logoAction: "replace" },
      { ...valid, logoAction: "keep", uploadId: "foreign-upload" },
      { ...valid, name: "x".repeat(121) },
    ]) {
      expect(() => validateBrandInput(payload)).toThrow(BrandError);
      try {
        validateBrandInput(payload);
      } catch (error) {
        expect((error as BrandError).status).toBe(422);
      }
    }
  });

  it("accepts only runtime-valid IANA timezone identifiers", () => {
    expect(isIanaTimezone("America/Guayaquil")).toBe(true);
    expect(isIanaTimezone("Ecuador/Cuenca")).toBe(false);
  });

  it("validates real image bytes and creates both browser variants", async () => {
    const source = await sharp({
      create: { width: 64, height: 40, channels: 4, background: "#176548" },
    })
      .png()
      .toBuffer();
    const variants = await normalizeLogo(source);
    await expect(sharp(variants.webp).metadata()).resolves.toMatchObject({
      format: "webp",
    });
    await expect(sharp(variants.png).metadata()).resolves.toMatchObject({
      format: "png",
    });
    await expect(
      normalizeLogo(Buffer.from("not-an-image")),
    ).rejects.toMatchObject({ status: 422 });
  });
});
