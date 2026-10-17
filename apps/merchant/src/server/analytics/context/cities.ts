import {
  analyticsCities,
  analyticsZones,
  analyticsCityZones,
  locations,
  businesses,
} from "@mi-pasaporte/db/schema";
import type { DbTransaction } from "@mi-pasaporte/db";
import { eq, sql } from "drizzle-orm";
import tzLookup from "@photostructure/tz-lookup";
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export const normalizeCityPart = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
export type CitySnapshot = {
  countryCode: string;
  region: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
  timezone: string;
};
/** Google Details and historical Geoapify properties; typed addresses intentionally yield no city. */
export function cityFromSnapshot(
  snapshot: unknown,
  fallbackCountry: string,
): CitySnapshot | null {
  const s = object(snapshot),
    details = object(s.result ?? s.details ?? s),
    properties = object(s.properties ?? s);
  const components = details.addressComponents ?? details.address_components;
  const component = (type: string) =>
    Array.isArray(components)
      ? components
          .map(object)
          .find((c) => Array.isArray(c.types) && c.types.includes(type))
      : undefined;
  const text = (c: Record<string, unknown> | undefined) =>
    typeof c?.longText === "string"
      ? c.longText
      : typeof c?.long_name === "string"
        ? c.long_name
        : null;
  const name =
    text(component("locality")) ??
    text(component("administrative_area_level_2")) ??
    (typeof properties.city === "string" ? properties.city : null);
  const region =
    text(component("administrative_area_level_1")) ??
    (typeof properties.state === "string" ? properties.state : null);
  if (!name || !region) return null;
  const country = component("country"),
    countryCode = String(
      country?.shortText ??
        country?.short_name ??
        properties.country_code ??
        fallbackCountry,
    ).toUpperCase();
  const point = object(details.location ?? object(details.geometry).location);
  const lat = point.latitude ?? point.lat ?? properties.lat,
    lon = point.longitude ?? point.lng ?? properties.lon;
  const latitude =
      Number.isFinite(Number(lat)) && lat !== undefined ? String(lat) : null,
    longitude =
      Number.isFinite(Number(lon)) && lon !== undefined ? String(lon) : null;
  let timezone =
    typeof object(properties.timezone).name === "string"
      ? String(object(properties.timezone).name)
      : null;
  if (!timezone && latitude !== null && longitude !== null)
    timezone = tzLookup(Number(latitude), Number(longitude));
  // Ecuador's two time zones can be resolved without inventing a georeference.
  if (!timezone && countryCode === "EC")
    timezone = normalizeCityPart(region).includes("galapagos")
      ? "Pacific/Galapagos"
      : "America/Guayaquil";
  if (!timezone) return null;
  return {
    name,
    region,
    countryCode,
    latitude: null,
    longitude: null,
    timezone,
  };
}
const zoneRegions: Record<string, readonly string[]> = {
  Sierra: [
    "Azuay",
    "Bolívar",
    "Cañar",
    "Carchi",
    "Chimborazo",
    "Cotopaxi",
    "Imbabura",
    "Loja",
    "Pichincha",
    "Tungurahua",
  ],
  Costa: [
    "El Oro",
    "Esmeraldas",
    "Guayas",
    "Los Ríos",
    "Manabí",
    "Santa Elena",
    "Santo Domingo de los Tsáchilas",
  ],
  Amazonía: [
    "Morona Santiago",
    "Napo",
    "Orellana",
    "Pastaza",
    "Sucumbíos",
    "Zamora Chinchipe",
  ],
  Galápagos: ["Galápagos"],
};
export async function resolveCity(
  tx: DbTransaction,
  snapshot: unknown,
  countryCode: string,
) {
  const city = cityFromSnapshot(snapshot, countryCode);
  if (!city) return null;
  const normalizedKey = [
    city.countryCode,
    normalizeCityPart(city.region),
    normalizeCityPart(city.name),
  ].join("/");
  const [row] = await tx
    .insert(analyticsCities)
    .values({ ...city, normalizedKey })
    .onConflictDoUpdate({
      target: analyticsCities.normalizedKey,
      set: { name: city.name, region: city.region },
    })
    .returning({ id: analyticsCities.id });
  if (city.countryCode === "EC") {
    for (const [name, regions] of Object.entries(zoneRegions)) {
      if (
        regions.some(
          (r) => normalizeCityPart(r) === normalizeCityPart(city.region),
        )
      ) {
        const id = `EC/${normalizeCityPart(name)}`;
        await tx
          .insert(analyticsZones)
          .values({ id, countryCode: "EC", name })
          .onConflictDoNothing();
        await tx
          .insert(analyticsCityZones)
          .values({ cityId: row.id, zoneId: id })
          .onConflictDoNothing();
      }
    }
  }
  return row.id;
}
/** Reconciles active cities from active businesses/locations while preserving historical context. */
export async function refreshActiveCities(tx: DbTransaction) {
  await tx.execute(
    sql`update analytics.city c set active_since=case when c.active_since is null or c.active_until is not null then now() else c.active_since end,active_until=null where (c.active_since is null or c.active_until is not null) and exists(select 1 from core.location l join core.business b on b.id=l.business_id where l.city_id=c.id and l.status='active' and b.status='active')`,
  );
  await tx.execute(
    sql`update analytics.city c set active_until=now() where c.active_since is not null and c.active_until is null and not exists(select 1 from core.location l join core.business b on b.id=l.business_id where l.city_id=c.id and l.status='active' and b.status='active')`,
  );
}
/** One-time, explicitly invoked development/CI backfill; never reconstructs analytics events. */
export async function resolveExistingLocationCities(tx: DbTransaction) {
  const rows = await tx
    .select({
      id: locations.id,
      snapshot: locations.addressSnapshot,
      countryCode: locations.countryCode,
    })
    .from(locations)
    .innerJoin(businesses, eq(businesses.id, locations.businessId));
  let resolved = 0;
  for (const row of rows) {
    const cityId = await resolveCity(tx, row.snapshot, row.countryCode);
    await tx.update(locations).set({ cityId }).where(eq(locations.id, row.id));
    if (cityId) resolved++;
  }
  await refreshActiveCities(tx);
  return { processed: rows.length, resolved };
}
