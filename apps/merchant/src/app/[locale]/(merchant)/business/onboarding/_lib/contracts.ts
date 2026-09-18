import type { OwnerGateErrorCode } from "../../../../../../ui";

export type BusinessSummary = { id: string; name: string; slug: string };
export type ProgramSummary = { id: string; kind: "stamps" };

export type OnboardingState =
  | { authenticated: false }
  | {
      authenticated: true;
      business: BusinessSummary | null;
      program: ProgramSummary | null;
      stampImage: boolean;
    };

export type Country = {
  code: string;
  name: string;
  currencyCode: string;
};

export type Category = { gcid: string; displayName: string };

export type OnboardingPrefill = {
  countries: Country[];
  suggestedCountryCode: string | null;
  bias: { latitude: number; longitude: number } | null;
  categories: Category[];
};

export type SelectedAddress = {
  label: string;
  provider: "geoapify";
  longitude: number;
  latitude: number;
  featureId?: string;
  snapshot: Record<string, unknown>;
};

export type CreateBusinessInput = {
  name: string;
  categoryGcid: string;
  countryCode: string;
  timezone: string;
  locationName: string;
  address: SelectedAddress;
};

export type WizardApiCode =
  | OwnerGateErrorCode
  | "invalid_body"
  | "invalid_email"
  | "rate_limited"
  | "auth_unavailable"
  | "program_exists"
  | "invalid_program"
  | "program_unavailable"
  | "no_program"
  | "qr_unavailable";
