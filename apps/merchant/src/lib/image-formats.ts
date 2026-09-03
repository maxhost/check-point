/**
 * Single source of truth for the image content types accepted on upload, shared by the
 * client guards/inputs and the server prep allow-lists (brand/catalog/stamp presign).
 *
 * Includes the mobile-camera formats: Android (Samsung/Pixel, Android 9+) saves gallery
 * photos as HEIC/HEIF, and AVIF is emerging; iPhone photos are HEIC. `sharp` decodes all
 * of these, so the byte-sniff in `server/assets/image.ts` accepts them — this list must
 * stay in sync with that sharp-format allow-list (`["jpeg","png","webp","heif","avif"]`;
 * HEIC and HEIF both decode via the `heif` codec).
 *
 * `image/jpg` is NOT the IANA-registered type (`image/jpeg` is) but several Android file
 * pickers/third-party gallery apps and some browsers report it anyway for `.jpg` files —
 * rejecting it here would bounce a real JPEG before it ever reaches `sharp` (verified: a
 * `.jpg` upload in brand was rejected with this list missing the alias).
 */
export const ACCEPTED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
] as const;

/** Set form for O(1) membership checks in the server prep allow-lists and client guards. */
export const ACCEPTED_IMAGE_CONTENT_TYPE_SET: Set<string> = new Set(
  ACCEPTED_IMAGE_CONTENT_TYPES,
);

/** Comma-joined string for a desktop `<input type="file" accept=...>`. */
export const ACCEPTED_IMAGE_ACCEPT_ATTR =
  ACCEPTED_IMAGE_CONTENT_TYPES.join(",");

/** Human-facing wording for the accepted formats, reused across error messages. */
export const ACCEPTED_IMAGE_LABEL = "PNG, JPEG, WebP, HEIC o AVIF";

/**
 * Client-side guard shared by the three upload hooks (brand logo, stamp, catalog image).
 *
 * It is a **mirror of the server allow-list, not a looser variant**: the three presign
 * endpoints check `contentType` against `ACCEPTED_IMAGE_CONTENT_TYPE_SET`, so anything this
 * function lets through only to be rejected there costs the user a round-trip and a generic
 * "no pudimos preparar la carga" instead of a message naming the accepted formats.
 *
 * That includes the **empty** type: `""` is not in the set, so the presign rejects it — a
 * client-side tolerance would not "let the server sniff the bytes", it would only replace a
 * clear message with an opaque one. (A picker that reports `""` for a real photo therefore
 * cannot upload today; that is a pre-existing server-side gap, not something this guard can
 * fix.)
 */
export function isAcceptedImageType(type: string | undefined | null): boolean {
  if (!type) return false;
  return ACCEPTED_IMAGE_CONTENT_TYPE_SET.has(type);
}
