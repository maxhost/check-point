import { describe, expect, it } from "vitest";
import {
  MAX_CROP_EDGE,
  cropImageToBlob,
  cropOutputEdge,
  cropOutputTypes,
  croppedFileName,
  type CropCanvas,
} from "./crop-image";

type ToBlobCall = { type: string | undefined; quality: number | undefined };

/**
 * A canvas that answers `toBlob` however the test wants. This is why `cropImageToBlob`
 * takes an injectable factory: the crop logic is exercised in plain Node (the merchant
 * vitest env is `node`, there is no jsdom).
 */
function fakeCanvas(
  answer: (type: string) => Blob | null,
  record: { calls: ToBlobCall[]; draws: unknown[][] },
): CropCanvas {
  return {
    width: 0,
    height: 0,
    getContext: () =>
      ({
        drawImage: (...args: unknown[]) => record.draws.push(args),
      }) as unknown as CanvasRenderingContext2D,
    toBlob: (callback, type, quality) => {
      record.calls.push({ type, quality });
      callback(answer(type ?? ""));
    },
  };
}

const IMAGE = {} as CanvasImageSource;

describe("cropOutputEdge", () => {
  it("uses the shorter side so the export is always square", () => {
    expect(cropOutputEdge({ width: 900, height: 400 })).toBe(400);
    expect(cropOutputEdge({ width: 300, height: 1200 })).toBe(300);
  });

  it("rounds the fractional rect react-easy-crop reports", () => {
    expect(cropOutputEdge({ width: 512.4, height: 512.6 })).toBe(512);
    expect(cropOutputEdge({ width: 511.5, height: 900 })).toBe(512);
  });

  it("caps at MAX_CROP_EDGE (the server's output edge) and never goes below 1", () => {
    expect(MAX_CROP_EDGE).toBe(2048);
    expect(cropOutputEdge({ width: 4000, height: 3000 })).toBe(2048);
    expect(cropOutputEdge({ width: 0, height: 0 })).toBe(1);
    expect(cropOutputEdge({ width: 0.2, height: 5 })).toBe(1);
  });
});

describe("cropOutputTypes", () => {
  // Decision 4 of spec 0040: logo/stamp accept transparency, so their fallback must be PNG
  // — a transparent PNG flattened into JPEG comes out with a black background.
  it("falls back to PNG (alpha-capable) for logo and stamp", () => {
    expect(cropOutputTypes("logo")).toEqual(["image/webp", "image/png"]);
    expect(cropOutputTypes("stamp")).toEqual(["image/webp", "image/png"]);
  });

  it("falls back to JPEG for catalog photos (opaque, cheaper)", () => {
    expect(cropOutputTypes("catalog")).toEqual(["image/webp", "image/jpeg"]);
  });
});

describe("croppedFileName", () => {
  it("swaps the extension for the exported type", () => {
    expect(croppedFileName("IMG_0042.HEIC", "image/webp")).toBe(
      "IMG_0042.webp",
    );
    expect(croppedFileName("logo.png", "image/jpeg")).toBe("logo.jpg");
    expect(croppedFileName("", "image/png")).toBe("imagen.png");
  });
});

describe("cropImageToBlob", () => {
  it("draws the rect into a square canvas of the expected edge", async () => {
    const record = { calls: [] as ToBlobCall[], draws: [] as unknown[][] };
    const canvas = fakeCanvas((type) => new Blob(["x"], { type }), record);
    const result = await cropImageToBlob({
      image: IMAGE,
      area: { x: 10, y: 20, width: 600, height: 600 },
      surface: "logo",
      createCanvas: () => canvas,
    });
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(600);
    expect(record.draws).toHaveLength(1);
    expect(record.draws[0]).toEqual([IMAGE, 10, 20, 600, 600, 0, 0, 600, 600]);
    expect(result.type).toBe("image/webp");
  });

  it("caps the canvas at 2048 for an oversized selection", async () => {
    const record = { calls: [] as ToBlobCall[], draws: [] as unknown[][] };
    const canvas = fakeCanvas((type) => new Blob(["x"], { type }), record);
    await cropImageToBlob({
      image: IMAGE,
      area: { x: 0, y: 0, width: 3000, height: 3000 },
      surface: "catalog",
      createCanvas: () => canvas,
    });
    expect(canvas.width).toBe(2048);
    expect(canvas.height).toBe(2048);
  });

  it("falls through to the second type when toBlob returns null", async () => {
    const record = { calls: [] as ToBlobCall[], draws: [] as unknown[][] };
    const canvas = fakeCanvas(
      (type) => (type === "image/webp" ? null : new Blob(["x"], { type })),
      record,
    );
    const result = await cropImageToBlob({
      image: IMAGE,
      area: { x: 0, y: 0, width: 400, height: 400 },
      surface: "logo",
      createCanvas: () => canvas,
    });
    expect(record.calls.map((call) => call.type)).toEqual([
      "image/webp",
      "image/png",
    ]);
    expect(result.type).toBe("image/png");
    expect(result.blob.type).toBe("image/png");
  });

  it("falls through when toBlob honours the call but returns another type", async () => {
    // Several browsers silently hand back a PNG when asked for WebP. Shipping that blob
    // labelled image/webp would break the presign content-type match.
    const record = { calls: [] as ToBlobCall[], draws: [] as unknown[][] };
    const canvas = fakeCanvas(
      (type) =>
        type === "image/webp"
          ? new Blob(["x"], { type: "image/png" })
          : new Blob(["x"], { type }),
      record,
    );
    const result = await cropImageToBlob({
      image: IMAGE,
      area: { x: 0, y: 0, width: 400, height: 400 },
      surface: "catalog",
      createCanvas: () => canvas,
    });
    expect(record.calls.map((call) => call.type)).toEqual([
      "image/webp",
      "image/jpeg",
    ]);
    expect(result.type).toBe("image/jpeg");
  });

  it("rejects when no candidate type works", async () => {
    const record = { calls: [] as ToBlobCall[], draws: [] as unknown[][] };
    const canvas = fakeCanvas(() => null, record);
    await expect(
      cropImageToBlob({
        image: IMAGE,
        area: { x: 0, y: 0, width: 400, height: 400 },
        surface: "logo",
        createCanvas: () => canvas,
      }),
    ).rejects.toThrow(/no pudo exportar/i);
    expect(record.calls).toHaveLength(2);
  });

  it("passes the quality through to every candidate", async () => {
    const record = { calls: [] as ToBlobCall[], draws: [] as unknown[][] };
    const canvas = fakeCanvas(() => null, record);
    await expect(
      cropImageToBlob({
        image: IMAGE,
        area: { x: 0, y: 0, width: 100, height: 100 },
        surface: "catalog",
        createCanvas: () => canvas,
      }),
    ).rejects.toThrow();
    expect(record.calls.every((call) => call.quality === 0.85)).toBe(true);
  });
});
