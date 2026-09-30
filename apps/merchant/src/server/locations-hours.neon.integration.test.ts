import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  seedLocationsBusiness,
} from "./locations-integration-support";
import { dropBusiness } from "./counter-integration-support";
import { getDb } from "./db";
import { locationHours, locations } from "./schema";
import { LocationError, getLocationHours, putLocationHours } from "./locations";

/**
 * Spec 0113 H1 — the opening hours of a location against a real base: the «cortado», a
 * range past midnight, the week REPLACED (not accumulated), `hours_version` bumped on every
 * `PUT`, the 400's fields, and a location of another business answered 404 (read AND
 * write). Every state is READ BY SQL.
 */

const seeded: string[] = [];
afterAll(async () => {
  for (const id of seeded.splice(0)) await dropBusiness(id);
}, 120_000);

async function business(label: string) {
  const seed = await seedLocationsBusiness(`${label} ${Date.now()}`, "plus");
  seeded.push(seed.business.id);
  return seed;
}

const week = (ranges: Record<number, { opens: string; closes: string }[]>) => ({
  days: Array.from({ length: 7 }, (_, i) => ({
    weekday: i + 1,
    ranges: ranges[i + 1] ?? [],
  })),
});

const versionOf = async (locationId: string) =>
  (
    await getDb()
      .select({ v: locations.hoursVersion })
      .from(locations)
      .where(eq(locations.id, locationId))
  )[0].v;

async function caught(work: () => Promise<unknown>): Promise<LocationError> {
  try {
    await work();
  } catch (error) {
    if (error instanceof LocationError) return error;
    throw error;
  }
  throw new Error("esperaba un LocationError");
}

describe.skipIf(!integrationEnabled)("location hours — H1", () => {
  it("a new location has no hours: 7 closed days, hours_version 0", async () => {
    const seed = await business("Horario vacio");
    const hours = await getLocationHours(seed.business, seed.locationId);
    expect(hours.days).toHaveLength(7);
    expect(hours.days.every((d) => d.ranges.length === 0)).toBe(true);
    expect(await versionOf(seed.locationId)).toBe(0);
  }, 180_000);

  it("PUT the «cortado» and a Saturday night past midnight; a second PUT REPLACES the week and bumps the version", async () => {
    const seed = await business("Horario cortado");
    const first = await putLocationHours(
      seed.business,
      seed.locationId,
      week({
        1: [
          { opens: "08:00", closes: "13:00" },
          { opens: "16:00", closes: "21:00" },
        ],
        6: [{ opens: "20:00", closes: "02:00" }],
      }),
    );
    expect(first.ok).toBe(true);
    const read = await getLocationHours(seed.business, seed.locationId);
    expect(read.days[0].ranges).toEqual([
      { opens: "08:00", closes: "13:00" },
      { opens: "16:00", closes: "21:00" },
    ]);
    expect(read.days[5].ranges).toEqual([{ opens: "20:00", closes: "02:00" }]);
    expect(first.ok && first.hours).toEqual(read);
    expect(await versionOf(seed.locationId)).toBe(1);

    await putLocationHours(
      seed.business,
      seed.locationId,
      week({ 3: [{ opens: "09:30", closes: "18:00" }] }),
    );
    const rows = await getDb()
      .select({
        weekday: locationHours.weekday,
        position: locationHours.position,
      })
      .from(locationHours)
      .where(eq(locationHours.locationId, seed.locationId));
    expect(rows).toEqual([{ weekday: 3, position: 1 }]);
    expect(await versionOf(seed.locationId)).toBe(2);
  }, 180_000);

  it("400 fields: an overlap, a bad step — nothing written, version untouched", async () => {
    const seed = await business("Horario invalido");
    const answer = await putLocationHours(
      seed.business,
      seed.locationId,
      week({
        2: [
          { opens: "08:00", closes: "13:00" },
          { opens: "12:00", closes: "15:00" },
        ],
        4: [{ opens: "08:10", closes: "13:00" }],
      }),
    );
    expect(answer).toEqual({
      ok: false,
      fields: {
        "days.1.ranges.1": "Los dos rangos del día se pisan.",
        "days.3.ranges.0": "Las horas van en pasos de 30 minutos.",
      },
    });
    expect(await versionOf(seed.locationId)).toBe(0);
  }, 180_000);

  it("a location of ANOTHER business is 404 on read and on write, and its hours are untouched", async () => {
    const mine = await business("Horario mio");
    const theirs = await business("Horario ajeno");
    await putLocationHours(
      theirs.business,
      theirs.locationId,
      week({ 1: [{ opens: "10:00", closes: "12:00" }] }),
    );
    expect(
      await caught(() => getLocationHours(mine.business, theirs.locationId)),
    ).toMatchObject({ status: 404, code: "unknown_location" });
    expect(
      await caught(() =>
        putLocationHours(mine.business, theirs.locationId, week({})),
      ),
    ).toMatchObject({ status: 404, code: "unknown_location" });
    const kept = await getLocationHours(theirs.business, theirs.locationId);
    expect(kept.days[0].ranges).toEqual([{ opens: "10:00", closes: "12:00" }]);
    expect(await versionOf(theirs.locationId)).toBe(1);
  }, 180_000);
});
