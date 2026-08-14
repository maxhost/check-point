import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { BrandError, validateBrandInput } from "./brand";
import { normalizeImage } from "./assets/image";
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
    const variants = await normalizeImage(source);
    await expect(sharp(variants.webp).metadata()).resolves.toMatchObject({
      format: "webp",
    });
    await expect(sharp(variants.png).metadata()).resolves.toMatchObject({
      format: "png",
    });
    await expect(
      normalizeImage(Buffer.from("not-an-image")),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("rejects SVG (even renamed) and oversized images with 422", async () => {
    // An SVG — the real format is detected from bytes, not from any client MIME.
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    await expect(normalizeImage(svg)).rejects.toMatchObject({ status: 422 });

    // A real PNG larger than 2048² must be rejected (dimension + pixel-limit guard).
    const oversized = await sharp({
      create: { width: 2049, height: 2049, channels: 3, background: "#000000" },
    })
      .png()
      .toBuffer();
    await expect(normalizeImage(oversized)).rejects.toMatchObject({
      status: 422,
    });
  });
});
