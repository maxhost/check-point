import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { walletPasses, walletPushDevices } from "../schema";
import {
  ApnsGoneError,
  type PushChannel,
  type PushMessage,
  passTypeIdFromEnv,
} from "./push-channel";
import { type WebPushChannel } from "../push/webpush-channel";
import { deliverWebPush } from "../push/subscriptions";

/** The consumer portal path a notification click opens (served inside the PWA/tab). */
const NOTICE_URL = "/wallet";

async function appleTargets(consumerId: string) {
  return getDb()
    .select({
      id: walletPushDevices.id,
      pushToken: walletPushDevices.pushToken,
    })
    .from(walletPushDevices)
    .innerJoin(
      walletPasses,
      eq(walletPushDevices.walletPassId, walletPasses.id),
    )
    .where(
      and(
        eq(walletPasses.consumerId, consumerId),
        eq(walletPasses.provider, "apple"),
      ),
    );
}

/** Pushes to every Apple device of the consumer. A dead token (410) is pruned; any
 * other per-device error does NOT abort the rest (one bad device never blocks the
 * others) but IS returned so the caller can record it — silent APNs failures (403
 * InvalidProviderToken, 400 TopicDisallowed/BadDeviceToken) were invisible before and
 * made "el push salió pero no llegó" undiagnosable. Returns the collected error strings. */
async function sendApple(
  consumerId: string,
  message: PushMessage,
  channel: PushChannel,
): Promise<string[]> {
  void message; // Apple push is empty; the pulled pass carries the new field.
  const targets = await appleTargets(consumerId);
  const passTypeId = passTypeIdFromEnv();
  const errors: string[] = [];
  for (const t of targets) {
    try {
      await channel.sendApple({ pushToken: t.pushToken, passTypeId });
    } catch (error) {
      if (error instanceof ApnsGoneError) {
        await getDb()
          .delete(walletPushDevices)
          .where(eq(walletPushDevices.id, t.id));
      } else {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[wallet-push] APNs send failed", msg);
        errors.push(`apple: ${msg}`);
      }
    }
  }
  return errors;
}

/** Pushes to the consumer's Google pass via `addMessage`. Returns the error string on
 * failure (recorded by the caller) so a misconfigured issuer/SA is visible, not silent. */
async function sendGoogle(
  consumerId: string,
  message: PushMessage,
  channel: PushChannel,
): Promise<string[]> {
  const [pass] = await getDb()
    .select({ serialNumber: walletPasses.serialNumber })
    .from(walletPasses)
    .where(
      and(
        eq(walletPasses.consumerId, consumerId),
        eq(walletPasses.provider, "google"),
      ),
    )
    .limit(1);
  if (!pass) return [];
  try {
    await channel.sendGoogle(pass.serialNumber, message);
    return [];
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[wallet-push] Google addMessage failed", msg);
    return [`google: ${msg}`];
  }
}

/**
 * Fan-out of one notice to ALL transports the consumer has (ADR 0038): the wallet pass
 * (Apple APNs + Google `addMessage`, spec 0033) AND Web Push (spec 0037). Each transport
 * is best-effort — one failing transport never blocks the others — and every error is
 * collected so the caller records it on the queue row. This is a SINGLE notice: the
 * per-consumer cooldown counts it once (the caller closes exactly one queue row).
 */
export async function deliverTransports(
  consumerId: string,
  message: PushMessage,
  opts: { channel: PushChannel; webPushChannel: WebPushChannel | null },
): Promise<string[]> {
  return [
    ...(await sendApple(consumerId, message, opts.channel)),
    ...(await sendGoogle(consumerId, message, opts.channel)),
    ...(await deliverWebPush(
      consumerId,
      { title: message.header, body: message.body, url: NOTICE_URL },
      opts.webPushChannel,
    )),
  ];
}
