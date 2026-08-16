import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { webPushSubscriptions } from "../schema";
import {
  type WebPushChannel,
  type WebPushPayload,
  WebPushGoneError,
} from "./webpush-channel";

/** The stored shape of one subscription (server-side; carries the secret key material). */
export type WebPushSubscriptionRow = {
  id: string;
  consumerId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  userAgent: string | null;
  platform: string;
  createdAt: Date;
  lastSeenAt: Date;
};

/**
 * Client-facing shape of a subscription. Explicit allow-list so it can NEVER serialize
 * the `endpoint`, `p256dhKey` or `authKey` (all device secrets, CLAUDE.md anti-leak
 * rule). Exposes only the id, platform and timestamps — enough for a "your devices" UI.
 */
export function webPushSubscriptionResponse(row: WebPushSubscriptionRow) {
  return {
    id: row.id,
    platform: row.platform,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
  };
}

/** Derives the coarse platform bucket from the UA (analytics + rotation purge only). */
export function derivePlatform(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? "").toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "other";
}

export type UpsertSubscriptionInput = {
  consumerId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  userAgent: string | null;
};

/**
 * Upserts a subscription by its unique `endpoint`. Idempotent: the same browser endpoint
 * re-posting only refreshes its keys/UA/`lastSeenAt`. The row is always (re)associated to
 * the CALLER's `consumerId` — the route only ever passes the session consumer, so this
 * cannot subscribe another consumer; if a device changes hands it moves to the new owner.
 */
export async function upsertSubscription(
  input: UpsertSubscriptionInput,
  now = new Date(),
): Promise<WebPushSubscriptionRow> {
  const platform = derivePlatform(input.userAgent);
  const [row] = await getDb()
    .insert(webPushSubscriptions)
    .values({
      consumerId: input.consumerId,
      endpoint: input.endpoint,
      p256dhKey: input.p256dhKey,
      authKey: input.authKey,
      userAgent: input.userAgent,
      platform,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: webPushSubscriptions.endpoint,
      set: {
        consumerId: input.consumerId,
        p256dhKey: input.p256dhKey,
        authKey: input.authKey,
        userAgent: input.userAgent,
        platform,
        lastSeenAt: now,
      },
    })
    .returning();
  return row as WebPushSubscriptionRow;
}

/** Deletes a subscription by endpoint (called on a 404/410 from the push service). */
export async function deleteSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  await getDb()
    .delete(webPushSubscriptions)
    .where(eq(webPushSubscriptions.endpoint, endpoint));
}

/** Reads all of a consumer's subscriptions (server-side; includes secret key material). */
export async function listConsumerSubscriptions(
  consumerId: string,
): Promise<WebPushSubscriptionRow[]> {
  const rows = await getDb()
    .select()
    .from(webPushSubscriptions)
    .where(eq(webPushSubscriptions.consumerId, consumerId));
  return rows as WebPushSubscriptionRow[];
}

/** True when the consumer has confirmed Web Push on at least one device. */
export async function hasWebPushSubscription(
  consumerId: string,
): Promise<boolean> {
  const rows = await getDb()
    .select({ id: webPushSubscriptions.id })
    .from(webPushSubscriptions)
    .where(eq(webPushSubscriptions.consumerId, consumerId))
    .limit(1);
  return rows.length > 0;
}

/**
 * Purges every Web Push subscription of one consumer — called by `rotatePassCredentials`
 * on account recovery (spec 0032), symmetric with the device wipe: the old installed PWA
 * icon then stops receiving notifications. Returns the number of rows removed.
 */
export async function purgeConsumerSubscriptions(
  consumerId: string,
): Promise<number> {
  const removed = await getDb()
    .delete(webPushSubscriptions)
    .where(eq(webPushSubscriptions.consumerId, consumerId))
    .returning({ id: webPushSubscriptions.id });
  return removed.length;
}

/**
 * Fan-out delivery to every Web Push subscription of one consumer (the `webpush`
 * transport of the notice, ADR 0038). A dead endpoint (404/410) is pruned; any other
 * per-subscription error does NOT abort the rest and IS collected so the caller records
 * it on the queue row — mirrors the per-device APNs behaviour of spec 0033. Returns the
 * collected error strings. A null channel (Web Push disabled: no VAPID) is a no-op.
 */
export async function deliverWebPush(
  consumerId: string,
  payload: WebPushPayload,
  channel: WebPushChannel | null,
): Promise<string[]> {
  if (!channel) return [];
  const subs = await listConsumerSubscriptions(consumerId);
  const errors: string[] = [];
  for (const s of subs) {
    try {
      await channel.send(
        { endpoint: s.endpoint, p256dhKey: s.p256dhKey, authKey: s.authKey },
        payload,
      );
    } catch (error) {
      if (error instanceof WebPushGoneError) {
        await deleteSubscriptionByEndpoint(s.endpoint);
      } else {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[web-push] send failed", msg);
        errors.push(`webpush: ${msg}`);
      }
    }
  }
  return errors;
}
