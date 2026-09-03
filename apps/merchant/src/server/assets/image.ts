export class AssetImageError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Upper bound on decoded input pixels (decompression-bomb guard) for the **fallback**
 * path — the original file, uncropped. 50 MP comfortably covers phone cameras (12 MP
 * typical, 48 MP mid-range) while still bounding the decode. Larger inputs are rejected
 * before any pixel work; smaller ones are downscaled to fit `MAX_OUTPUT_EDGE` below.
 *
 * This stays the default because the client cropper is best-effort (ADR 0047 §2): browsers
 * that cannot decode HEIC upload the phone photo whole.
 */
export const MAX_INPUT_PIXELS_FALLBACK = 50_000_000;
/**
 * Strict bound for the **cropped** path: 2048² is exactly what `crop-image.ts` exports, so
 * anything bigger did not come from the cropper. Declaring `cropped` can only ever cause a
 * rejection, never widen what is accepted — a client that wants 50 MP simply declares
 * nothing, which is the fallback (spec 0040, decision 5).
 */
export const MAX_INPUT_PIXELS_CROPPED = 4_194_304;
/** Longest edge of the stored variants; bigger images are scaled down to fit (not rejected). */
const MAX_OUTPUT_EDGE = 2048;

/**
 * Hardened image normalization shared by brand, loyalty-stamp and catalog assets. The
 * real format is detected from the bytes with `sharp` (a browser Content-Type is never
 * trusted): JPEG/PNG/WebP/HEIC(HEIF)/AVIF are accepted (HEIC covers iPhone and Android
 * gallery photos, AVIF is emerging), SVG and fake/corrupt types are rejected. A phone-size
 * photo (well over 2048²) is **downscaled to fit** `MAX_OUTPUT_EDGE`, not rejected — only
 * inputs beyond `maxInputPixels` (bomb guard, `MAX_INPUT_PIXELS_FALLBACK` by default) are
 * refused. Both a WebP and a PNG variant are produced. Alpha is preserved by default; pass
 * `flatten` with a color to composite onto a solid background instead.
 */
export async function normalizeImage(
  input: Buffer,
  opts: { flatten?: string; maxInputPixels?: number } = {},
): Promise<{ webp: Buffer; png: Buffer }> {
  try {
    const sharp = (await import("sharp")).default;
    const transformer = sharp(input, {
      limitInputPixels: opts.maxInputPixels ?? MAX_INPUT_PIXELS_FALLBACK,
      failOn: "error",
    }).rotate();
    const metadata = await transformer.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp", "heif", "avif"].includes(metadata.format)
    ) {
      throw new AssetImageError(
        422,
        "El archivo no es una imagen válida (PNG, JPEG, WebP, HEIC o AVIF).",
      );
    }
    if (!metadata.width || !metadata.height) {
      throw new AssetImageError(
        422,
        "No pudimos leer las dimensiones de la imagen.",
      );
    }
    const base = opts.flatten
      ? transformer.flatten({ background: opts.flatten })
      : transformer;
    const resized = base.resize({
      width: MAX_OUTPUT_EDGE,
      height: MAX_OUTPUT_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });
    const [webp, png] = await Promise.all([
      resized.clone().webp({ quality: 82, effort: 4 }).toBuffer(),
      resized
        .clone()
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer(),
    ]);
    return { webp, png };
  } catch (error) {
    if (error instanceof AssetImageError) throw error;
    // sharp raises a plain Error("Input image exceeds pixel limit") from `metadata()` when
    // `limitInputPixels` is hit. Without this branch the generic catch below would dress a
    // too-big-but-valid photo as "not a valid image", which sends the user hunting for the
    // wrong problem — especially on the strict cropped path.
    if (error instanceof Error && /exceeds pixel limit/i.test(error.message)) {
      throw new AssetImageError(
        422,
        "La imagen es demasiado grande para procesarla. Recórtala o elige una más pequeña.",
      );
    }
    throw new AssetImageError(
      422,
      "El archivo no es una imagen válida (PNG, JPEG, WebP, HEIC o AVIF).",
    );
  }
}
