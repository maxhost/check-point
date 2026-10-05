import { NextResponse } from "next/server";
import { details, suggestionKind } from "../../../../server/places/google";
import {
  PlacesInputError,
  parseSessionToken,
  placesErrorResponse,
  readObject,
} from "../../../../server/places/http";
import { categoryFromTypes } from "../../../../server/places/category-from-types";
import { signSelection } from "../../../../server/places/selection-token";
import { timezoneFor } from "../../../../server/places/timezone";
import {
  countryFromComponents,
  isSupportedCountryCode,
  supportedCountryNames,
} from "../../../../server/supported-countries";

export const dynamic = "force-dynamic";

const MAX_PLACE_ID = 512;

/**
 * POST /api/places/details — contrato P2 de la spec 0155. PUBLICA.
 *
 * Cierra la sesion de busqueda con UN Details (SKU Essentials) y devuelve el lugar mas un
 * `selectionToken` firmado con lo que se va a guardar: el alta y los locales lo verifican en
 * vez de volver a llamar a Google (ADR 0121 §11).
 */
export async function POST(request: Request) {
  try {
    const body = await readObject(request);
    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
    if (!placeId || placeId.length > MAX_PLACE_ID)
      throw new PlacesInputError(
        400,
        "invalid_input",
        "Elige un lugar de la lista.",
      );
    const sessionToken = parseSessionToken(body.sessionToken);
    const place = await details({ placeId, sessionToken });

    const countryCode = countryFromComponents(place.addressComponents);
    if (!isSupportedCountryCode(countryCode))
      throw new PlacesInputError(
        422,
        "unsupported_country",
        `Por ahora solo trabajamos en ${supportedCountryNames()}.`,
      );
    const timezone = timezoneFor(place.latitude, place.longitude);
    const selectionToken = signSelection({
      placeId: place.placeId,
      label: place.formattedAddress,
      latitude: place.latitude,
      longitude: place.longitude,
      countryCode,
      timezone,
      types: place.types,
      snapshot: place.snapshot,
    });
    return NextResponse.json({
      place: {
        placeId: place.placeId,
        kind: suggestionKind(place.types),
        addressLabel: place.formattedAddress,
        latitude: place.latitude,
        longitude: place.longitude,
        countryCode,
        suggestedCategoryGcid: categoryFromTypes(place.types),
      },
      selectionToken,
    });
  } catch (error) {
    return placesErrorResponse(error);
  }
}
