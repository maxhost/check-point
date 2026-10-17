import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  analyticsCities,
  analyticsWeather,
  analyticsCalendarEvents,
  locations,
} from "@mi-pasaporte/db/schema";
import {
  seedModuleWorld,
  dropModuleWorld,
  type ModuleWorld,
} from "./modules-integration-support";
import {
  resolveCity,
  refreshActiveCities,
} from "../server/analytics/context/cities";
import { ingestExternalContext } from "../server/analytics/context/run";
import { simulatedWeatherProvider } from "../server/analytics/context/weather";
const enabled =
  process.env.NEON_INTEGRATION_ISOLATED === "true" &&
  !!process.env.NEON_INTEGRATION_DATABASE_URL;
describe.runIf(enabled)(
  "AN1 stored context with simulated weather",
  { timeout: 30000 },
  () => {
    let world: ModuleWorld;
    const cityIds: string[] = [];
    const source = `simulated-${randomUUID()}`;
    beforeAll(async () => {
      world = await seedModuleWorld("AN1 context");
    }, 30000);
    afterAll(async () => {
      await dropModuleWorld(world);
      await getDb()
        .delete(analyticsWeather)
        .where(eq(analyticsWeather.source, source));
      await getDb()
        .delete(analyticsCities)
        .where(inArray(analyticsCities.id, cityIds));
    }, 30000);
    it("persists textual city metadata, daily forecast/observed pair and calendar exactly once", async () => {
      const suffix = randomUUID().slice(0, 8);
      const snapshot = {
        properties: {
          city: `Cuenca-${suffix}`,
          state: "Azuay",
          country_code: "ec",
          lat: -2.9,
          lon: -79,
        },
      };
      const cityId = await withDbTransaction((tx) =>
        resolveCity(tx, snapshot, "EC"),
      );
      expect(cityId).toBeTruthy();
      cityIds.push(cityId!);
      await getDb()
        .update(locations)
        .set({ cityId })
        .where(eq(locations.id, world.locationId));
      expect(
        (
          await getDb()
            .select()
            .from(analyticsCities)
            .where(eq(analyticsCities.id, cityId!))
        )[0].latitude,
      ).toBeNull();
      const provider = {
        ...simulatedWeatherProvider([
          {
            day: "2026-10-17",
            maximum: "21",
            minimum: "10",
            rainMm: "0",
            rainProbability: "10",
            condition: "Clear",
          },
          {
            day: "2026-10-16",
            maximum: "20",
            minimum: "9",
            rainMm: "1",
            rainProbability: "40",
            condition: "Rain",
          },
        ]),
        source,
      };
      await ingestExternalContext({
        now: new Date("2026-10-17T12:00:00Z"),
        provider,
      });
      await ingestExternalContext({
        now: new Date("2026-10-17T13:00:00Z"),
        provider,
      });
      const weather = await getDb()
        .select()
        .from(analyticsWeather)
        .where(
          and(
            eq(analyticsWeather.cityId, cityId!),
            eq(analyticsWeather.source, source),
          ),
        );
      expect(weather).toHaveLength(2);
      expect(weather.map((r) => r.type).sort()).toEqual([
        "forecast",
        "observed",
      ]);
      const city = (
        await getDb()
          .select()
          .from(analyticsCities)
          .where(eq(analyticsCities.id, cityId!))
      )[0];
      expect(city).toMatchObject({
        latitude: "-2.9",
        longitude: "-79.0",
        timezone: "America/Guayaquil",
        activeUntil: null,
      });
      expect(city.activeSince).toBeInstanceOf(Date);
      const calendar = await getDb()
        .select()
        .from(analyticsCalendarEvents)
        .where(
          and(
            eq(analyticsCalendarEvents.reference, "EC"),
            eq(analyticsCalendarEvents.day, "2026-12-24"),
            eq(analyticsCalendarEvents.type, "payday"),
          ),
        );
      expect(calendar).toHaveLength(1);
      await getDb()
        .update(locations)
        .set({ status: "archived" })
        .where(eq(locations.id, world.locationId));
      await withDbTransaction(refreshActiveCities);
      expect(
        (
          await getDb()
            .select()
            .from(analyticsCities)
            .where(eq(analyticsCities.id, cityId!))
        )[0].activeUntil,
      ).toBeInstanceOf(Date);
    });
  },
);
