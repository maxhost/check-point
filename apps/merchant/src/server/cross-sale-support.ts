import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { seedConsumer } from "./counter-integration-support";
import {
  type CrossWorld,
  category,
  crossBusiness,
  crossCampaign,
  north,
} from "./consumer-cross-support";
import { seedOrder } from "./marketing-integration-support";
import { resolveScan } from "./counter/resolve";
import { grantAccrual } from "./counter/grant";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  campaignCoupons,
  campaignPushes,
  crossCandidates,
  crossDecisions,
  locations,
  walletPushQueue,
} from "@mi-pasaporte/db/schema";
import type { GeoPoint } from "@mi-pasaporte/domain/server/marketing/cross-rules";

/**
 * THE WORLD OF THE CROSS SALE (spec 0143) against a real base, for
 * `cross-sale*.neon.integration.test.ts`. A is a café where the consumer buys; B (300 m) and
 * C (900 m) are businesses of other rubros with a LIVE cross campaign each (plan `plus`,
 * `consumer-cross-support.ts`). Every world stands on its own random spot far from the other
 * suites' worlds (CABA, Ecuador, `(0, 0)`), so no foreign campaign is ever within 2 km and
 * the candidates are exactly the world's. `dropCrossWorlds` tears them down.
 */

export const MINUTE = 60_000;

/** A spot in the Patagonian steppe, per world (the 2 km radius never reaches another). */
export const spot = (): GeoPoint => ({
  latitude: -44 - Math.random() * 3,
  longitude: -69 - Math.random() * 3,
});

export type SaleWorld = {
  a: CrossWorld;
  b: CrossWorld;
  c: CrossWorld;
  campaignB: string;
  campaignC: string;
};

/** A at a fresh spot; B at 300 m and C at 900 m, each with its cross campaign. */
export async function saleWorld(tag: string): Promise<SaleWorld> {
  const cat = category(tag);
  const here = spot();
  const a = await crossBusiness(`Cafe ${tag}`, cat("cafe"), here);
  const b = await crossBusiness(`Pan ${tag}`, cat("bakery"), north(here, 300));
  const c = await crossBusiness(`Pelu ${tag}`, cat("salon"), north(here, 900));
  return {
    a,
    b,
    c,
    campaignB: await crossCampaign(b),
    campaignC: await crossCampaign(c),
  };
}

/** A lonely A: no cross campaign within 2 km. */
export async function lonelyA(tag: string): Promise<CrossWorld> {
  return await crossBusiness(`Solo ${tag}`, category(tag)("cafe"), spot());
}

/** Takes A's only location off the map (no coordinates): the order has no origin. */
export async function ungeocode(world: CrossWorld): Promise<void> {
  await getDb()
    .update(locations)
    .set({ latitude: null, longitude: null })
    .where(eq(locations.id, world.seed.locationId));
}

/** A fresh consumer, enrolled in A by a scan (the counter's real path). */
export async function enrolled(a: CrossWorld) {
  const consumer = await seedConsumer();
  const scan = await resolveScan(a.seed.business, consumer.qrToken);
  return {
    consumerId: consumer.id,
    membershipId: scan.membership.id,
    qrToken: consumer.qrToken,
  };
}

/** An accreditation at A's counter, through the REAL `grantAccrual`. */
export async function grant(
  a: CrossWorld,
  membershipId: string,
  clientRequestId: string = randomUUID(),
) {
  return await grantAccrual(a.seed.business, a.seed.userId, {
    clientRequestId,
    membershipId,
    mode: "quick",
    total: "6.00",
    locationId: a.seed.locationId,
  });
}

/** An order at A written straight by SQL (no `afterGrant`): to call `decideCrossSale` by hand. */
export async function orderAt(
  a: CrossWorld,
  who: { consumerId: string; membershipId: string },
  at: Date,
): Promise<string> {
  return await seedOrder({
    businessId: a.seed.business.id,
    locationId: a.seed.locationId,
    programId: a.seed.programId,
    membershipId: who.membershipId,
    consumerId: who.consumerId,
    userId: a.seed.userId,
    createdAt: at,
  });
}

export async function businessName(world: CrossWorld): Promise<string> {
  const [row] = await getDb()
    .select({ name: businesses.name })
    .from(businesses)
    .where(eq(businesses.id, world.seed.business.id));
  return row.name;
}

export const decisionsOf = (consumerId: string) =>
  getDb()
    .select()
    .from(crossDecisions)
    .where(eq(crossDecisions.consumerId, consumerId))
    .orderBy(asc(crossDecisions.outcome));

export const candidatesOf = (decisionId: string) =>
  getDb()
    .select()
    .from(crossCandidates)
    .where(eq(crossCandidates.decisionId, decisionId))
    .orderBy(asc(crossCandidates.distanceMeters));

export const couponsOf = (consumerId: string) =>
  getDb()
    .select({
      id: campaignCoupons.id,
      campaignId: campaignCoupons.campaignId,
      crossClaimedAt: campaignCoupons.crossClaimedAt,
    })
    .from(campaignCoupons)
    .where(eq(campaignCoupons.consumerId, consumerId));

export const queueOf = (consumerId: string) =>
  getDb()
    .select({
      id: walletPushQueue.id,
      class: walletPushQueue.class,
      title: walletPushQueue.title,
      body: walletPushQueue.body,
      status: walletPushQueue.status,
      notBefore: walletPushQueue.notBefore,
    })
    .from(walletPushQueue)
    .where(eq(walletPushQueue.consumerId, consumerId));

export const pushesOf = (consumerId: string) =>
  getDb()
    .select({ id: campaignPushes.id })
    .from(campaignPushes)
    .where(eq(campaignPushes.consumerId, consumerId));

/**
 * Waits until `count` transactions are blocked on the cross sale's campaign lock
 * (`lockCampaigns`, the only `order by c.id … for update`). Throws after ~20 s.
 */
export async function waitForLockWaiters(count: number): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await getDb().execute(sql`
      select count(*)::int as waiting from pg_stat_activity
      where wait_event_type = 'Lock'
        and query ilike '%from core.campaign c%order by c.id%for update%'`);
    const [row] = result.rows as { waiting: number }[];
    if (Number(row?.waiting ?? 0) >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no llegaron ${count} decisiones a esperar el lock`);
}
