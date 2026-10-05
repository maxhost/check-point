import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DETAILS_FIELD_MASK,
  PlacesError,
  autocomplete,
  details,
  suggestionKind,
} from "./google";

/**
 * Spec 0155 — el cliente de Google Places con `fetch` DOBLADO: lo que se asevera es lo que
 * sale hacia Google (URL, cabeceras, cuerpo) y como se lee lo que vuelve. La llamada real la
 * mide el smoke del orquestador.
 */
const SESSION = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const KEY = "test-google-key";
const originalKey = process.env.GOOGLE_MAPS_API_KEY;
let fetchMock: ReturnType<typeof vi.fn>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = KEY;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = originalKey;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const prediction = (placeId: string, main: string, types: string[]) => ({
  placePrediction: {
    placeId,
    types,
    structuredFormat: {
      mainText: { text: main },
      secondaryText: { text: "Cuenca, Ecuador" },
    },
  },
});

describe("autocomplete", () => {
  it("manda el cuerpo del contrato, con la clave en cabecera y sesgo si hay", async () => {
    fetchMock.mockResolvedValue(json(200, { suggestions: [] }));
    await autocomplete({
      input: "cafe platano",
      sessionToken: SESSION,
      bias: { latitude: -2.9, longitude: -79 },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Goog-Api-Key"]).toBe(KEY);
    expect(String(url)).not.toContain(KEY);
    expect(JSON.parse(init.body)).toEqual({
      input: "cafe platano",
      sessionToken: SESSION,
      languageCode: "es",
      includedRegionCodes: [
        "ar",
        "br",
        "cl",
        "co",
        "ec",
        "mx",
        "pe",
        "py",
        "uy",
      ],
      locationBias: {
        circle: {
          center: { latitude: -2.9, longitude: -79 },
          radius: 50000,
        },
      },
    });
  });

  it("sin sesgo no manda locationBias", async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await autocomplete({ input: "abc", sessionToken: SESSION, bias: null });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty(
      "locationBias",
    );
  });

  it("descarta las queryPrediction, clasifica kind y corta en 5", async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        suggestions: [
          { queryPrediction: { text: { text: "cafe platano cerca" } } },
          prediction("ChIJ1", "Café Plátano", ["cafe", "establishment"]),
          {
            placePrediction: {
              placeId: "Ek9",
              types: ["intersection", "geocode"],
              structuredFormat: { mainText: { text: "Santa María" } },
            },
          },
          prediction("p3", "Tres", ["establishment"]),
          prediction("p4", "Cuatro", ["establishment"]),
          prediction("p5", "Cinco", ["establishment"]),
          prediction("p6", "Seis", ["establishment"]),
        ],
      }),
    );
    const suggestions = await autocomplete({
      input: "cafe",
      sessionToken: SESSION,
      bias: null,
    });
    expect(suggestions).toHaveLength(5);
    expect(suggestions[0]).toEqual({
      placeId: "ChIJ1",
      kind: "business",
      mainText: "Café Plátano",
      secondaryText: "Cuenca, Ecuador",
    });
    expect(suggestions[1]).toEqual({
      placeId: "Ek9",
      kind: "address",
      mainText: "Santa María",
      secondaryText: null,
    });
  });

  it.each([429, 403, 500])("Google %i → places_unavailable", async (status) => {
    fetchMock.mockResolvedValue(json(status, { error: { status: "X" } }));
    await expect(
      autocomplete({ input: "abc", sessionToken: SESSION, bias: null }),
    ).rejects.toMatchObject({ code: "places_unavailable" });
  });

  it("red caida o sin clave → places_unavailable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      autocomplete({ input: "abc", sessionToken: SESSION, bias: null }),
    ).rejects.toBeInstanceOf(PlacesError);
    delete process.env.GOOGLE_MAPS_API_KEY;
    await expect(
      autocomplete({ input: "abc", sessionToken: SESSION, bias: null }),
    ).rejects.toMatchObject({ code: "places_unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("details", () => {
  const PLACE = {
    id: "ChIJ1",
    formattedAddress: "Av. Remigio Crespo 4-55, Cuenca, Ecuador",
    location: { latitude: -2.9081, longitude: -79.0137 },
    addressComponents: [
      { longText: "Ecuador", shortText: "EC", types: ["country", "political"] },
    ],
    types: ["cafe", "establishment"],
  };

  it("la field mask son EXACTAMENTE los 5 campos Essentials", () => {
    expect(DETAILS_FIELD_MASK).toBe(
      "id,formattedAddress,location,addressComponents,types",
    );
  });

  it("pide el lugar con la mascara, la sesion y la clave en cabecera", async () => {
    fetchMock.mockResolvedValue(json(200, PLACE));
    const place = await details({ placeId: "ChIJ1", sessionToken: SESSION });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `https://places.googleapis.com/v1/places/ChIJ1?sessionToken=${SESSION}&languageCode=es`,
    );
    expect(init.headers["X-Goog-FieldMask"]).toBe(
      "id,formattedAddress,location,addressComponents,types",
    );
    expect(init.headers["X-Goog-Api-Key"]).toBe(KEY);
    expect(place).toEqual({
      placeId: "ChIJ1",
      formattedAddress: PLACE.formattedAddress,
      latitude: -2.9081,
      longitude: -79.0137,
      addressComponents: PLACE.addressComponents,
      types: PLACE.types,
      snapshot: PLACE,
    });
  });

  it.each([404, 400])("Google %i → place_not_found", async (status) => {
    fetchMock.mockResolvedValue(
      json(status, { error: { status: "NOT_FOUND" } }),
    );
    await expect(
      details({ placeId: "nope", sessionToken: SESSION }),
    ).rejects.toMatchObject({ code: "place_not_found" });
  });

  it("Google 500 → places_unavailable, y el log no lleva la clave ni la URL", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(json(500, { error: { status: "INTERNAL" } }));
    await expect(
      details({ placeId: "ChIJ1", sessionToken: SESSION }),
    ).rejects.toMatchObject({ code: "places_unavailable" });
    expect(log).toHaveBeenCalledWith("places_google_failed", {
      op: "details",
      status: 500,
      googleStatus: "INTERNAL",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(KEY);
  });

  it("una respuesta sin coordenadas → places_unavailable", async () => {
    fetchMock.mockResolvedValue(json(200, { ...PLACE, location: undefined }));
    await expect(
      details({ placeId: "ChIJ1", sessionToken: SESSION }),
    ).rejects.toMatchObject({ code: "places_unavailable" });
  });
});

describe("suggestionKind", () => {
  it("establishment → business; lo demas → address", () => {
    expect(suggestionKind(["cafe", "establishment"])).toBe("business");
    expect(suggestionKind(["route", "geocode"])).toBe("address");
    expect(suggestionKind([])).toBe("address");
  });
});
