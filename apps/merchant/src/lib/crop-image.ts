/**
 * Pure browser-side helpers for the 1:1 crop (spec 0040, ADR 0041 + ADR 0047).
 *
 * This module never imports `react-easy-crop`: the cropper UI is loaded with
 * `next/dynamic({ ssr: false })` and must stay out of the initial bundle, while these
 * helpers are small enough to travel with the page and be unit-tested in plain Node
 * (the canvas factory is injectable for exactly that reason).
 *
 * The crop is **best-effort UX, not a security control** (ADR 0047 §3): the server still
 * sniffs bytes, resizes and bounds the decode in `server/assets/image.ts`.
 */

/** Square edge cap of the exported blob; matches `MAX_OUTPUT_EDGE` in the server pipeline. */
export const MAX_CROP_EDGE = 2048;

/** The three upload surfaces that share the cropper. */
export type CropSurface = "logo" | "stamp" | "catalog";

/** Pixel rect selected in the source image, as `react-easy-crop` reports it. */
export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Output types to try, in order. WebP first (smallest, keeps alpha) with a per-surface
 * fallback for browsers whose `canvas.toBlob` ignores WebP.
 *
 * The fallback for logo/stamp is **PNG, not JPEG**: those surfaces accept transparency and
 * a transparent PNG flattened into JPEG comes out with a black background (spec 0040,
 * decision 4). Catalog photos are opaque, so JPEG is the cheaper fallback there.
 */
export function cropOutputTypes(surface: CropSurface): readonly string[] {
  return surface === "catalog"
    ? ["image/webp", "image/jpeg"]
    : ["image/webp", "image/png"];
}

/** Square edge for the exported canvas: the crop's shorter side, capped at `MAX_CROP_EDGE`. */
export function cropOutputEdge(area: {
  width: number;
  height: number;
}): number {
  const edge = Math.min(
    Math.round(Math.min(area.width, area.height)),
    MAX_CROP_EDGE,
  );
  return Math.max(1, edge);
}

const CROP_EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

/** Renames the original file to the exported type (`foto.heic` → `foto.webp`). */
export function croppedFileName(original: string, type: string): string {
  const base = original.replace(/\.[^./\\]+$/, "").trim() || "imagen";
  return `${base}.${CROP_EXTENSIONS[type] ?? "img"}`;
}

/**
 * Loads an object URL into an `<img>`. Used both to probe decodability and to feed
 * `drawImage`, so the browser — not us — applies EXIF orientation: an `<img>` renders with
 * `image-orientation: from-image` by default, and `naturalWidth/Height` already reflect the
 * rotation. `createImageBitmap` does **not** do that unless it gets
 * `{ imageOrientation: "from-image" }`, and a sideways preview means the user frames the
 * wrong region, so this path is deliberate.
 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No pudimos abrir la imagen."));
    image.src = src;
  });
}

/**
 * Asks the browser the only question that matters: "can you open this file?".
 *
 * Detection is **by behaviour, never by user-agent** (spec 0040, decision 3). Chrome,
 * Firefox and Edge cannot decode HEIC (HEVC is patent-encumbered — ADR 0047), which is the
 * format of Android and iPhone gallery photos; when this returns `false` the caller falls
 * back silently to uploading the original file, exactly like before the cropper existed.
 */
export async function canDecodeImage(file: Blob): Promise<boolean> {
  if (typeof URL === "undefined" || typeof Image === "undefined") return false;
  let url: string;
  try {
    url = URL.createObjectURL(file);
  } catch {
    return false;
  }
  try {
    const image = await loadImageElement(url);
    // `decode()` catches formats that fire `load` but fail to rasterize; not all
    // browsers implement it, hence the guard.
    if (typeof image.decode === "function") await image.decode();
    return image.naturalWidth > 0 && image.naturalHeight > 0;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * What `choose()` must do with a picked file, given the answer of `canDecodeImage`.
 *
 * `crop` parks the file until the user frames it; `fallback` is the **pre-cropper**
 * behaviour — the very same `File` object is uploaded, untouched (ADR 0047 §1: "if it
 * cannot decode, the original file is uploaded"), and `cropped` stays false so the server
 * keeps the high 50 MP decode bound.
 */
export type ImageChoice =
  | { mode: "crop"; pending: File }
  | { mode: "fallback"; selected: File; cropped: false };

/**
 * Pure decision behind the fallback branch of the three upload hooks.
 *
 * It exists so that branch is covered by a test instead of by reading: the hooks are React
 * and the merchant vitest env is `node` (no jsdom), so `choose()` itself cannot run here.
 * The hooks call this and only translate the result into `useState` setters.
 */
export function decideImageChoice(file: File, canDecode: boolean): ImageChoice {
  return canDecode
    ? { mode: "crop", pending: file }
    : { mode: "fallback", selected: file, cropped: false };
}

/** Minimal canvas surface used here; keeps the fake canvas of the unit tests honest. */
export type CropCanvas = {
  width: number;
  height: number;
  getContext(id: "2d"): CanvasRenderingContext2D | null;
  toBlob(
    callback: (blob: Blob | null) => void,
    type?: string,
    quality?: number,
  ): void;
};

function toBlobOnce(
  canvas: CropCanvas,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Draws `area` of `image` into a square canvas of `cropOutputEdge(area)` and exports the
 * first output type the browser actually honours.
 *
 * A `toBlob` that yields `null` **or** a blob whose `.type` is not the requested one counts
 * as a failure and moves to the next candidate: several browsers silently produce a PNG when
 * asked for WebP, and shipping a PNG labelled `image/webp` would break the presign
 * content-type match.
 */
export async function cropImageToBlob(args: {
  image: CanvasImageSource;
  area: CropArea;
  surface: CropSurface;
  quality?: number;
  createCanvas?: () => CropCanvas;
}): Promise<{ blob: Blob; type: string }> {
  const quality = args.quality ?? 0.85;
  const createCanvas =
    args.createCanvas ??
    (() => document.createElement("canvas") as unknown as CropCanvas);
  const edge = cropOutputEdge(args.area);
  const canvas = createCanvas();
  canvas.width = edge;
  canvas.height = edge;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No pudimos preparar el recorte.");
  context.drawImage(
    args.image,
    args.area.x,
    args.area.y,
    args.area.width,
    args.area.height,
    0,
    0,
    edge,
    edge,
  );
  for (const type of cropOutputTypes(args.surface)) {
    const blob = await toBlobOnce(canvas, type, quality);
    if (blob && blob.type === type) return { blob, type };
  }
  throw new Error("Tu navegador no pudo exportar la imagen recortada.");
}
