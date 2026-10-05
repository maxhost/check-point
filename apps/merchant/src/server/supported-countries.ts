/**
 * Spec 0069 §D2 / ADR 0070 §8 y §14 — los paises soportados, con su nombre en español.
 * Spec 0155 (ADR 0121): salio de `location-providers.ts` al borrarse Geoapify.
 *
 * Es UNA sola lista: la usan el autocomplete de Google (`includedRegionCodes`), el Details
 * (rechaza un lugar fuera de la lista con `unsupported_country`, cuyo mensaje se arma con
 * estos nombres), el token de seleccion y los locales.
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

export function isSupportedCountryCode(value: unknown): value is string {
  return typeof value === "string" && supportedCountryCodes.has(value);
}

/** «Argentina, Brasil, … y Uruguay», para el mensaje de `unsupported_country`. */
export function supportedCountryNames(): string {
  const names = SUPPORTED_COUNTRIES.map((country) => country.name);
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

type AddressComponent = { shortText?: unknown; types?: unknown };

/**
 * El codigo ISO del pais de un lugar de Google: el `shortText` del componente con tipo
 * `country`, en mayusculas. `null` si no viene (o si viene algo que no es texto).
 */
export function countryFromComponents(components: unknown): string | null {
  if (!Array.isArray(components)) return null;
  const country = (components as AddressComponent[]).find(
    (component) =>
      Array.isArray(component?.types) && component.types.includes("country"),
  );
  return typeof country?.shortText === "string" && country.shortText.trim()
    ? country.shortText.trim().toUpperCase()
    : null;
}
