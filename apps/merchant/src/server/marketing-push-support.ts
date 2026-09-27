import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  campaignPushes,
  campaigns,
  walletPasses,
  walletPushQueue,
  webPushSubscriptions,
} from "./schema";
import type { TemplateKey } from "./marketing/templates";

/**
 * Seeds and reads of the push-channel suites (spec 0103), out of the test files for the
 * size budget. Everything is READ BY SQL (ADR 0054): a DTO is never the oracle.
 */

/** A TEMPLATE campaign on the push channel (push-only unless `proximity`). */
export async function seedPushCampaign(opts: {
  businessId: string;
  userId: string;
  templateKey: TemplateKey;
  dormantDays: number;
  proximity?: boolean;
  push?: boolean;
  status?: "active" | "paused" | "ended";
  message?: string;
  coupon?: { label: string; cost: string; maxRedemptions: number };
  endsAt?: Date | null;
  createdAt?: Date;
}): Promise<string> {
  const [row] = await getDb()
    .insert(campaigns)
    .values({
      businessId: opts.businessId,
      kind: "proximity",
      templateKey: opts.templateKey,
      channelProximity: opts.proximity ?? false,
      channelPush: opts.push ?? true,
      name: opts.templateKey,
      status: opts.status ?? "active",
      dormantDays: opts.dormantDays,
      message: opts.message ?? "¡Volvé!",
      couponLabel: opts.coupon?.label ?? null,
      couponCost: opts.coupon?.cost ?? null,
      couponMaxRedemptions: opts.coupon?.maxRedemptions ?? null,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt:
        opts.endsAt !== undefined
          ? opts.endsAt
          : opts.coupon
            ? new Date("2099-01-01T00:00:00.000Z")
            : null,
      createdByUserId: opts.userId,
      createdAt: opts.createdAt ?? new Date(),
    })
    .returning({ id: campaigns.id });
  return row.id;
}

export async function seedWebPush(consumerId: string): Promise<string> {
  const endpoint = `https://push.test/${randomUUID()}`;
  await getDb().insert(webPushSubscriptions).values({
    consumerId,
    endpoint,
    p256dhKey: "p256dh",
    authKey: "auth",
  });
  return endpoint;
}

export async function seedGooglePass(consumerId: string): Promise<void> {
  await getDb()
    .insert(walletPasses)
    .values({
      consumerId,
      provider: "google",
      serialNumber: `gp-${randomUUID()}`,
      authToken: `tok-${randomUUID()}`,
    });
}

/**
 * A decision as a previous tick would have left it. Non-holdout rows get their queue row
 * (`pending`, due at `notBefore`), exactly as `recordPushDecision` writes them.
 */
export async function seedDecision(opts: {
  campaignId: string;
  businessId: string;
  consumerId: string;
  membershipId: string;
  decidedAt: Date;
  holdout?: boolean;
  notBefore?: Date;
  sentAt?: Date | null;
  clickedAt?: Date | null;
  cancel?: { at: Date; reason: string } | null;
  title?: string;
  body?: string;
}): Promise<{ pushId: string; queueId: string | null }> {
  let queueId: string | null = null;
  if (!opts.holdout) {
    const [queued] = await getDb()
      .insert(walletPushQueue)
      .values({
        consumerId: opts.consumerId,
        class: "campaign",
        title: opts.title ?? "La Gringa",
        body: opts.body ?? "¡Volvé!",
        status: opts.sentAt ? "sent" : opts.cancel ? "cancelled" : "pending",
        notBefore: opts.notBefore ?? opts.decidedAt,
      })
      .returning({ id: walletPushQueue.id });
    queueId = queued.id;
  }
  const [row] = await getDb()
    .insert(campaignPushes)
    .values({
      campaignId: opts.campaignId,
      businessId: opts.businessId,
      consumerId: opts.consumerId,
      membershipId: opts.membershipId,
      holdout: opts.holdout ?? false,
      queueId,
      decidedAt: opts.decidedAt,
      sentAt: opts.sentAt ?? null,
      clickedAt: opts.clickedAt ?? null,
      cancelledAt: opts.cancel?.at ?? null,
      cancelReason: opts.cancel?.reason ?? null,
    })
    .returning({ id: campaignPushes.id });
  return { pushId: row.id, queueId };
}

export async function readPushes(businessId: string) {
  return await getDb()
    .select()
    .from(campaignPushes)
    .where(eq(campaignPushes.businessId, businessId))
    .orderBy(campaignPushes.decidedAt);
}

export async function readPush(pushId: string) {
  const [row] = await getDb()
    .select()
    .from(campaignPushes)
    .where(eq(campaignPushes.id, pushId));
  return row;
}

/** Every queue row of these consumers, any class and status. */
export async function readQueue(consumerIds: string[]) {
  if (consumerIds.length === 0) return [];
  return await getDb()
    .select()
    .from(walletPushQueue)
    .where(inArray(walletPushQueue.consumerId, consumerIds));
}
