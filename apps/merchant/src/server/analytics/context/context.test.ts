import { describe, expect, it, vi } from "vitest";
import { cityFromSnapshot } from "./cities";
import {
  movedHoliday,
  nationalCalendar,
  recurringCuratedCalendar,
} from "./calendar";
import { visualCrossingProvider } from "./weather";
const google = {
  location: { latitude: -2.9081, longitude: -79.0137 },
  addressComponents: [
    { longText: "Ecuador", shortText: "EC", types: ["country"] },
    { longText: "Azuay", types: ["administrative_area_level_1"] },
    { longText: "Cuenca", types: ["locality"] },
  ],
};
describe("AN1 invisible external context", () => {
  it("resolves real Google Details and Geoapify fields without treating a store as city center", () => {
    expect(cityFromSnapshot(google, "EC")).toEqual({
      countryCode: "EC",
      region: "Azuay",
      name: "Cuenca",
      latitude: null,
      longitude: null,
      timezone: "America/Guayaquil",
    });
    expect(
      cityFromSnapshot(
        {
          properties: {
            city: "Cuenca",
            state: "Azuay",
            country_code: "ec",
            lat: -2.9,
            lon: -79,
            timezone: { name: "America/Guayaquil" },
          },
        },
        "EC",
      ),
    ).toMatchObject({ name: "Cuenca", region: "Azuay", latitude: null });
    expect(cityFromSnapshot({}, "EC")).toBeNull();
  });
  it("falls back to Google administrative level2 and keeps typed unknown city absent", () => {
    expect(
      cityFromSnapshot(
        {
          ...google,
          addressComponents: google.addressComponents.map((c) =>
            c.types.includes("locality")
              ? { ...c, types: ["administrative_area_level_2"] }
              : c,
          ),
        },
        "EC",
      )?.name,
    ).toBe("Cuenca");
    expect(cityFromSnapshot({ addressLabel: "Cuenca" }, "EC")).toBeNull();
  });
  it("uses official transferred national dates, excluding the library erroneous Thursday/Sep10", () => {
    const dates = nationalCalendar(2026).map((e) => e.day);
    expect(dates).toEqual(
      expect.arrayContaining([
        "2026-01-01",
        "2026-01-02",
        "2026-02-16",
        "2026-02-17",
        "2026-04-03",
        "2026-05-01",
        "2026-05-25",
        "2026-08-10",
        "2026-10-09",
        "2026-11-02",
        "2026-11-03",
        "2026-12-25",
      ]),
    );
    expect(dates).not.toContain("2026-04-02");
    expect(dates).not.toContain("2026-09-10");
    expect(movedHoliday("2026-04-12")).toBe("2026-04-13");
  });
  it("keeps national, geographic payroll, commercial and sourced school events separated", () => {
    const rows = recurringCuratedCalendar(2026);
    expect(
      rows.find((r) => r.name === "Límite décimo tercero acumulado"),
    ).toMatchObject({ scope: "country", day: "2026-12-24" });
    expect(
      rows.filter((r) => r.type === "payday" && r.scope === "zone"),
    ).toHaveLength(4);
    expect(rows.some((r) => r.type === "commercial")).toBe(true);
    expect(
      recurringCuratedCalendar(2025).filter((r) => r.type === "school"),
    ).toHaveLength(4);
    expect(rows.every((r) => r.sourceUrl.startsWith("https://"))).toBe(true);
  });
  it("Visual Crossing resolves textual cities into two requested daily records without a store coordinate", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      const u = new URL(String(url));
      expect(u.searchParams.get("include")).toBe("days");
      expect(decodeURIComponent(u.pathname)).toContain("Cuenca,Azuay,EC");
      return Response.json({
        latitude: -2.9,
        longitude: -79.0,
        timezone: "America/Guayaquil",
        days: [
          {
            datetime: "2026-10-16",
            tempmax: 20,
            tempmin: 10,
            precip: 1,
            precipprob: 40,
            conditions: "Rain",
          },
          {
            datetime: "2026-10-17",
            tempmax: 21,
            tempmin: 9,
            precip: 0,
            precipprob: 10,
            conditions: "Clear",
          },
        ],
      });
    });
    const provider = visualCrossingProvider(
      "test-key",
      fetcher as typeof fetch,
    );
    const result = await provider.fetch(
      {
        name: "Cuenca",
        region: "Azuay",
        countryCode: "EC",
        latitude: null,
        longitude: null,
      },
      "2026-10-17",
    );
    expect(result.days).toHaveLength(2);
    expect(result).toMatchObject({
      latitude: "-2.9",
      longitude: "-79",
      timezone: "America/Guayaquil",
    });
  });
  it("weather failure messages never expose provider credentials", async () => {
    const p = visualCrossingProvider("secret-key", async () => {
      throw new Error("secret-key");
    });
    await expect(
      p.fetch(
        {
          name: "Cuenca",
          region: "Azuay",
          countryCode: "EC",
          latitude: null,
          longitude: null,
        },
        "2026-10-17",
      ),
    ).rejects.toThrow("Weather provider unavailable");
  });
});
