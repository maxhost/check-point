import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  BrandError,
  validateBrandInput,
} from "@mi-pasaporte/domain/server/brand";
import { normalizeImage } from "@mi-pasaporte/domain/server/assets/image";
import {
  canonicalVatRate,
  validateVatPatch,
  resultingBrandVat,
} from "@mi-pasaporte/domain/server/brand/vat";
import { isIanaTimezone } from "@mi-pasaporte/domain/server/timezone";

const valid = {
  name: "La Craft Beer Garden",
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

  it("rejects regional and fiscal mutations in branding", () => {
    for (const field of [
      { timezone: "America/Guayaquil" },
      { currencyCode: "USD" },
      { chargesVat: false },
      { saleVatRate: null },
      { recoversPurchaseVat: false },
    ])
      expect(() => validateBrandInput({ ...valid, ...field })).toThrow(
        BrandError,
      );
  });
  it("the pre-cut bridge accepts the old regional payload only when explicitly selected", () => {
    expect(
      validateBrandInput(
        {
          ...valid,
          timezone: "America/Guayaquil",
          currencyCode: "USD",
          chargesVat: false,
        },
        true,
      ),
    ).toMatchObject({
      regional: { timezone: "America/Guayaquil", currencyCode: "USD" },
      vat: { chargesVat: false },
    });
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

describe("brand fiscal contract 0229", () => {
  it.each([
    ["0", "0.00"],
    ["000.00", "0.00"],
    ["100", "100.00"],
    ["100.00", "100.00"],
    ["15.5", "15.50"],
    ["00015.02", "15.02"],
    [null, null],
  ])("canonicalizes exact percentage %s to %s", (value, expected) => {
    expect(canonicalVatRate(value)).toBe(expected);
    expect(validateVatPatch({ ...valid, saleVatRate: value }).saleVatRate).toBe(
      expected,
    );
  });

  it.each([
    "",
    " ",
    " 15 ",
    "-0",
    "-1",
    "100.01",
    "101",
    "999999999999999999999999",
    "15.001",
    "1e1",
    "NaN",
    "Infinity",
    ".5",
    "15.",
    "15,25",
    "+15",
    15,
    false,
    undefined,
  ])("rejects non-decimal/invalid percentage %s without rounding", (value) => {
    expect(() => validateVatPatch({ ...valid, saleVatRate: value })).toThrow(
      BrandError,
    );
  });

  it.each(["chargesVat", "recoversPurchaseVat"])(
    "only accepts strict booleans for %s",
    (field) => {
      for (const value of ["false", "true", 0, 1, null, undefined]) {
        expect(() => validateVatPatch({ ...valid, [field]: value })).toThrow(
          BrandError,
        );
      }
      for (const value of [true, false]) {
        expect(validateVatPatch({ ...valid, [field]: value })).toEqual({
          [field]: value,
        });
      }
    },
  );

  it("preserves omissions and validates the complete saved state (null differs from zero)", () => {
    const initial = {
      chargesVat: false,
      saleVatRate: null,
      recoversPurchaseVat: false,
    };
    expect(validateVatPatch(valid)).toEqual({});
    expect(resultingBrandVat(initial, {})).toEqual(initial);
    expect(() => resultingBrandVat(initial, { chargesVat: true })).toThrow(
      "Ingresa la tasa",
    );
    const enabled = resultingBrandVat(initial, {
      chargesVat: true,
      saleVatRate: "0.00",
    });
    expect(enabled.saleVatRate).toBe("0.00");
    expect(resultingBrandVat(enabled, { chargesVat: false })).toEqual({
      ...enabled,
      chargesVat: false,
    });
    expect(() => resultingBrandVat(enabled, { saleVatRate: null })).toThrow(
      BrandError,
    );
    expect(resultingBrandVat(initial, { recoversPurchaseVat: true })).toEqual({
      ...initial,
      recoversPurchaseVat: true,
    });
  });
});
