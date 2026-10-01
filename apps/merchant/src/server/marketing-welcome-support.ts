import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  type Seed,
  dropBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { seedLocationsBusiness } from "./locations-integration-support";
import { seedMembership } from "./marketing-integration-support";
import { dropCampaigns } from "./marketing-read-support";
import { getDb } from "@mi-pasaporte/db";
import {
  campaignCoupons,
  campaigns,
  couponRedemptions,
  walletPasses,
  walletPushDevices,
  welcomeDevices,
} from "@mi-pasaporte/db/schema";
import type { WelcomeRedeemFrom } from "@mi-pasaporte/domain/server/marketing/templates";

/**
 * The world of the «Bienvenida» suites (spec 0107): a `plus` business with a LIVE
 * subscription (the plan gate is `campaigns.enabled`, `plan-gate.ts`) in
 * `America/Guayaquil` (UTC−5, no DST — the seed's zone), its welcome campaign switched on
 * at a chosen instant, and consumers enrolled at a chosen instant with an Apple pass —
 * INSTALLED only when the case registers a device. Every assertion reads by SQL.
 */

export const DAY = 86_400_000;
export const welcomeWorlds: string[] = [];

export type WelcomeWorld = { seed: Seed; campaignId: string };

export async function welcomeWorld(
  label: string,
  opts: {
    activatedAt: Date;
    redeemFrom?: WelcomeRedeemFrom;
    validDays?: number;
    reminderDays?: number;
    monthlyCap?: number;
  },
): Promise<WelcomeWorld> {
  const live = randomUUID().slice(0, 8);
  const seed = await seedLocationsBusiness(`${label} ${Date.now()}`, "plus", {
    interval: "month",
    stripeCustomerId: `cus_${live}`,
    stripeSubscriptionId: `sub_${live}`,
  });
  welcomeWorlds.push(seed.business.id);
  const [row] = await getDb()
    .insert(campaigns)
    .values({
      businessId: seed.business.id,
      kind: "proximity",
      templateKey: "welcome",
      channelProximity: false,
      channelPush: false,
      name: "Bienvenida",
      status: "active",
      activatedAt: opts.activatedAt,
      message: "Sumate hoy y en tu próxima visita te llevás un regalo",
      couponLabel: "Un café gratis",
      couponCost: "1.20",
      couponKind: "free_product",
      welcomeValidDays: opts.validDays ?? 15,
      welcomeReminderDays: opts.reminderDays ?? 3,
      welcomeMonthlyCap: opts.monthlyCap ?? 50,
      welcomeRedeemFrom: opts.redeemFrom ?? "next_day",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      createdByUserId: seed.userId,
    })
    .returning({ id: campaigns.id });
  return { seed, campaignId: row.id };
}

export type WelcomeConsumer = {
  consumerId: string;
  membershipId: string;
  passId: string;
  serial: string;
  authToken: string;
};

/** A consumer enrolled at `enrolledAt` with an Apple pass GENERATED, not installed. */
export async function welcomeConsumer(
  world: WelcomeWorld,
  enrolledAt: Date,
  consumerId?: string,
): Promise<WelcomeConsumer> {
  const id = consumerId ?? (await seedConsumer()).id;
  const membershipId = await seedMembership({
    consumerId: id,
    programId: world.seed.programId,
    businessId: world.seed.business.id,
    enrolledAt,
  });
  const [existing] = await getDb()
    .select({ id: walletPasses.id, serial: walletPasses.serialNumber })
    .from(walletPasses)
    .where(eq(walletPasses.consumerId, id));
  const serial = existing?.serial ?? `wl-${randomUUID()}`;
  const authToken = `tok-${randomUUID()}`;
  const passId =
    existing?.id ??
    (
      await getDb()
        .insert(walletPasses)
        .values({
          consumerId: id,
          provider: "apple",
          serialNumber: serial,
          authToken,
        })
        .returning({ id: walletPasses.id })
    )[0].id;
  return { consumerId: id, membershipId, passId, serial, authToken };
}

/** The row PassKit's registration writes (`registerDevice`), inserted directly. */
export async function installOn(
  person: WelcomeConsumer,
  deviceLibraryId: string,
): Promise<void> {
  await getDb()
    .insert(walletPushDevices)
    .values({
      walletPassId: person.passId,
      deviceLibraryId,
      pushToken: `push-${randomUUID()}`,
    });
}

/** A GOOGLE pass (generated; installed only when its `save` callback lands). */
export async function googlePass(consumerId: string): Promise<string> {
  const serial = `gw-${randomUUID()}`;
  await getDb()
    .insert(walletPasses)
    .values({ consumerId, provider: "google", serialNumber: serial });
  return serial;
}

export async function readGoogleSavedAt(serial: string): Promise<Date | null> {
  const [row] = await getDb()
    .select({ savedAt: walletPasses.googleSavedAt })
    .from(walletPasses)
    .where(eq(walletPasses.serialNumber, serial));
  return row.savedAt;
}

/** The counter's redemption of a welcome coupon, inserted directly. */
export async function redeemWelcome(
  world: WelcomeWorld,
  person: WelcomeConsumer,
  couponId: string,
): Promise<void> {
  await getDb().insert(couponRedemptions).values({
    couponId,
    campaignId: world.campaignId,
    businessId: world.seed.business.id,
    consumerId: person.consumerId,
    membershipId: person.membershipId,
    locationId: world.seed.locationId,
    labelSnapshot: "Un café gratis",
    costSnapshot: "1.20",
    kindSnapshot: "free_product",
    createdByUserId: world.seed.userId,
    clientRequestId: randomUUID(),
  });
}

export async function readWelcomeCoupons(businessId: string) {
  return await getDb()
    .select({
      id: campaignCoupons.id,
      consumerId: campaignCoupons.consumerId,
      membershipId: campaignCoupons.welcomeMembershipId,
      validFrom: campaignCoupons.validFrom,
      validUntil: campaignCoupons.validUntil,
      createdAt: campaignCoupons.createdAt,
      reminderQueueId: campaignCoupons.reminderQueueId,
      label: campaignCoupons.labelSnapshot,
    })
    .from(campaignCoupons)
    .where(eq(campaignCoupons.businessId, businessId))
    .orderBy(campaignCoupons.createdAt);
}

export async function readWelcomeDevices(businessId: string) {
  return await getDb()
    .select({ device: welcomeDevices.deviceLibraryId })
    .from(welcomeDevices)
    .where(eq(welcomeDevices.businessId, businessId));
}

export async function dropWelcomeWorlds(): Promise<void> {
  for (const businessId of welcomeWorlds.splice(0)) {
    await dropCampaigns(businessId);
    await dropBusiness(businessId);
  }
}
