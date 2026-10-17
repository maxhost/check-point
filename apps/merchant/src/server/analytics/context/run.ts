import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { analyticsCities, analyticsWeather } from "@mi-pasaporte/db/schema";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { refreshActiveCities } from "./cities";
import { loadCalendar } from "./calendar";
import { localMetricDay } from "../ingestion/apply";
import { visualCrossingProvider, type WeatherProvider } from "./weather";
export async function ingestExternalContext(
  options: { now?: Date; provider?: WeatherProvider } = {},
) {
  const now = options.now ?? new Date(),
    provider =
      options.provider ??
      (process.env.VISUAL_CROSSING_API_KEY
        ? visualCrossingProvider(process.env.VISUAL_CROSSING_API_KEY)
        : null);
  await withDbTransaction(async (tx) => {
    await refreshActiveCities(tx);
    await loadCalendar(tx, now.getUTCFullYear());
  });
  const cities = await getDb()
    .select()
    .from(analyticsCities)
    .where(
      and(
        isNotNull(analyticsCities.activeSince),
        isNull(analyticsCities.activeUntil),
      ),
    );
  let processed = 0,
    skipped = 0;
  for (const city of cities) {
    const day = localMetricDay(now.toISOString(), city.timezone),
      hour = Number(
        new Intl.DateTimeFormat("en", {
          timeZone: city.timezone,
          hour: "numeric",
          hourCycle: "h23",
        }).format(now),
      );
    if (hour < 6 || !provider) {
      skipped++;
      continue;
    }
    try {
      const claimed = await withDbTransaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${"weather:" + city.id + ":" + day},0))`,
        );
        const yesterday = new Date(`${day}T12:00:00Z`);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const previousDay = yesterday.toISOString().slice(0, 10);
        const stored = await tx
          .select()
          .from(analyticsWeather)
          .where(
            and(
              eq(analyticsWeather.cityId, city.id),
              eq(analyticsWeather.day, day),
              eq(analyticsWeather.type, "forecast"),
              eq(analyticsWeather.source, provider.source),
            ),
          );
        if (stored.length) return false;
        const weather = await provider.fetch(city, day);
        if (weather.latitude && weather.longitude && weather.timezone) {
          new Intl.DateTimeFormat("en", { timeZone: weather.timezone });
          await tx
            .update(analyticsCities)
            .set({
              latitude: weather.latitude,
              longitude: weather.longitude,
              timezone: weather.timezone,
            })
            .where(eq(analyticsCities.id, city.id));
        }
        const selected = weather.days.filter(
          (d) => d.day === day || d.day === previousDay,
        );
        if (
          !selected.some((d) => d.day === day) ||
          !selected.some((d) => d.day === previousDay)
        )
          throw new Error("Weather day missing");
        await tx
          .insert(analyticsWeather)
          .values(
            selected.map((d) => ({
              ...d,
              cityId: city.id,
              type: d.day === day ? "forecast" : "observed",
              source: provider.source,
              fetchedAt: now,
            })),
          )
          .onConflictDoNothing();
        return true;
      });
      if (claimed) processed++;
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { processed, skipped };
}
