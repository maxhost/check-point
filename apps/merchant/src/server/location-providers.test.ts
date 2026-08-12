import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyLocation } from "./location-providers";

const originalGeoapifyKey = process.env.GEOAPIFY_API_KEY;

afterEach(() => {
  process.env.GEOAPIFY_API_KEY = originalGeoapifyKey;
  vi.unstubAllGlobals();
});

describe("location providers", () => {
  it("rejects an unsupported country before calling a provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyLocation(
        { provider: "geoapify", longitude: -79, latitude: -2 },
        "US",
      ),
    ).rejects.toThrow("país seleccionado no está soportado");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes a Geoapify verification and preserves provenance", async () => {
    process.env.GEOAPIFY_API_KEY = "server-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              place_id: "geoapify-place",
              formatted: "Calle Larga 10, Cuenca, Ecuador",
              address_line1: "Calle Larga 10",
              city: "Cuenca",
              country: "Ecuador",
              lon: -79.0,
              lat: -2.9,
              country_code: "ec",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyLocation(
        { provider: "geoapify", longitude: -79, latitude: -2.9 },
        "EC",
      ),
    ).resolves.toMatchObject({
      provider: "geoapify",
      providerPlaceId: "geoapify-place",
      countryCode: "EC",
      label: "Calle Larga 10, Cuenca, Ecuador",
      attribution: "© OpenStreetMap contributors, © Geoapify",
    });
  });
});
