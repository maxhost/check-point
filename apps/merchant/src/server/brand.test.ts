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

  it("handles the optional currency: absent keeps it, supported passes, unknown is 422", () => {
    // Absent → undefined (the service keeps the current value).
    expect(validateBrandInput(valid).currencyCode).toBeUndefined();
    // Supported ISO 4217 → echoed back.
    expect(
      validateBrandInput({ ...valid, currencyCode: "BRL" }).currencyCode,
    ).toBe("BRL");
    // Unknown/lowercase → 422.
    expect(() => validateBrandInput({ ...valid, currencyCode: "ZZZ" })).toThrow(
      BrandError,
    );
    expect(() => validateBrandInput({ ...valid, currencyCode: "usd" })).toThrow(
      BrandError,
    );
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

  it("rejects SVG (even renamed) with 422", async () => {
    // An SVG — the real format is detected from bytes, not from any client MIME.
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    await expect(normalizeImage(svg)).rejects.toMatchObject({ status: 422 });
  });

  it("downscales a phone-size photo (larger than 2048²) instead of rejecting it", async () => {
    // Regression: brand/stamp/catalog rejected any image over 2048² with 422, which
    // bounced every Android/iPhone camera photo. They are now scaled down to fit.
    const photo = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: "#123456" },
    })
      .jpeg()
      .toBuffer();
    const variants = await normalizeImage(photo);
    const meta = await sharp(variants.png).metadata();
    expect(meta.width).toBeLessThanOrEqual(2048);
    expect(meta.height).toBeLessThanOrEqual(2048);
    // Aspect ratio preserved (4:3 → 2048×1536).
    expect(meta.width).toBe(2048);
    expect(meta.height).toBe(1536);
  });
});
