import { SUPPORTED_COUNTRIES } from "../supported-countries";

/**
 * Spec 0155 / ADR 0121 — el cliente de Google Places (API New) del SERVIDOR.
 *
 * La clave `GOOGLE_MAPS_API_KEY` nunca viaja al cliente (ADR 0121 §10): el navegador le pega
 * a nuestras rutas same-origin (`/api/places/*`) y estas a Google.
 *
 * Costo (ADR 0121 §6): el autocomplete va con `sessionToken` para que Google no cobre las
 * busquedas de una sesion que termina en un Details, y el Details pide SOLO campos
 * Essentials. La mascara es una constante exportada con su propio test: agregar un campo
 * Pro/Enterprise aca cambia la factura de cada alta.
 */
export const DETAILS_FIELD_MASK =
  "id,formattedAddress,location,addressComponents,types";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places/";
const BIAS_RADIUS_METERS = 50_000;
const MAX_SUGGESTIONS = 5;

export type PlacesErrorCode = "places_unavailable" | "place_not_found";

export class PlacesError extends Error {
  constructor(readonly code: PlacesErrorCode) {
    super(code);
    this.name = "PlacesError";
  }
}

export type SuggestionKind = "business" | "address";

export type Suggestion = {
  placeId: string;
  kind: SuggestionKind;
  mainText: string;
  secondaryText: string | null;
};

export type PlaceDetails = {
  placeId: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  addressComponents: unknown[];
  types: string[];
  /** El JSON de Details tal cual: va a `address_snapshot` / `provider_snapshot`. */
  snapshot: Record<string, unknown>;
};

/** Un comercio trae `establishment` entre sus `types`; todo lo demas es una direccion. */
export function suggestionKind(types: readonly string[]): SuggestionKind {
  return types.includes("establishment") ? "business" : "address";
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/** Se loguea el status y el `error.status` de Google; nunca la clave ni la URL. */
async function fail(
  op: "autocomplete" | "details",
  response: Response | null,
  code: PlacesErrorCode = "places_unavailable",
): Promise<never> {
  let googleStatus: string | null = null;
  if (response) {
    try {
      const body = (await response.json()) as { error?: { status?: unknown } };
      googleStatus =
        typeof body.error?.status === "string" ? body.error.status : null;
    } catch {
      googleStatus = null;
    }
  }
  console.error("places_google_failed", {
    op,
    status: response?.status ?? null,
    googleStatus,
  });
  throw new PlacesError(code);
}

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    console.error("places_google_failed", {
      op: "config",
      status: null,
      googleStatus: null,
    });
    throw new PlacesError("places_unavailable");
  }
  return key;
}

export async function autocomplete(input: {
  input: string;
  sessionToken: string;
  bias: { latitude: number; longitude: number } | null;
}): Promise<Suggestion[]> {
  const key = apiKey();
  const body: Record<string, unknown> = {
    input: input.input,
    sessionToken: input.sessionToken,
    languageCode: "es",
    includedRegionCodes: SUPPORTED_COUNTRIES.map((c) => c.code.toLowerCase()),
  };
  if (input.bias) {
    body.locationBias = {
      circle: {
        center: {
          latitude: input.bias.latitude,
          longitude: input.bias.longitude,
        },
        radius: BIAS_RADIUS_METERS,
      },
    };
  }
  let response: Response;
  try {
    response = await fetch(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify(body),
    });
  } catch {
    return fail("autocomplete", null);
  }
  if (!response.ok) return fail("autocomplete", response);
  const json = (await response.json().catch(() => null)) as {
    suggestions?: Array<{ placePrediction?: Record<string, unknown> }>;
  } | null;
  const suggestions: Suggestion[] = [];
  for (const item of json?.suggestions ?? []) {
    // Las `queryPrediction` (busquedas sugeridas, sin lugar) no se pueden elegir.
    const prediction = item?.placePrediction;
    if (!prediction) continue;
    const format = prediction.structuredFormat as
      | { mainText?: { text?: unknown }; secondaryText?: { text?: unknown } }
      | undefined;
    const placeId = text(prediction.placeId);
    const mainText = text(format?.mainText?.text);
    if (!placeId || !mainText) continue;
    suggestions.push({
      placeId,
      kind: suggestionKind(stringList(prediction.types)),
      mainText,
      secondaryText: text(format?.secondaryText?.text),
    });
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  return suggestions;
}

export async function details(input: {
  placeId: string;
  sessionToken: string;
}): Promise<PlaceDetails> {
  const key = apiKey();
  const params = new URLSearchParams({
    sessionToken: input.sessionToken,
    languageCode: "es",
  });
  let response: Response;
  try {
    response = await fetch(
      `${DETAILS_URL}${encodeURIComponent(input.placeId)}?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": DETAILS_FIELD_MASK,
        },
      },
    );
  } catch {
    return fail("details", null);
  }
  if (response.status === 404 || response.status === 400)
    return fail("details", response, "place_not_found");
  if (!response.ok) return fail("details", response);
  const json = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const location = json?.location as
    { latitude?: unknown; longitude?: unknown } | undefined;
  const placeId = text(json?.id);
  const formattedAddress = text(json?.formattedAddress);
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  if (
    !json ||
    !placeId ||
    !formattedAddress ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude)
  )
    return fail("details", response);
  return {
    placeId,
    formattedAddress,
    latitude,
    longitude,
    addressComponents: Array.isArray(json.addressComponents)
      ? json.addressComponents
      : [],
    types: stringList(json.types),
    snapshot: json,
  };
}
