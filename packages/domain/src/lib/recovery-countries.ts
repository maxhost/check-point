/**
 * Recovery OTP country allow-list (spec 0032): sovereign countries of the Americas
 * (minus Guyana/Suriname) plus Spain. SINGLE SOURCE shared by the server validator
 * (`otp/core.ts`) and the client form (`recover-form.tsx`) so the two never drift.
 */
export const RECOVERY_COUNTRY_ISOS = [
  "AG",
  "AR",
  "BB",
  "BO",
  "BR",
  "BS",
  "BZ",
  "CA",
  "CL",
  "CO",
  "CR",
  "CU",
  "DM",
  "DO",
  "EC",
  "ES",
  "GD",
  "GT",
  "HN",
  "HT",
  "JM",
  "KN",
  "LC",
  "MX",
  "NI",
  "PA",
  "PE",
  "PY",
  "SV",
  "TT",
  "US",
  "UY",
  "VC",
  "VE",
] as const;

export const RECOVERY_COUNTRIES: ReadonlySet<string> = new Set(
  RECOVERY_COUNTRY_ISOS,
);
