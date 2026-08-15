/**
 * Single source of truth for the image content types accepted on upload, shared by the
 * client guards/inputs and the server prep allow-lists (brand/catalog/stamp presign).
 *
 * Includes the mobile-camera formats: Android (Samsung/Pixel, Android 9+) saves gallery
 * photos as HEIC/HEIF, and AVIF is emerging; iPhone photos are HEIC. `sharp` decodes all
 * of these, so the byte-sniff in `server/assets/image.ts` accepts them — this list must
 * stay in sync with that sharp-format allow-list (`["jpeg","png","webp","heif","avif"]`;
 * HEIC and HEIF both decode via the `heif` codec).
 */
export const ACCEPTED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
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
