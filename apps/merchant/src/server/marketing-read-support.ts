import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  campaignLocations,
  campaignTickAudiences,
  campaignTurns,
  campaigns,
  consumerAccounts,
  couponRedemptions,
  passPlacements,
} from "./schema";

/**
 * The READ half of the marketing integration support (spec 0065 phase A5): what the
 * assertions read by SQL, plus the teardown. Split from the seeds so neither file grows
 * past the size budget.
 *
 * Everything here reads the DATABASE, never an API response: a route that reports a
 * state it did not write is exactly the failure ADR 0054 was written about.
 */

/** Every turn of a business, newest first, with what the assertions read. */
export async function readTurns(businessId: string) {
  return await getDb()
    .select({
      id: campaignTurns.id,
      consumerId: campaignTurns.consumerId,
      locationId: campaignTurns.locationId,
      status: campaignTurns.status,
      holdout: campaignTurns.holdout,
      windowStart: campaignTurns.windowStart,
      windowEnd: campaignTurns.windowEnd,
      messageSnapshot: campaignTurns.messageSnapshot,
      couponLabelSnapshot: campaignTurns.couponLabelSnapshot,
      outcome: campaignTurns.outcome,
      outcomeOrderId: campaignTurns.outcomeOrderId,
      cancelReason: campaignTurns.cancelReason,
    })
    .from(campaignTurns)
    .where(eq(campaignTurns.businessId, businessId))
    .orderBy(campaignTurns.queuedAt);
}

/** `consumer.pass_placement` by SQL — the API is never the oracle (ADR 0054 §4). */
export async function readPlacement(consumerId: string) {
  return await getDb()
    .select({
      locationId: passPlacements.locationId,
      slotKind: passPlacements.slotKind,
      turnId: passPlacements.turnId,
      businessId: passPlacements.businessId,
      relevantText: passPlacements.relevantText,
    })
    .from(passPlacements)
    .where(eq(passPlacements.consumerId, consumerId))
    .orderBy(passPlacements.locationId);
}

export async function readAccount(consumerId: string) {
  const [row] = await getDb()
    .select({
      latestMessage: consumerAccounts.latestMessage,
      messageUpdatedAt: consumerAccounts.messageUpdatedAt,
      lastPushAt: consumerAccounts.lastPushAt,
    })
    .from(consumerAccounts)
    .where(eq(consumerAccounts.id, consumerId));
  return row;
}

/**
 * Tears down everything marketing seeded for a business, in FK order and BEFORE
 * `dropBusiness`. `campaign_turn.membership_id`/`.consumer_id` and
 * `coupon_redemption`'s are NO ACTION (copied from `reward_redemption`), so a test that
 * seeds turns and calls `dropBusiness` first explodes with `23503`: the memberships go
 * before the turns that point at them.
 */
export async function dropCampaigns(businessId: string): Promise<void> {
  const db = getDb();
  const ids = (
    await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.businessId, businessId))
  ).map((row) => row.id);
  await db
    .delete(passPlacements)
    .where(eq(passPlacements.businessId, businessId));
  // `campaign_turn` ⇄ `coupon_redemption` is a CIRCULAR fk pair (`outcome_redemption_id`
  // one way, `turn_id` the other), so neither side can go first: the pointer has to be
  // cut before the row it points at can be deleted.
  await db
    .update(campaignTurns)
    .set({ outcomeRedemptionId: null })
    .where(eq(campaignTurns.businessId, businessId));
  await db
    .delete(couponRedemptions)
    .where(eq(couponRedemptions.businessId, businessId));
  await db
    .delete(campaignTurns)
    .where(eq(campaignTurns.businessId, businessId));
  if (ids.length > 0) {
    await db
      .delete(campaignTickAudiences)
      .where(inArray(campaignTickAudiences.campaignId, ids));
    await db.delete(campaignLocations).where(
      sql`${campaignLocations.campaignId} in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
    await db.delete(campaigns).where(eq(campaigns.businessId, businessId));
  }
}
