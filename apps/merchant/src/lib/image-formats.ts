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
