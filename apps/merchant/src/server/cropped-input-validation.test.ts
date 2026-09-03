import { describe, expect, it } from "vitest";
import { BrandError, validateBrandInput } from "./brand";
import { CatalogError } from "./catalog/core";
import { validateProductInput } from "./catalog/validation";
import { LoyaltyError, validateProgramInput } from "./loyalty-program";

/**
 * The `cropped` flag of spec 0040 across the three save contracts.
 *
 * It tells the server the blob came from the 1:1 client cropper, which picks the **strict**
 * 2048² decode bound instead of the 50 MP fallback (ADR 0047 §2). Its shape rule mirrors
 * `uploadId`/`stampUploadId`: only meaningful with `replace`, boolean or absent. Declaring
 * it can only ever tighten the bound, so a hand-rolled `PUT` cannot use it to smuggle a
 * bigger image — it would only get itself rejected.
 */

const brandBase = {
  name: "La Craft Beer Garden",
  timezone: "America/Guayaquil",
  brandPrimaryColor: "#176548",
  brandComplementaryColor: "#2D8B68",
  brandAccentColor: "#E78132",
  revision: 1,
};

const productBase = { name: "Café", availableAllLocations: true };

const programBase = {
  kind: "stamps",
  configuration: { unitName: "Sello", target: 10 },
  clauses: [{ text: "Términos." }],
  accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
  rewards: [{ type: "custom", label: "Café gratis" }],
};

function expect422(
  run: () => unknown,
  ErrorClass: new (...a: never[]) => Error,
) {
  expect(run).toThrow(ErrorClass);
  try {
    run();
    throw new Error("expected a 422");
  } catch (error) {
    expect((error as { status?: number }).status).toBe(422);
  }
}

describe("brand `cropped`", () => {
  it("passes with replace and normalizes to a boolean", () => {
    expect(
      validateBrandInput({
        ...brandBase,
        logoAction: "replace",
        uploadId: "upload-1",
        cropped: true,
      }).cropped,
    ).toBe(true);
    expect(
      validateBrandInput({
        ...brandBase,
        logoAction: "replace",
        uploadId: "upload-1",
        cropped: false,
      }).cropped,
    ).toBe(false);
    // Absent → false: the legacy client that knows nothing about the cropper gets the
    // fallback bound, never the strict one.
    expect(
      validateBrandInput({
        ...brandBase,
        logoAction: "replace",
        uploadId: "upload-1",
      }).cropped,
    ).toBe(false);
  });

  it("is 422 without a replace action", () => {
    for (const logoAction of ["keep", "remove"]) {
      expect422(
        () => validateBrandInput({ ...brandBase, logoAction, cropped: true }),
        BrandError,
      );
      // Even `false` is rejected: the key simply does not belong to these actions.
      expect422(
        () => validateBrandInput({ ...brandBase, logoAction, cropped: false }),
        BrandError,
      );
    }
  });

  it("is 422 when it is not a boolean", () => {
    for (const cropped of ["true", 1, null, {}]) {
      expect422(
        () =>
          validateBrandInput({
            ...brandBase,
            logoAction: "replace",
            uploadId: "upload-1",
            cropped,
          }),
        BrandError,
      );
    }
  });
});

describe("catalog `cropped`", () => {
  it("passes with replace and normalizes to a boolean", () => {
    expect(
      validateProductInput({
        ...productBase,
        imageAction: "replace",
        uploadId: "upload-1",
        cropped: true,
      }).cropped,
    ).toBe(true);
    expect(
      validateProductInput({
        ...productBase,
        imageAction: "replace",
        uploadId: "upload-1",
      }).cropped,
    ).toBe(false);
    // No image action at all → `keep`, and never cropped.
    expect(validateProductInput(productBase).cropped).toBe(false);
  });

  it("is 422 without a replace action (keep, remove and stock)", () => {
    expect422(
      () =>
        validateProductInput({
          ...productBase,
          imageAction: "keep",
          cropped: true,
        }),
      CatalogError,
    );
    expect422(
      () =>
        validateProductInput({
          ...productBase,
          imageAction: "remove",
          cropped: true,
        }),
      CatalogError,
    );
    expect422(
      () =>
        validateProductInput({
          ...productBase,
          imageAction: "stock",
          provider: "pexels",
          photoId: "123",
          cropped: true,
        }),
      CatalogError,
    );
  });

  it("is 422 when it is not a boolean", () => {
    for (const cropped of ["true", 0, null, []]) {
      expect422(
        () =>
          validateProductInput({
            ...productBase,
            imageAction: "replace",
            uploadId: "upload-1",
            cropped,
          }),
        CatalogError,
      );
    }
  });
});

describe("loyalty `stampCropped`", () => {
  it("passes with replace and normalizes to a boolean", () => {
    expect(
      validateProgramInput({
        ...programBase,
        stampAction: "replace",
        stampUploadId: "upload-1",
        stampCropped: true,
      }).stampCropped,
    ).toBe(true);
    expect(
      validateProgramInput({
        ...programBase,
        stampAction: "replace",
        stampUploadId: "upload-1",
      }).stampCropped,
    ).toBe(false);
    expect(validateProgramInput(programBase).stampCropped).toBe(false);
  });

  it("is 422 without a replace action", () => {
    for (const stampAction of ["keep", "remove"]) {
      expect422(
        () =>
          validateProgramInput({
            ...programBase,
            stampAction,
            stampCropped: true,
          }),
        LoyaltyError,
      );
    }
  });

  it("is 422 when it is not a boolean", () => {
    for (const stampCropped of ["true", 1, null, {}]) {
      expect422(
        () =>
          validateProgramInput({
            ...programBase,
            stampAction: "replace",
            stampUploadId: "upload-1",
            stampCropped,
          }),
        LoyaltyError,
      );
    }
  });
});

// What the validated flag is *for*. The three consumers pick the decode bound with the same
// ternary, inside functions that need R2 and the DB to run — so this half is pinned by
// reading the source, not by executing it (`normalizeImage`'s own behaviour under each bound
// is covered for real in `assets/image.test.ts`). A consumer that stopped honouring the flag,
// or that inverted the two bounds, turns this red.
describe("the flag selects the strict decode bound in the three consumers", () => {
  const CONSUMERS = {
    brand: "brand.ts",
    catalog: "catalog/image.ts",
    stamp: "loyalty-program/stamp.ts",
  } as const;

  for (const [surface, file] of Object.entries(CONSUMERS)) {
    it(`${surface} maps cropped → MAX_INPUT_PIXELS_CROPPED`, async () => {
      const { readFile } = await import("node:fs/promises");
      const source = await readFile(new URL(file, import.meta.url), "utf8");
      expect(source).toMatch(
        /maxInputPixels:\s*[\w.]*cropped\s*\?\s*MAX_INPUT_PIXELS_CROPPED\s*:\s*MAX_INPUT_PIXELS_FALLBACK/s,
      );
    });
  }
});
