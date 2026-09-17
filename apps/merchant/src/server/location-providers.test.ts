import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SUPPORTED_COUNTRIES,
  isSupportedCountryCode,
  verifyLocation,
} from "./location-providers";
import { currencyForCountry } from "../lib/currencies";

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

/**
 * Spec 0069 §D2 / ADR 0070 §8 — Mexico entra a los paises soportados, y la lista de
 * `SUPPORTED_COUNTRIES` es **una sola**: la del wizard (`app/onboarding/page.tsx`) la
 * borro la spec 0067, asi que no hay una segunda que pueda quedar desincronizada.
 */
describe("países soportados (spec 0069 §D2)", () => {
  it("MX está soportado y trae su moneda del mapa que ya existía", () => {
    expect(isSupportedCountryCode("MX")).toBe(true);
    // Minúsculas también: `country()` normaliza a mayúsculas.
    expect(isSupportedCountryCode("mx")).toBe(true);
    expect(currencyForCountry("MX")).toBe("MXN");
  });

  it("son 9, con códigos ISO-3166 alfa-2 únicos y nombre no vacío", () => {
    expect(SUPPORTED_COUNTRIES).toHaveLength(9);
    expect(SUPPORTED_COUNTRIES.map((c) => c.code)).toEqual([
      "AR",
      "BR",
      "CL",
      "CO",
      "EC",
      "MX",
      "PE",
      "PY",
      "UY",
    ]);
    for (const country of SUPPORTED_COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("cada país de la lista pasa el guard, y uno de fuera no", () => {
    for (const country of SUPPORTED_COUNTRIES) {
      expect(isSupportedCountryCode(country.code)).toBe(true);
    }
    // España y EE.UU. NO están soportados (ADR 0070 §4: por ahora solo LATAM).
    expect(isSupportedCountryCode("ES")).toBe(false);
    expect(isSupportedCountryCode("US")).toBe(false);
  });
});
