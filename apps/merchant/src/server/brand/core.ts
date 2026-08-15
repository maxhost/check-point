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
export const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
