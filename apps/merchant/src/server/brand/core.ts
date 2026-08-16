export type LogoAction = "keep" | "replace" | "remove";

export type BrandRecord = {
  id: string;
  name: string;
  timezone: string;
  currencyCode: string;
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
  logoObjectKey: string | null;
  brandRevision: number;
  logoVersion: number;
};

export class BrandError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const colorPattern = /^#[0-9a-fA-F]{6}$/;
// Single source of truth (CLAUDE.md): the brand logo accepts the same formats as the
// stamp/catalog uploads — including the mobile-camera HEIC/HEIF/AVIF that `sharp` decodes.
// A narrow per-feature list here already rejected Android/iPhone photos before (QA).
export { ACCEPTED_IMAGE_CONTENT_TYPE_SET as imageTypes } from "../../lib/image-formats";
