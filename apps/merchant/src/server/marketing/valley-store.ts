import { sql } from "drizzle-orm";
import { campaigns } from "../schema";
import { type Db, rowsOf } from "./cross-store";
import {
  type DayHours,
  type Detection,
  type ScanCell,
  VALLEY_WEEKS,
  detectValleys,
} from "./valley-detect";
import {
  type ValleyWindow,
  type WindowSource,
  localClock,
} from "./valley-rules";
import { localMidnight } from "./welcome-rules";

/**
 * THE DATABASE HALF OF «HORAS VALLE» (spec 0113 / ADR 0105): the scans and opening hours a
 * detection reads, its persistence, the tick's step and the windows a location has. The
 * marketing API over them is `valley-windows.ts`; the consumer's side,
 * `consumer/valley-offers.ts`. Raw SQL with explicit aliases; counts are `::int`.
 *
 * THE TICK NEVER TOUCHES THE MERCHANT'S WINDOWS: a detection rewrites ONLY the rows with
 * `source = 'network'` of its location (ADR 0105 §6, V4).
 */

/** Spec 0113: «Horas valle»'s parameter in the DTO; `null` in every other campaign. */
export type CampaignValley = { monthlyCap: number };

export const valleySelect = { monthlyCap: campaigns.valleyMonthlyCap };

/** `null` unless the cap is there (`core_campaign_valley_shape_check`). */
export function valleyOf(
  row: { monthlyCap: number | null } | null,
): CampaignValley | null {
  return row?.monthlyCap == null ? null : { monthlyCap: row.monthlyCap };
}

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

/**
 * The 8 COMPLETE weeks before the business's local today: `[from, to)` as instants, and the
 * local date of `from` (week 0 starts there, so every weekday appears once per week).
 */
export function scanRange(
  now: Date,
  timeZone: string,
): { from: Date; to: Date; startDate: string } {
  const clock = localClock(now, timeZone);
  const back = VALLEY_WEEKS * WEEK_DAYS;
  const start = new Date(
    Date.UTC(clock.year, clock.month - 1, clock.day - back),
  );
  return {
    from: localMidnight(clock.year, clock.month, clock.day - back, timeZone),
    to: localMidnight(clock.year, clock.month, clock.day, timeZone),
    startDate: start.toISOString().slice(0, 10),
  };
}

export type ValleyLocation = {
  id: string;
  businessId: string;
  timeZone: string;
};

/** The scans (orders) of the location in the 8 weeks, on the business's wall clock. */
export async function loadScanCells(
  db: Db,
  location: ValleyLocation,
  now: Date,
): Promise<ScanCell[]> {
  const { from, to, startDate } = scanRange(now, location.timeZone);
  const tz = location.timeZone;
  const result = await db.execute(sql`
    select ((o.created_at at time zone ${tz})::date - ${startDate}::date) / 7 as week,
      extract(isodow from o.created_at at time zone ${tz})::int as weekday,
      extract(hour from o.created_at at time zone ${tz})::int as hour,
      count(*)::int as n
    from core."order" o
    where o.business_id = ${location.businessId}
      and o.location_id = ${location.id}
      and o.created_at >= ${from.toISOString()}::timestamptz
      and o.created_at < ${to.toISOString()}::timestamptz
    group by 1, 2, 3`);
  return rowsOf<Record<string, unknown>>(result).map((row) => ({
    week: Number(row.week),
    weekday: Number(row.weekday),
    hour: Number(row.hour),
    count: Number(row.n),
  }));
}

/** The 7×24 heat map of the same 8 weeks (V9), Monday first. */
export function heatmapOf(cells: readonly ScanCell[]): number[][] {
  const heat = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const cell of cells) heat[cell.weekday - 1][cell.hour] += cell.count;
  return heat;
}

const minutes = (value: unknown) => {
  const [hours, mins] = String(value).split(":");
  return Number(hours) * 60 + Number(mins);
};

/** The opening hours of these locations (a location without rows is absent). */
export async function loadHours(
  db: Db,
  locationIds: string[],
): Promise<Map<string, DayHours[]>> {
  const hours = new Map<string, DayHours[]>();
  if (locationIds.length === 0) return hours;
  const list = sql.join(
    locationIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const result = await db.execute(sql`
    select h.location_id, h.weekday, h.opens, h.closes from core.location_hours h
    where h.location_id in (${list})
    order by h.location_id, h.weekday, h.position`);
  for (const row of rowsOf<Record<string, unknown>>(result)) {
    const id = String(row.location_id);
    const days = hours.get(id) ?? [];
    const weekday = Number(row.weekday);
    let day = days.find((d) => d.weekday === weekday);
    if (!day) {
      day = { weekday, ranges: [] };
      days.push(day);
    }
    (day.ranges as { opens: number; closes: number }[]).push({
      opens: minutes(row.opens),
      closes: minutes(row.closes),
    });
    hours.set(id, days);
  }
  return hours;
}

export type WindowRow = ValleyWindow & { source: WindowSource };

/** Every window row (both sources) of these locations, by location. */
export async function loadWindowRows(
  db: Db,
  locationIds: string[],
): Promise<Map<string, WindowRow[]>> {
  const rows = new Map<string, WindowRow[]>();
  if (locationIds.length === 0) return rows;
  const list = sql.join(
    locationIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const result = await db.execute(sql`
    select w.location_id, w.weekday, w.start_hour, w.end_hour, w.source
    from core.valley_window w
    where w.location_id in (${list})
    order by w.location_id, w.weekday, w.start_hour`);
  for (const row of rowsOf<Record<string, unknown>>(result)) {
    const id = String(row.location_id);
    rows.set(id, [
      ...(rows.get(id) ?? []),
      {
        weekday: Number(row.weekday),
        startHour: Number(row.start_hour),
        endHour: Number(row.end_hour),
        source: String(row.source) as WindowSource,
      },
    ]);
  }
  return rows;
}

/** Writes the windows of one source, after deleting that source's rows of the location. */
export async function replaceWindows(
  db: Db,
  locationId: string,
  source: WindowSource,
  windows: readonly ValleyWindow[],
): Promise<void> {
  await db.execute(sql`
    delete from core.valley_window w
    where w.location_id = ${locationId} and w.source = ${source}`);
  for (const window of windows)
    await db.execute(sql`
      insert into core.valley_window (location_id, weekday, start_hour, end_hour, source)
      values (${locationId}, ${window.weekday}, ${window.startHour},
        ${window.endHour}, ${source})`);
}

/**
 * Detects and stores ONE location: its `network` windows are replaced by the proposal (the
 * `merchant` ones are left alone) and `valley_detection` records what was concluded, when,
 * and against which `hours_version`.
 */
export async function storeDetection(
  db: Db,
  location: ValleyLocation & { hoursVersion: number },
  now: Date,
): Promise<Detection> {
  const cells = await loadScanCells(db, location, now);
  const hours = (await loadHours(db, [location.id])).get(location.id) ?? null;
  const detection = detectValleys(cells, hours);
  await replaceWindows(db, location.id, "network", detection.windows);
  await db.execute(sql`
    insert into core.valley_detection (location_id, computed_at, status, scans, hours_version)
    values (${location.id}, ${now.toISOString()}, ${detection.status},
      ${detection.scans}, ${location.hoursVersion})
    on conflict (location_id) do update set computed_at = excluded.computed_at,
      status = excluded.status, scans = excluded.scans,
      hours_version = excluded.hours_version`);
  return detection;
}

/**
 * The tick's step (V4): every ACTIVE location whose detection is missing, older than 7
 * days, or computed against other opening hours. Returns how many it recomputed.
 */
export async function refreshValleyDetections(
  db: Db,
  now: Date,
  businessIds?: string[],
): Promise<number> {
  const stale = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const scope =
    businessIds && businessIds.length > 0
      ? sql`and l.business_id in (${sql.join(
          businessIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;
  const result = await db.execute(sql`
    select l.id, l.business_id, l.hours_version, b.timezone
    from core.location l
    join core.business b on b.id = l.business_id
    left join core.valley_detection d on d.location_id = l.id
    where l.status = 'active'
      and (d.location_id is null or d.computed_at < ${stale}::timestamptz
           or d.hours_version <> l.hours_version)
      ${scope}
    order by l.id`);
  const due = rowsOf<Record<string, unknown>>(result);
  for (const row of due)
    await storeDetection(
      db,
      {
        id: String(row.id),
        businessId: String(row.business_id),
        timeZone: String(row.timezone),
        hoursVersion: Number(row.hours_version),
      },
      now,
    );
  return due.length;
}
