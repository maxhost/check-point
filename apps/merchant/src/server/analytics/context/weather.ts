export type WeatherDay = {
  day: string;
  maximum: string | null;
  minimum: string | null;
  rainMm: string | null;
  rainProbability: string | null;
  condition: string | null;
};
export type WeatherCity = {
  name: string;
  region: string;
  countryCode: string;
  latitude: string | null;
  longitude: string | null;
};
export type WeatherResult = {
  days: WeatherDay[];
  latitude?: string;
  longitude?: string;
  timezone?: string;
};
export type WeatherProvider = {
  source: string;
  fetch: (city: WeatherCity, day: string) => Promise<WeatherResult>;
};
const decimal = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? String(v) : null;
/** Only the fields required for the stored context are requested; credentials never enter errors or logs. */
export function visualCrossingProvider(
  key: string,
  fetcher: typeof fetch = fetch,
): WeatherProvider {
  return {
    source: "visual_crossing",
    async fetch(city, day) {
      const yesterday = new Date(`${day}T12:00:00Z`);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const date = yesterday.toISOString().slice(0, 10);
      const url = new URL(
        `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent([city.name, city.region, city.countryCode].join(","))}/${date}/${day}`,
      );
      url.searchParams.set("key", key);
      url.searchParams.set("unitGroup", "metric");
      url.searchParams.set("include", "days");
      url.searchParams.set("contentType", "json");
      url.searchParams.set(
        "elements",
        "datetime,tempmax,tempmin,precip,precipprob,conditions",
      );
      let response: Response;
      try {
        response = await fetcher(url, { signal: AbortSignal.timeout(12000) });
      } catch {
        throw new Error("Weather provider unavailable");
      }
      if (!response.ok) throw new Error("Weather provider unavailable");
      const body = (await response.json()) as {
        days?: Record<string, unknown>[];
        latitude?: number;
        longitude?: number;
        timezone?: string;
      };
      if (!Array.isArray(body.days))
        throw new Error("Invalid weather response");
      return {
        latitude: decimal(body.latitude) ?? undefined,
        longitude: decimal(body.longitude) ?? undefined,
        timezone: body.timezone,
        days: body.days
          .filter((d) => d.datetime === date || d.datetime === day)
          .map((d) => ({
            day: String(d.datetime),
            maximum: decimal(d.tempmax),
            minimum: decimal(d.tempmin),
            rainMm: decimal(d.precip),
            rainProbability: decimal(d.precipprob),
            condition: typeof d.conditions === "string" ? d.conditions : null,
          })),
      };
    },
  };
}
export function simulatedWeatherProvider(days: WeatherDay[]): WeatherProvider {
  return {
    source: "simulated",
    fetch: async () => ({
      days: days.map((d) => ({ ...d })),
      latitude: "-2.9",
      longitude: "-79.0",
      timezone: "America/Guayaquil",
    }),
  };
}
