export class AssetImageError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Hardened image normalization shared by brand and loyalty-stamp assets. The real
 * format is detected from the bytes with `sharp` (a browser Content-Type is never
 * trusted): SVG and fake/corrupt types are rejected, dimensions and total pixels are
 * bounded, and both a WebP and a PNG variant are produced. Alpha is preserved by
 * default; pass `flatten` with a color to composite onto a solid background instead.
 */
export async function normalizeImage(
  input: Buffer,
  opts: { flatten?: string } = {},
): Promise<{ webp: Buffer; png: Buffer }> {
  try {
    const sharp = (await import("sharp")).default;
    const transformer = sharp(input, {
      limitInputPixels: 2048 * 2048,
      failOn: "error",
    }).rotate();
    const metadata = await transformer.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format)
    ) {
      throw new AssetImageError(
        422,
        "El archivo no es una imagen PNG, JPEG o WebP válida.",
      );
    }
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > 2048 ||
      metadata.height > 2048
    ) {
      throw new AssetImageError(
        422,
        "La imagen no puede superar 2048 × 2048 píxeles.",
      );
    }
    const base = opts.flatten
      ? transformer.flatten({ background: opts.flatten })
      : transformer;
    const resized = base.resize({
      width: 2048,
      height: 2048,
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
    throw new AssetImageError(
      422,
      "El archivo no es una imagen PNG, JPEG o WebP válida.",
    );
  }
}
