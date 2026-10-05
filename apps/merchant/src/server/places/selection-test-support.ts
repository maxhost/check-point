import { signSelection, type SelectionInput } from "./selection-token";

/**
 * Spec 0155 — el lugar de Google que siembran los tests, firmado con el MISMO
 * `signSelection` que usa `POST /api/places/details`: un token de test es un token real
 * (requiere `BETTER_AUTH_SECRET` en el entorno del test), no una cadena con su forma.
 *
 * El snapshot tiene la forma de un Details Essentials de verdad (los cinco campos de la
 * mascara), medido contra la API el 2026-10-04.
 */
export const CUENCA_PLACE: SelectionInput = {
  placeId: "ChIJ-test-cuenca",
  label: "Av. Remigio Crespo 4-55, Cuenca, Ecuador",
  latitude: -2.9081,
  longitude: -79.0137,
  countryCode: "EC",
  timezone: "America/Guayaquil",
  types: ["cafe", "food", "point_of_interest", "establishment"],
  snapshot: {
    id: "ChIJ-test-cuenca",
    formattedAddress: "Av. Remigio Crespo 4-55, Cuenca, Ecuador",
    location: { latitude: -2.9081, longitude: -79.0137 },
    addressComponents: [
      { longText: "Ecuador", shortText: "EC", types: ["country", "political"] },
    ],
    types: ["cafe", "food", "point_of_interest", "establishment"],
  },
};

export const TRUJUI_PLACE: SelectionInput = {
  placeId: "Ek9-test-trujui",
  label: "Santa María & Puerto de Palos, Trujui, Buenos Aires, Argentina",
  latitude: -34.6,
  longitude: -58.7,
  countryCode: "AR",
  timezone: "America/Argentina/Buenos_Aires",
  types: ["intersection", "geocode"],
  snapshot: {
    id: "Ek9-test-trujui",
    formattedAddress:
      "Santa María & Puerto de Palos, Trujui, Buenos Aires, Argentina",
    location: { latitude: -34.6, longitude: -58.7 },
    addressComponents: [
      {
        longText: "Argentina",
        shortText: "AR",
        types: ["country", "political"],
      },
    ],
    types: ["intersection", "geocode"],
  },
};

export function testSelectionToken(
  overrides: Partial<SelectionInput> = {},
  now?: Date,
): string {
  return signSelection({ ...CUENCA_PLACE, ...overrides }, now);
}
