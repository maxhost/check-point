import { describe, expect, it } from "vitest";
import {
  ACCEPTED_IMAGE_ACCEPT_ATTR,
  ACCEPTED_IMAGE_CONTENT_TYPES,
  ACCEPTED_IMAGE_CONTENT_TYPE_SET,
  ACCEPTED_IMAGE_LABEL,
} from "./image-formats";

describe("accepted image formats (shared source of truth)", () => {
  it("accepts the mobile-camera formats (HEIC/HEIF/AVIF) plus the classic web ones", () => {
    for (const type of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/avif",
    ]) {
      expect(ACCEPTED_IMAGE_CONTENT_TYPE_SET.has(type)).toBe(true);
    }
  });

  it("still rejects non-images and SVG", () => {
    for (const type of ["application/pdf", "image/svg+xml", "text/plain", ""]) {
      expect(ACCEPTED_IMAGE_CONTENT_TYPE_SET.has(type)).toBe(false);
    }
  });

  it("exposes an accept attribute string covering every accepted type", () => {
    for (const type of ACCEPTED_IMAGE_CONTENT_TYPES) {
      expect(ACCEPTED_IMAGE_ACCEPT_ATTR).toContain(type);
    }
    expect(ACCEPTED_IMAGE_ACCEPT_ATTR).toContain("image/heic");
  });

  it("uses wording that names HEIC and AVIF", () => {
    expect(ACCEPTED_IMAGE_LABEL).toContain("HEIC");
    expect(ACCEPTED_IMAGE_LABEL).toContain("AVIF");
  });
});
