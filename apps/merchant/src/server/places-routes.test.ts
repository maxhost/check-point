import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as AUTOCOMPLETE } from "../app/api/places/autocomplete/route";
import { POST as DETAILS } from "../app/api/places/details/route";
import { verifySelection } from "./places/selection-token";

/**
 * Spec 0155 — las rutas P1/P2 con `fetch` doblado (Google no se llama). Lo que se mide es
 * el CABLEADO: validacion antes de la red, sesgo desde las cabeceras de Vercel, pais
 * soportado, y que el `selectionToken` devuelto sea uno que el servidor acepta.
 */
process.env.BETTER_AUTH_SECRET ||= "unit-secret-at-least-32-chars-long-xxxx";
const SESSION = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const originalKey = process.env.GOOGLE_MAPS_API_KEY;
let fetchMock: ReturnType<typeof vi.fn>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const post = (
  handler: (request: Request) => Promise<Response>,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  handler(
    new Request(`http://localhost:3001${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const place = (countryCode: string, types = ["cafe", "establishment"]) => ({
  id: "ChIJ1",
  formattedAddress: "Av. Remigio Crespo 4-55, Cuenca, Ecuador",
  location: { latitude: -2.9081, longitude: -79.0137 },
  addressComponents: [
    { longText: "Calle", shortText: "Calle", types: ["route"] },
    { longText: "X", shortText: countryCode, types: ["country", "political"] },
  ],
  types,
});

beforeEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = "test-google-key";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = originalKey;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/places/autocomplete (P1)", () => {
  it.each([
    ["2 caracteres", { input: "ab", sessionToken: SESSION }],
    ["2 caracteres con bordes", { input: "  ab  ", sessionToken: SESSION }],
    ["121 caracteres", { input: "a".repeat(121), sessionToken: SESSION }],
    ["sessionToken que no es UUID", { input: "cafe", sessionToken: "x" }],
    ["sin input", { sessionToken: SESSION }],
  ])("%s → 400 invalid_input SIN llamar a Google", async (_case, body) => {
    const response = await post(AUTOCOMPLETE, "/api/places/autocomplete", body);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_input");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cuerpo que no es JSON → 400 invalid_input", async () => {
    const response = await post(AUTOCOMPLETE, "/api/places/autocomplete", "{");
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con las DOS cabeceras de Vercel sesga; con una sola, no", async () => {
    fetchMock.mockImplementation(async () => json(200, { suggestions: [] }));
    const body = { input: "  cafe platano ", sessionToken: SESSION };
    await post(AUTOCOMPLETE, "/api/places/autocomplete", body, {
      "x-vercel-ip-latitude": "-2.9001",
      "x-vercel-ip-longitude": "-79.0059",
    });
    await post(AUTOCOMPLETE, "/api/places/autocomplete", body, {
      "x-vercel-ip-latitude": "-2.9001",
    });
    const sent = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(sent[0].input).toBe("cafe platano");
    expect(sent[0].locationBias.circle.center).toEqual({
      latitude: -2.9001,
      longitude: -79.0059,
    });
    expect(sent[1]).not.toHaveProperty("locationBias");
  });

  it("200 con las sugerencias; Google caido → 503 places_unavailable", async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        suggestions: [
          {
            placePrediction: {
              placeId: "ChIJ1",
              types: ["establishment"],
              structuredFormat: { mainText: { text: "Café Plátano" } },
            },
          },
        ],
      }),
    );
    const ok = await post(AUTOCOMPLETE, "/api/places/autocomplete", {
      input: "cafe",
      sessionToken: SESSION,
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({
      suggestions: [
        {
          placeId: "ChIJ1",
          kind: "business",
          mainText: "Café Plátano",
          secondaryText: null,
        },
      ],
    });

    fetchMock.mockResolvedValueOnce(json(429, {}));
    const down = await post(AUTOCOMPLETE, "/api/places/autocomplete", {
      input: "cafe",
      sessionToken: SESSION,
    });
    expect(down.status).toBe(503);
    expect((await down.json()).code).toBe("places_unavailable");
  });
});

describe("POST /api/places/details (P2)", () => {
  it("200: el lugar, la categoria sugerida y un token que el servidor acepta", async () => {
    fetchMock.mockResolvedValue(json(200, place("EC")));
    const response = await post(DETAILS, "/api/places/details", {
      placeId: "ChIJ1",
      sessionToken: SESSION,
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.place).toEqual({
      placeId: "ChIJ1",
      kind: "business",
      addressLabel: "Av. Remigio Crespo 4-55, Cuenca, Ecuador",
      latitude: -2.9081,
      longitude: -79.0137,
      countryCode: "EC",
      suggestedCategoryGcid: "gcid:cafe",
    });
    const selection = verifySelection(body.selectionToken);
    expect(selection).toMatchObject({
      provider: "google",
      placeId: "ChIJ1",
      label: "Av. Remigio Crespo 4-55, Cuenca, Ecuador",
      countryCode: "EC",
      timezone: "America/Guayaquil",
      snapshot: place("EC"),
    });
  });

  it("una direccion sin categoria → kind address y suggestedCategoryGcid null", async () => {
    fetchMock.mockResolvedValue(
      json(200, place("AR", ["intersection", "geocode"])),
    );
    const body = await (
      await post(DETAILS, "/api/places/details", {
        placeId: "Ek9",
        sessionToken: SESSION,
      })
    ).json();
    expect(body.place.kind).toBe("address");
    expect(body.place.suggestedCategoryGcid).toBeNull();
  });

  it("un lugar en US → 422 unsupported_country, sin token", async () => {
    fetchMock.mockResolvedValue(json(200, place("US")));
    const response = await post(DETAILS, "/api/places/details", {
      placeId: "ChIJ1",
      sessionToken: SESSION,
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toEqual({
      code: "unsupported_country",
      error:
        "Por ahora solo trabajamos en Argentina, Brasil, Chile, Colombia, Ecuador, México, Perú, Paraguay y Uruguay.",
    });
  });

  it("404 de Google → 404 place_not_found; 500 → 503 places_unavailable", async () => {
    fetchMock.mockResolvedValueOnce(json(404, {}));
    const missing = await post(DETAILS, "/api/places/details", {
      placeId: "nope",
      sessionToken: SESSION,
    });
    expect(missing.status).toBe(404);
    expect((await missing.json()).code).toBe("place_not_found");

    fetchMock.mockResolvedValueOnce(json(500, {}));
    const down = await post(DETAILS, "/api/places/details", {
      placeId: "ChIJ1",
      sessionToken: SESSION,
    });
    expect(down.status).toBe(503);
    expect((await down.json()).code).toBe("places_unavailable");
  });

  it.each([
    ["sin placeId", { sessionToken: SESSION }],
    ["sessionToken invalido", { placeId: "ChIJ1", sessionToken: "nope" }],
  ])("%s → 400 invalid_input sin llamar a Google", async (_case, body) => {
    const response = await post(DETAILS, "/api/places/details", body);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_input");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
