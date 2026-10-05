import type { OwnerGateErrorCode } from "../../../../../../ui";

export type BusinessSummary = { id: string; name: string; slug: string };
export type OnboardingState =
  | { authenticated: false }
  | { authenticated: true; business: BusinessSummary | null };
export type Category = { gcid: string; displayName: string };
export type OnboardingPrefill = { categories: Category[] };

export type PlaceSuggestion = {
  placeId: string;
  kind: "business" | "address";
  mainText: string;
  secondaryText: string | null;
};
export type PlaceSelection = {
  place: {
    placeId: string;
    kind: "business" | "address";
    addressLabel: string;
    suggestedCategoryGcid: string | null;
  };
  selectionToken: string;
  suggestion: PlaceSuggestion;
};
export type SignupBusiness = {
  name: string;
  categoryGcid: string;
  selectionToken: string;
};
export type SignupResult =
  | { created: true; verificationSent: boolean; business: BusinessSummary }
  | { sent: true };

export type WizardApiCode =
  | OwnerGateErrorCode
  | "invalid_body"
  | "invalid_input"
  | "invalid_email"
  | "invalid_business"
  | "invalid_selection"
  | "unsupported_country"
  | "place_not_found"
  | "places_unavailable"
  | "signup_unavailable"
  | "rate_limited";
