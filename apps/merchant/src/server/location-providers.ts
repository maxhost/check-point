export type LocationProvider = "geoapify";

export type LocationSelection = {
  provider?: unknown;
  longitude?: unknown;
  latitude?: unknown;
  featureId?: unknown;
};

export type VerifiedLocation = {
  source: "provider_verified";
  provider: LocationProvider;
  providerPlaceId: string | null;
  label: string;
  longitude: string;
  latitude: string;
  countryCode: string;
  snapshot: Record<string, unknown>;
  attribution: string | null;
};

/**
 * Spec 0069 §D2 / ADR 0070 §8 y §14 — los paises soportados, con su nombre en español.
 *
 * **Es UNA sola lista, no dos**: la del wizard (`app/onboarding/page.tsx`) la borro la
 * spec 0067. `GET /api/onboarding/prefill` la devuelve **completa y sin recortar**: la
 * deteccion por IP es una sugerencia, jamas un filtro (un comerciante detras de una VPN
 * tiene que poder elegir su pais igual).
 *
 * Mexico entro el 2026-09-17 (spec 0069); `COUNTRY_CURRENCY` ya lo mapeaba a `MXN`.
 */
export const SUPPORTED_COUNTRIES: readonly {
  code: string;
  name: string;
}[] = [
  { code: "AR", name: "Argentina" },
  { code: "BR", name: "Brasil" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "EC", name: "Ecuador" },
  { code: "MX", name: "México" },
  { code: "PE", name: "Perú" },
  { code: "PY", name: "Paraguay" },
  { code: "UY", name: "Uruguay" },
] as const;

const supportedCountryCodes = new Set(
  SUPPORTED_COUNTRIES.map((country) => country.code),
);

const nonEmpty = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const coordinate = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : null;

function country(value: unknown) {
  const normalized = nonEmpty(value)?.toUpperCase();
  return normalized && supportedCountryCodes.has(normalized)
    ? normalized
    : null;
}

async function verifyGeoapify(
  selection: LocationSelection,
  countryCode: string,
): Promise<VerifiedLocation> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  const longitude = coordinate(selection.longitude);
  const latitude = coordinate(selection.latitude);
  if (!apiKey || !longitude || !latitude) {
    throw new Error("La validación de Geoapify no está configurada.");
  }
  const params = new URLSearchParams({
    lat: latitude,
    lon: longitude,
    format: "json",
    lang: "es",
    apiKey,
  });
  const response = await fetch(
    `https://api.geoapify.com/v1/geocode/reverse?${params.toString()}`,
  );
  const body = (await response.json()) as {
    results?: Array<{
      formatted?: unknown;
      lon?: unknown;
      lat?: unknown;
      place_id?: unknown;
      country_code?: unknown;
      [key: string]: unknown;
    }>;
  };
  const result = body.results?.[0];
  const resultCountry = country(result?.country_code);
  const label = result ? canonicalAddress(result) : null;
  const verifiedLongitude = coordinate(result?.lon);
  const verifiedLatitude = coordinate(result?.lat);
  if (
    !response.ok ||
    !result ||
    resultCountry !== countryCode ||
    !label ||
    !verifiedLongitude ||
    !verifiedLatitude
  ) {
    throw new Error("No pudimos verificar esa ubicación con Geoapify.");
  }
  return {
    source: "provider_verified",
    provider: "geoapify",
    providerPlaceId: nonEmpty(result.place_id),
    label,
    longitude: verifiedLongitude,
    latitude: verifiedLatitude,
    countryCode: resultCountry,
    snapshot: result,
    attribution: "© OpenStreetMap contributors, © Geoapify",
  };
}

export async function verifyLocation(
  selection: LocationSelection,
  rawCountryCode: unknown,
): Promise<VerifiedLocation> {
  const countryCode = country(rawCountryCode);
  if (!countryCode) throw new Error("El país seleccionado no está soportado.");
  if (selection.provider === "geoapify") {
    return verifyGeoapify(selection, countryCode);
  }
  throw new Error("Selecciona una ubicación desde el buscador.");
}

export function isSupportedCountryCode(value: unknown) {
  return Boolean(country(value));
}
import { canonicalAddress } from "../lib/location-address";
