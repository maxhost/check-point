/**
 * Country selection helpers for the enroll phone field (spec 0028, amendment
 * 2026-08-14b). Client-safe: pure data + string logic, no server-only imports.
 * The flag is derived from the ISO code (Unicode regional indicators), so there
 * are no bundled images nor a CDN.
 */
import { COUNTRY_DATA } from "./countries.data";

export type Country = {
  /** ISO 3166-1 alpha-2, uppercase. */
  iso2: string;
  /** E.164 calling code, digits only (no '+'). */
  dial: string;
  /** Spanish display name. */
  name: string;
};

/** All countries, sorted by Spanish name (locale-aware, so accents collate). */
export const COUNTRIES: readonly Country[] = COUNTRY_DATA.map(
  ([iso2, dial, name]) => ({ iso2, dial, name }),
).sort((a, b) => a.name.localeCompare(b.name, "es"));

const BY_ISO = new Map<string, Country>(COUNTRIES.map((c) => [c.iso2, c]));

/** The set of valid ISO-2 codes we recognize. */
export const VALID_ISO_CODES: ReadonlySet<string> = new Set(BY_ISO.keys());

/** True when `iso2` (case-sensitive, expects uppercase) is a known country. */
export function isValidCountryIso(iso2: string): boolean {
  return VALID_ISO_CODES.has(iso2);
}

/** The country record for an ISO-2 code, or undefined when unknown. */
export function countryByIso(iso2: string): Country | undefined {
  return BY_ISO.get(iso2);
}

/** The calling code (digits only) for an ISO-2 code, or undefined when unknown. */
export function dialByIso(iso2: string): string | undefined {
  return BY_ISO.get(iso2)?.dial;
}

/**
 * Composes an E.164 number from the selected country `dial` and whatever the user
 * typed in the *local* number field.
 *
 * If the input starts with '+', the user pasted a full international number, so we
 * respect it verbatim (only stripping non-digits) — this prevents double-prefixing
 * the dial (e.g. paste "+593987…" while the selector is Ecuador → "+593987…", not
 * "+593593987…"). Otherwise we treat it as a national number: drop trunk '0's and
 * prepend the dial.
 *
 * Note: we deliberately do NOT dedup a *bare-digit* dial prefix (input without '+'),
 * because a national number can legitimately start with the dial's digits — e.g. in
 * Brazil (dial 55) the area code 55 exists, so "5599…" is a real local number, not a
 * duplicated country code. The '+' is the only unambiguous "already international" signal.
 */
export function composeE164(dial: string, raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  return `+${dial}${digits.replace(/^0+/, "")}`;
}

/**
 * Flag emoji for an ISO-2 code, built from Unicode regional indicator symbols
 * (`0x1F1E6` is 'A'). Returns "" when the code is not two ASCII letters.
 */
export function flagEmoji(iso2: string): string {
  const code = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + (code.charCodeAt(0) - 65),
    A + (code.charCodeAt(1) - 65),
  );
}
