import Holidays from "date-holidays";
import type { DbTransaction } from "@mi-pasaporte/db";
import {
  analyticsCalendarEvents,
  analyticsCities,
} from "@mi-pasaporte/db/schema";
import { eq } from "drizzle-orm";
import {
  CALENDAR_SOURCES,
  LOCAL_HOLIDAYS,
  SCHOOL_STARTS,
} from "./calendar-curated";
import { normalizeCityPart } from "./cities";
export type CalendarRow = typeof analyticsCalendarEvents.$inferInsert;
export function movedHoliday(day: string, exception = false) {
  const d = new Date(`${day}T12:00:00Z`),
    w = d.getUTCDay();
  const delta =
    w === 6
      ? -1
      : w === 0
        ? 1
        : exception
          ? 0
          : w === 2
            ? -1
            : w === 3
              ? 2
              : w === 4
                ? 1
                : 0;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
/** date-holidays supplies Easter-derived dates only. EC static definitions/observances are corrected against the official calendar. */
export function nationalCalendar(year: number): CalendarRow[] {
  const holidays = new Holidays("EC")
    .getHolidays(year)
    .filter(
      (h) =>
        h.type === "public" &&
        (h.name === "Carnaval" || h.name === "Viernes Santo"),
    );
  const rows: CalendarRow[] = holidays.map((h) => ({
    day: h.date.slice(0, 10),
    scope: "country",
    reference: "EC",
    type: "holiday",
    name: h.name,
    source: "rule",
    sourceUrl: CALENDAR_SOURCES.national,
  }));
  for (const [md, name, exception] of [
    ["01-01", "Año Nuevo", true],
    ["05-01", "Día del Trabajo", false],
    ["05-24", "Batalla de Pichincha", false],
    ["08-10", "Primer Grito de Independencia", false],
    ["10-09", "Independencia de Guayaquil", false],
    ["12-25", "Navidad", true],
  ] as const) {
    const original = `${year}-${md}`,
      day = movedHoliday(original, exception);
    rows.push({
      day,
      scope: "country",
      reference: "EC",
      type: day === original ? "holiday" : "holiday_moved",
      name,
      source: "rule",
      sourceUrl: CALENDAR_SOURCES.law,
    });
  }
  // Consecutive November holidays have their own paired-day rule (LOSEP general fourth).
  const first = `${year}-11-02`,
    second = `${year}-11-03`,
    w = new Date(`${first}T12:00:00Z`).getUTCDay();
  const pair =
    w === 0
      ? [`${year}-11-04`, `${year}-11-03`]
      : w === 2
        ? [first, `${year}-11-01`]
        : w === 3
          ? [`${year}-11-04`, second]
          : w === 5
            ? [first, `${year}-11-01`]
            : w === 6
              ? [`${year}-11-01`, `${year}-11-04`]
              : [first, second];
  ["Día de Difuntos", "Independencia de Cuenca"].forEach((name, i) =>
    rows.push({
      day: pair[i],
      scope: "country",
      reference: "EC",
      type: pair[i] === [first, second][i] ? "holiday" : "holiday_moved",
      name,
      source: "rule",
      sourceUrl: CALENDAR_SOURCES.law,
    }),
  );
  if (year === 2026)
    rows.push({
      day: "2026-01-02",
      scope: "country",
      reference: "EC",
      type: "holiday",
      name: "Suspensión de jornada — Decreto Ejecutivo 249",
      source: "curated",
      sourceUrl: CALENDAR_SOURCES.january2026,
    });
  return rows;
}
export function recurringCuratedCalendar(year: number): CalendarRow[] {
  const rows: CalendarRow[] = [
    {
      day: `${year}-12-24`,
      scope: "country",
      reference: "EC",
      type: "payday",
      name: "Límite décimo tercero acumulado",
      source: "curated",
      sourceUrl: CALENDAR_SOURCES.decimos,
    },
  ];
  rows.push({
    day: `${year}-02-14`,
    scope: "country",
    reference: "EC",
    type: "commercial",
    name: "San Valentín",
    source: "curated",
    sourceUrl:
      "https://www.quitoinforma.gob.ec/2026/02/13/el-amor-tambien-vuelve-al-centro-quito-activa-su-corazon-historico-en-el-feriado/",
  });
  for (const zone of ["sierra", "amazonia", "costa", "galapagos"])
    rows.push({
      day: `${year}-${["costa", "galapagos"].includes(zone) ? "03-15" : "08-15"}`,
      scope: "zone",
      reference: `EC/${zone}`,
      type: "payday",
      name: "Límite décimo cuarto acumulado",
      source: "curated",
      sourceUrl: CALENDAR_SOURCES.decimos,
    });
  for (let month = 1; month <= 12; month++)
    rows.push({
      day: `${year}-${String(month).padStart(2, "0")}-15`,
      scope: "country",
      reference: "EC",
      type: "payday",
      name: "Quincena",
      source: "curated",
      sourceUrl: CALENDAR_SOURCES.quincena,
    });
  for (const item of SCHOOL_STARTS.filter((s) =>
    s.day.startsWith(String(year)),
  ))
    for (const zone of item.zones)
      rows.push({
        day: item.day,
        scope: "zone",
        reference: `EC/${zone}`,
        type: "school",
        name: "Inicio escalonado de clases fiscales",
        source: "curated",
        sourceUrl: item.sourceUrl,
      });
  return rows;
}
export async function loadCalendar(tx: DbTransaction, year: number) {
  const cities = await tx
    .select()
    .from(analyticsCities)
    .where(eq(analyticsCities.countryCode, "EC"));
  const rows = [...nationalCalendar(year), ...recurringCuratedCalendar(year)];
  for (const city of cities)
    for (const holiday of LOCAL_HOLIDAYS)
      if (
        normalizeCityPart(city.name) === normalizeCityPart(holiday.city) &&
        normalizeCityPart(city.region) === normalizeCityPart(holiday.region)
      ) {
        const original = `${year}-${holiday.monthDay}`,
          day = movedHoliday(original);
        rows.push({
          day,
          scope: "city",
          reference: city.id,
          type: day === original ? "holiday" : "holiday_moved",
          name: holiday.name,
          source: "curated",
          sourceUrl: holiday.sourceUrl,
        });
      }
  if (rows.length)
    await tx.insert(analyticsCalendarEvents).values(rows).onConflictDoNothing();
  return rows.length;
}
