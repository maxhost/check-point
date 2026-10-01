/**
 * What a consumer's pass shows AT EACH DOOR (spec 0065 phase A4): the shape the two pass
 * builders render, and the PURE conversion from a `consumer.pass_placement` row joined
 * with its `core.location`. No DB and no network here — the reader lives in
 * `pass-locations-store.ts`, so `apple.ts`/`google-object.ts` (and every existing unit
 * test of the builders) stay free of the database.
 *
 * The pass builder NEVER decides what to place (`schema/campaign-turn.ts`): the marketing
 * tick writes the rows and this module only renders them.
 */

/** Apple's hard cap of `locations` entries per pass; mirrored on Google's
 * `merchantLocations` so both platforms carry the same doors. The planner already caps
 * the set (≤5 turns + ≤3 utility), so this is the last line of defence at the boundary
 * with the platform, not the place where the product rule lives. */
export const MAX_PASS_LOCATIONS = 10;

/**
 * ONE door inside a consumer's pass, ready to render.
 *
 * `latitude`/`longitude` are **numbers**: `core.location.latitude` is `numeric(10,7)`,
 * which the Postgres driver hands back as a **string**, and both Apple and Google ignore
 * a stringified coordinate (`"latitude": "-34.6083"` installs fine and simply never
 * triggers). The conversion happens once, in {@link toPassLocations}; this type is what
 * stops a raw row from travelling any further.
 */
export type PassLocation = {
  locationId: string;
  latitude: number;
  longitude: number;
  /** `pass_placement.relevant_text` (≤120): the lock-screen line at this door. */
  relevantText: string;
  /** Owner of the door — the `{negocio}` of the Google text module. */
  businessName: string;
  /**
   * The marketing turn this door carries (`slot_kind` `'turn'`/`'both'`), `null` for a
   * utility-only door. Google has NO per-location text, so a door with a turn also
   * produces a `textModulesData` entry; Apple carries the text in `relevantText`.
   */
  turn: { turnId: string; message: string } | null;
};

/** A `consumer.pass_placement` row as the driver returns it, joined with its location,
 * its business name and (for a turn door) the turn's `message_snapshot`. */
export type PassPlacementRow = {
  locationId: string;
  /** `numeric(10,7)` → string; `null` when the address was never geocoded. */
  latitude: string | null;
  longitude: string | null;
  relevantText: string;
  businessName: string;
  turnId: string | null;
  turnMessage: string | null;
};

/**
 * `core.location.latitude`/`longitude` (`numeric(10,7)`, nullable) → a usable point, or
 * `null` when the door cannot be geofenced. The rule of «a door without coordinates is
 * dropped» lives HERE and nowhere else: the marketing tick applies it when it chooses
 * what to place (`marketing/placement-store.ts`) and the pass builders apply it when
 * they render what was placed, and a second copy would be a second rule (the lesson of
 * `lib/image-formats.ts`). The two guards are discussed in {@link toPassLocations}.
 */
export function toLatLng(
  latitude: string | null,
  longitude: string | null,
): { latitude: number; longitude: number } | null {
  const rawLatitude = latitude?.trim();
  const rawLongitude = longitude?.trim();
  if (!rawLatitude || !rawLongitude) return null;
  const parsedLatitude = Number(rawLatitude);
  const parsedLongitude = Number(rawLongitude);
  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude))
    return null;
  return { latitude: parsedLatitude, longitude: parsedLongitude };
}

/**
 * Rows → renderable doors. Two rules, both load-bearing:
 *
 *  1. **A door without coordinates is DROPPED.** `core.location.latitude`/`longitude` are
 *     nullable by design (spec 0061 decision 3: an address typed in but not geocoded has
 *     text and no georeference, and fabricating an approximate point is forbidden). A
 *     geofence needs a point, so such a door cannot enter the pass at all — and Apple
 *     rejects the whole `locations` array on a malformed entry, which would silently cost
 *     the consumer the OTHER doors too.
 *  2. **The coordinates come out as numbers.** Two guards, and ORQUESTADOR: their division
 *     of labour is not the one an earlier version of this comment claimed, which is why it
 *     was re-measured by mutation. A `null` column is dropped by EITHER guard
 *     (`null?.trim()` is `undefined` and `Number(undefined)` is `NaN`), so `isFinite`
 *     alone would already handle the nullable case the spec cares about. What ONLY the
 *     string check catches is an **empty** string: `Number("")` is `0`, a finite number,
 *     which would place that door on the equator. A `numeric` column cannot hold `""`, so
 *     that guard is defensive against a future non-`numeric` source, not against today's
 *     schema — kept because it is free, documented as defensive rather than load-bearing.
 *     `Number.isFinite` is the one that carries the reachable case: a non-numeric leftover
 *     that would otherwise ship as `NaN` and reach Apple as `null`.
 *     Mutating either guard reddens the SAME assertion (`row({latitude: ""})`), so the two
 *     are INDISTINGUISHABLE from the suite's point of view.
 *
 * A turn door whose `message_snapshot` is null keeps its place (its `relevantText` is
 * already written) but produces no Google module: there would be nothing to put in it.
 */
export function toPassLocations(rows: PassPlacementRow[]): PassLocation[] {
  const out: PassLocation[] = [];
  for (const row of rows) {
    const point = toLatLng(row.latitude, row.longitude);
    if (!point) continue;
    out.push({
      locationId: row.locationId,
      latitude: point.latitude,
      longitude: point.longitude,
      relevantText: row.relevantText,
      businessName: row.businessName,
      turn:
        row.turnId && row.turnMessage
          ? { turnId: row.turnId, message: row.turnMessage }
          : null,
    });
  }
  return out;
}
