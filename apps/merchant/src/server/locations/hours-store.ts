import { and, asc, eq, sql } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "../db";
import { locationHours, locations } from "../schema";
import { LocationError } from "./core";
import { type DayHours, parseHours } from "./hours-input";
import { parseLocationId } from "./shared";

/**
 * THE OPENING HOURS OF A LOCATION against the database (spec 0113 H1 / ADR 0105 §5).
 * Business-scoped like every location operation: a location of another business is a 404
 * `unknown_location`, never a read or a write. The `PUT` replaces the WHOLE week in one
 * transaction (delete + insert) and bumps `location.hours_version`, which is how the
 * marketing tick knows the valley detection is stale (V4).
 */

export type WeekHours = { days: DayHours[] };

export type HoursWrite =
  | { ok: true; hours: WeekHours }
  | { ok: false; fields: Record<string, string> };

const hhmm = (value: string) => value.slice(0, 5);

function unknownLocation(): LocationError {
  return new LocationError(404, "unknown_location", "Ese local no existe.");
}

async function readWeek(
  db: DbTransaction | ReturnType<typeof getDb>,
  locationId: string,
): Promise<WeekHours> {
  const rows = await db
    .select({
      weekday: locationHours.weekday,
      opens: locationHours.opens,
      closes: locationHours.closes,
    })
    .from(locationHours)
    .where(eq(locationHours.locationId, locationId))
    .orderBy(asc(locationHours.weekday), asc(locationHours.position));
  return {
    days: Array.from({ length: 7 }, (_, index) => ({
      weekday: index + 1,
      ranges: rows
        .filter((row) => row.weekday === index + 1)
        .map((row) => ({ opens: hhmm(row.opens), closes: hhmm(row.closes) })),
    })),
  };
}

/** `GET /api/locations/{locationId}/hours` — always the 7 days (`[]` = closed). */
export async function getLocationHours(
  business: { id: string },
  rawLocationId: string,
): Promise<WeekHours> {
  const locationId = parseLocationId(rawLocationId);
  const db = getDb();
  const [own] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(eq(locations.id, locationId), eq(locations.businessId, business.id)),
    )
    .limit(1);
  if (!own) throw unknownLocation();
  return await readWeek(db, locationId);
}

/** `PUT /api/locations/{locationId}/hours` — the whole week, or the 400's `fields`. */
export async function putLocationHours(
  business: { id: string },
  rawLocationId: string,
  body: unknown,
): Promise<HoursWrite> {
  const locationId = parseLocationId(rawLocationId);
  const parsed = parseHours(body);
  if (!parsed.ok) return parsed;
  const hours = await withDbTransaction(async (tx) => {
    const [own] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.businessId, business.id),
        ),
      )
      .for("update")
      .limit(1);
    if (!own) throw unknownLocation();
    await tx
      .delete(locationHours)
      .where(eq(locationHours.locationId, locationId));
    const rows = parsed.days.flatMap((day) =>
      day.ranges.map((range, index) => ({
        locationId,
        weekday: day.weekday,
        position: index + 1,
        opens: range.opens,
        closes: range.closes,
      })),
    );
    if (rows.length > 0) await tx.insert(locationHours).values(rows);
    await tx
      .update(locations)
      .set({ hoursVersion: sql`${locations.hoursVersion} + 1` })
      .where(eq(locations.id, locationId));
    return await readWeek(tx, locationId);
  });
  return { ok: true, hours };
}
