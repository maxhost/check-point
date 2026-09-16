/**
 * The DB half of step 4 of the tick (spec 0065): everything `planConsumerPlacement`
 * needs for ONE consumer, plus the two platform-wide tables it is fed (the quota and
 * the merit scores are loaded once per run by `tick.ts`, not per consumer).
 *
 * Reads only. The writes are in `placement.ts`, which is also where the per-consumer
 * `select … for update` is taken — a read that happens before the lock would plan on a
 * photo the applier no longer owns.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbTransaction } from "../db";
import {
  businesses,
  campaignTurns,
  campaigns,
  consumerAccounts,
  locations,
  passPlacements,
} from "../schema";
import { toLatLng } from "../wallet/pass-locations";
import type { ActiveTurn, PlacedSlot, QueuedTurn } from "./placement-plan";

/**
 * Who gets planned: every consumer with a live turn OR a row already in the pass. The
 * second half is not decoration — it is how a door LEAVES the pass when its turn
 * expires, since by then the consumer has no live turn left to find them by.
 *
 * `consumerIds` narrows a run to what a test seeded (same scoping as
 * `wallet/push-worker.ts`); production passes none.
 */
export async function loadPlacementConsumerIds(
  db: DbTransaction,
  consumerIds?: string[],
): Promise<string[]> {
  const scope =
    consumerIds && consumerIds.length > 0
      ? sql` and s.consumer_id in (${sql.join(
          consumerIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;
  const result = await db.execute<{ consumer_id: string }>(sql`
    select distinct s.consumer_id from (
      select consumer_id from core.campaign_turn where status in ('queued', 'active')
      union
      select consumer_id from consumer.pass_placement
    ) s
    where true${scope}
    order by s.consumer_id
  `);
  return result.rows.map((row) => row.consumer_id);
}

/** The per-consumer lock of step 4. Held until the tick's transaction commits. */
export async function lockConsumer(
  db: DbTransaction,
  consumerId: string,
): Promise<void> {
  await db
    .select({ id: consumerAccounts.id })
    .from(consumerAccounts)
    .where(eq(consumerAccounts.id, consumerId))
    .for("update");
}

/** `pass_placement.slot_kind` → the planner's union. Exhaustive and total: an unknown
 * value THROWS instead of degrading into a valid-looking one (`wallet/push-worker.ts`,
 * `parseQueueClass`). The DB check already restricts the column to these three. */
export function parseSlotKind(raw: string): PlacedSlot["slotKind"] {
  switch (raw) {
    case "utility":
    case "turn":
    case "both":
      return raw;
    default:
      throw new Error(`pass_placement.slot_kind desconocido: ${raw}`);
  }
}

/** `active`, non-holdout turns: they hold a slot, impose the 400 m exclusion and are in
 * the pass. A holdout is deliberately absent — that is what makes it a base line. */
export async function loadActiveTurns(
  db: DbTransaction,
  consumerId: string,
): Promise<ActiveTurn[]> {
  const rows = await db
    .select({
      turnId: campaignTurns.id,
      businessId: campaignTurns.businessId,
      businessName: businesses.name,
      locationId: locations.id,
      latitude: locations.latitude,
      longitude: locations.longitude,
      message: campaignTurns.messageSnapshot,
    })
    .from(campaignTurns)
    .innerJoin(locations, eq(locations.id, campaignTurns.locationId))
    .innerJoin(businesses, eq(businesses.id, campaignTurns.businessId))
    .where(
      and(
        eq(campaignTurns.consumerId, consumerId),
        eq(campaignTurns.status, "active"),
        eq(campaignTurns.holdout, false),
      ),
    );
  return rows.flatMap((row) => {
    const point = toLatLng(row.latitude, row.longitude);
    if (!point) return [];
    return [
      {
        turnId: row.turnId,
        businessId: row.businessId,
        businessName: row.businessName,
        locationId: row.locationId,
        message: row.message ?? "",
        ...point,
      },
    ];
  });
}

/**
 * `queued` turns with what activation has to snapshot. The message and the coupon are
 * read from the CAMPAIGN here — the snapshot columns are written at activation, so
 * while the turn waits in the queue they are still null, and editing a paused campaign
 * before its turn activates is meant to change what that turn will say.
 */
export async function loadQueuedTurns(
  db: DbTransaction,
  consumerId: string,
): Promise<QueuedTurn[]> {
  const rows = await db
    .select({
      turnId: campaignTurns.id,
      campaignId: campaignTurns.campaignId,
      membershipId: campaignTurns.membershipId,
      businessId: campaignTurns.businessId,
      businessName: businesses.name,
      locationId: locations.id,
      latitude: locations.latitude,
      longitude: locations.longitude,
      queuedAt: campaignTurns.queuedAt,
      message: campaigns.message,
      couponLabel: campaigns.couponLabel,
      couponCost: campaigns.couponCost,
    })
    .from(campaignTurns)
    .innerJoin(locations, eq(locations.id, campaignTurns.locationId))
    .innerJoin(businesses, eq(businesses.id, campaignTurns.businessId))
    .innerJoin(campaigns, eq(campaigns.id, campaignTurns.campaignId))
    .where(
      and(
        eq(campaignTurns.consumerId, consumerId),
        eq(campaignTurns.status, "queued"),
      ),
    );
  return rows.flatMap((row) => {
    const point = toLatLng(row.latitude, row.longitude);
    if (!point) return [];
    return [
      {
        turnId: row.turnId,
        campaignId: row.campaignId,
        membershipId: row.membershipId,
        businessId: row.businessId,
        businessName: row.businessName,
        locationId: row.locationId,
        queuedAt: row.queuedAt,
        message: row.message,
        couponLabel: row.couponLabel,
        couponCost: row.couponCost,
        ...point,
      },
    ];
  });
}

/** What the pass shows TODAY, to decide whether anything has to be rewritten. */
export async function loadCurrentPlacement(
  db: DbTransaction,
  consumerId: string,
): Promise<PlacedSlot[]> {
  const rows = await db
    .select({
      locationId: passPlacements.locationId,
      slotKind: passPlacements.slotKind,
      relevantText: passPlacements.relevantText,
    })
    .from(passPlacements)
    .where(eq(passPlacements.consumerId, consumerId));
  return rows.map((row) => ({
    locationId: row.locationId,
    slotKind: parseSlotKind(row.slotKind),
    relevantText: row.relevantText,
  }));
}

/** Last window this consumer already spent with each business — `active`/`done` only:
 * a `cancelled` turn keeps its `window_end` and must not burn the cooldown. */
export async function loadCooldownMap(
  db: DbTransaction,
  consumerId: string,
): Promise<Map<string, Date>> {
  const rows = await db
    .select({
      businessId: campaignTurns.businessId,
      lastWindowEnd: sql<Date | null>`max(${campaignTurns.windowEnd})`.mapWith(
        campaignTurns.windowEnd,
      ),
    })
    .from(campaignTurns)
    .where(
      and(
        eq(campaignTurns.consumerId, consumerId),
        inArray(campaignTurns.status, ["active", "done"]),
      ),
    )
    .groupBy(campaignTurns.businessId);
  const map = new Map<string, Date>();
  for (const row of rows)
    if (row.lastWindowEnd) map.set(row.businessId, row.lastWindowEnd);
  return map;
}

/** The quota, platform-wide: `active` non-holdout turns per business. Read ONCE per
 * run and then advanced in memory as turns are activated, so the cap holds INSIDE a
 * single run instead of only between runs. */
export async function loadBusinessActiveTurns(
  db: DbTransaction,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      businessId: campaignTurns.businessId,
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(campaignTurns)
    .where(
      and(eq(campaignTurns.status, "active"), eq(campaignTurns.holdout, false)),
    )
    .groupBy(campaignTurns.businessId);
  return new Map(rows.map((row) => [row.businessId, row.total]));
}
