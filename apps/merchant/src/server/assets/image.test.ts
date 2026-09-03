import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  AssetImageError,
  MAX_INPUT_PIXELS_CROPPED,
  MAX_INPUT_PIXELS_FALLBACK,
  normalizeImage,
} from "./image";

/** 3000×2000 = 6 MP: over the strict 2048² bound, well under the 50 MP fallback bound. */
async function phonePhoto() {
  return sharp({
    create: { width: 3000, height: 2000, channels: 3, background: "#123456" },
  })
    .jpeg()
    .toBuffer();
}

describe("normalizeImage input bound (spec 0040, ADR 0047)", () => {
  it("pins the two bounds", () => {
    expect(MAX_INPUT_PIXELS_CROPPED).toBe(2048 * 2048);
    expect(MAX_INPUT_PIXELS_FALLBACK).toBe(50_000_000);
  });

  it("rejects a 6 MP input with 422 on the strict (cropped) path", async () => {
    const photo = await phonePhoto();
    const failure = await normalizeImage(photo, {
      maxInputPixels: MAX_INPUT_PIXELS_CROPPED,
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AssetImageError);
    expect((failure as AssetImageError).status).toBe(422);
    // The message must say "too big", not "not a valid image": sharp raises a plain
    // Error("Input image exceeds pixel limit") and the generic catch used to disguise it.
    expect((failure as AssetImageError).message).toMatch(/demasiado grande/i);
  });

  it("accepts the very same input on the fallback path", async () => {
    const photo = await phonePhoto();
    const variants = await normalizeImage(photo);
    const meta = await sharp(variants.png).metadata();
    expect(meta.width).toBe(2048);
    expect(meta.height).toBe(1365);
    // Explicit fallback bound behaves like the default.
    await expect(
      normalizeImage(photo, { maxInputPixels: MAX_INPUT_PIXELS_FALLBACK }),
    ).resolves.toBeTruthy();
  });

  it("still processes a cropped-size input on the strict path", async () => {
    const cropped = await sharp({
      create: {
        width: 2048,
        height: 2048,
        channels: 3,
        background: "#176548",
      },
    })
      .webp()
      .toBuffer();
    const variants = await normalizeImage(cropped, {
      maxInputPixels: MAX_INPUT_PIXELS_CROPPED,
    });
    await expect(sharp(variants.webp).metadata()).resolves.toMatchObject({
      format: "webp",
      width: 2048,
      height: 2048,
    });
  });
});

describe("normalizeImage alpha", () => {
  // Criterion of spec 0040: "a transparent PNG logo still has transparency after the crop
  // (it does not come out with a black background)".
  it("keeps the alpha channel of a transparent PNG in the PNG variant", async () => {
    const transparent = await sharp({
      create: {
        width: 120,
        height: 120,
        channels: 4,
        background: { r: 231, g: 129, b: 50, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    const variants = await normalizeImage(transparent, {
      maxInputPixels: MAX_INPUT_PIXELS_CROPPED,
    });
    const png = await sharp(variants.png).metadata();
    expect(png.hasAlpha).toBe(true);
    expect(png.channels).toBe(4);
    const webp = await sharp(variants.webp).metadata();
    expect(webp.hasAlpha).toBe(true);
  });

  it("drops alpha only when the caller asks for a flatten colour", async () => {
    const transparent = await sharp({
      create: {
        width: 60,
        height: 60,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    const variants = await normalizeImage(transparent, { flatten: "#FFFFFF" });
    await expect(sharp(variants.png).metadata()).resolves.toMatchObject({
      hasAlpha: false,
    });
  });
});

/**
 * Spec 0040 criterion: "the uploaded blob is ≤ 2048×2048 **and square**; verified by reading
 * the dimensions of what reaches the server, not by trusting the client".
 *
 * This covers the server half of it: whatever the cropper exports travels through the strict
 * path, so a square input must stay square and bounded in **both** stored variants — the
 * pipeline must not letterbox it or enlarge it. The other half (that the browser's canvas
 * really exports a square blob) needs a real browser and stays with the live QA; the server
 * deliberately does **not** validate squareness, because the crop is UX, not a control
 * (ADR 0047 §3).
 */
describe("a cropped square stays square and bounded in both variants", () => {
  for (const edge of [2048, 1200]) {
    it(`keeps a ${edge}×${edge} input square and ≤2048 as WebP and PNG`, async () => {
      const square = await sharp({
        create: {
          width: edge,
          height: edge,
          channels: 3,
          background: "#E78132",
        },
      })
        .webp()
        .toBuffer();
      const variants = await normalizeImage(square, {
        maxInputPixels: MAX_INPUT_PIXELS_CROPPED,
      });
      for (const [name, buffer] of Object.entries(variants)) {
        const meta = await sharp(buffer).metadata();
        expect(
          { name, width: meta.width, height: meta.height },
          `${name} variant`,
        ).toEqual({ name, width: edge, height: edge });
        expect(meta.width).toBeLessThanOrEqual(2048);
        expect(meta.height).toBeLessThanOrEqual(2048);
      }
    });
  }
});
