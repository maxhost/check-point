import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  businesses,
  campaignTurns,
  consumerAccounts,
  locations,
  passPlacements,
} from "../schema";
import { buildObjectPatch } from "./google-object";
import {
  type PassLocation,
  type PassPlacementRow,
  toPassLocations,
} from "./pass-locations";

/**
 * The ONLY reader of `consumer.pass_placement` (spec 0065 phase A4). The marketing tick
 * writes those rows; the three emission call-sites and the silent Google `PATCH` read
 * them through here.
 *
 * `pass_placement` has **no coordinates** — it is keyed `(consumer_id, location_id)` — so
 * the geometry comes from a join with `core.location`, whose `latitude`/`longitude` are
 * `numeric(10,7)` (driver → string) and NULLABLE. Neither is filtered in SQL on purpose:
 * dropping a door without coordinates is a product rule with a single home and a unit
 * oracle, `toPassLocations`.
 *
 * The `order by` is explicit (`computed_at`, then `location_id` to break the tie inside
 * one tick) so the pass carries its doors in the same sequence on every run. ORQUESTADOR:
 * removing it reddens NOTHING, and the reason an earlier version of this comment gave —
 * "otherwise the ≤10 slice would pick a different subset" — is UNREACHABLE: the planner
 * caps the set at ≤3 utility + ≤5 turns = 8 doors (measured in phase A2, probe D5), so the
 * builders' slice of 10 never truncates. The ordering is therefore cosmetic determinism,
 * not a correctness guard, and it is declared as such instead of being pinned by a test
 * that would need a database to say something no user can observe.
 */
export async function passLocationsForConsumer(
  consumerId: string,
): Promise<PassLocation[]> {
  const rows: PassPlacementRow[] = await getDb()
    .select({
      locationId: passPlacements.locationId,
      latitude: locations.latitude,
      longitude: locations.longitude,
      relevantText: passPlacements.relevantText,
      businessName: businesses.name,
      turnId: passPlacements.turnId,
      turnMessage: campaignTurns.messageSnapshot,
    })
    .from(passPlacements)
    .innerJoin(locations, eq(locations.id, passPlacements.locationId))
    .innerJoin(businesses, eq(businesses.id, passPlacements.businessId))
    .leftJoin(campaignTurns, eq(campaignTurns.id, passPlacements.turnId))
    .where(eq(passPlacements.consumerId, consumerId))
    .orderBy(asc(passPlacements.computedAt), asc(passPlacements.locationId));
  return toPassLocations(rows);
}

/**
 * The body of the silent Google object `PATCH` for one consumer (spec 0065, class
 * `pass_refresh`): its doors plus its text modules, read fresh.
 *
 * `latest_message` is read and re-sent even though a `pass_refresh` never WRITES it: the
 * patch ships the complete arrays this product owns (`buildObjectPatch`), so the
 * consumer's last transactional notice survives the refresh under either `PATCH` array
 * semantics.
 */
export async function googleObjectPatchFor(
  consumerId: string,
): Promise<Record<string, unknown>> {
  const [account] = await getDb()
    .select({ latestMessage: consumerAccounts.latestMessage })
    .from(consumerAccounts)
    .where(eq(consumerAccounts.id, consumerId))
    .limit(1);
  const passLocations = await passLocationsForConsumer(consumerId);
  return buildObjectPatch({
    latestMessage: account?.latestMessage ?? null,
    passLocations,
  });
}
