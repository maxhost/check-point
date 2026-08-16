import { and, eq, sql } from "drizzle-orm";
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
 * Is there a wallet pass of this consumer that can actually notify? (ADR 0040). True iff
 * EITHER an Apple pass has a registered `wallet_push_device` (an APNs token to wake) OR a
 * Google pass exists (Google delivers via `addMessage`, no device row needed). A generated
 * Apple pass with NO device registered is NOT reachable — that is the exact case the
 * transactional fallback must catch to reach the consumer by Web Push instead. Resolved in
 * ONE query (two `EXISTS`, no rows pulled).
 */
export async function consumerHasReachableWallet(
  consumerId: string,
): Promise<boolean> {
  const res = await getDb().execute(sql`
    SELECT (
      EXISTS (
        SELECT 1
        FROM consumer.wallet_push_device d
        JOIN consumer.wallet_pass p ON p.id = d.wallet_pass_id
        WHERE p.consumer_id = ${consumerId} AND p.provider = 'apple'
      )
      OR EXISTS (
        SELECT 1
        FROM consumer.wallet_pass g
        WHERE g.consumer_id = ${consumerId} AND g.provider = 'google'
      )
    ) AS reachable`);
  const rows = Array.isArray(res)
    ? (res as Record<string, unknown>[])
    : (((res as { rows?: unknown[] } | null)?.rows ?? []) as Record<
        string,
        unknown
      >[]);
  return rows[0]?.reachable === true;
}

/** Which transports carry one notice, decided by its class (ADR 0040). Pure so the
 * routing is unit-testable without a DB — the effectful send lives in
 * {@link deliverTransports}. `transactional` goes ONLY by wallet when it is reachable, and
 * falls back to Web Push ONLY when it is not (the two never coexist → never a duplicate).
 * `campaign` keeps the provisional fan-out until the campaign spec refines it. */
export type TransportPlan = {
  apple: boolean;
  google: boolean;
  webPush: boolean;
};
export function planTransports(
  noticeClass: string,
  reachableWallet: boolean,
): TransportPlan {
  if (noticeClass === "transactional") {
    return reachableWallet
      ? { apple: true, google: true, webPush: false }
      : { apple: false, google: false, webPush: true };
  }
  // `campaign` (provisional, no rows in prod): keep the ADR 0038 fan-out.
  return { apple: true, google: true, webPush: true };
}

/**
 * Delivers one notice over the transports selected by its `class` (ADR 0040, supersedes
 * the ADR 0038 §3 fan-out). A `transactional` goes by wallet (Apple APNs + Google
 * `addMessage`, spec 0033) when the consumer has a reachable pass, else falls back to Web
 * Push (spec 0037) — never both, so no duplicate. `campaign` keeps the provisional
 * fan-out. Each transport is best-effort — one failing transport never blocks the others —
 * and every error is collected so the caller records it on the queue row. This is a SINGLE
 * notice: the per-consumer cooldown counts it once (the caller closes exactly one row).
 */
export async function deliverTransports(
  consumerId: string,
  message: PushMessage,
  noticeClass: string,
  opts: { channel: PushChannel; webPushChannel: WebPushChannel | null },
): Promise<string[]> {
  const reachable =
    noticeClass === "transactional"
      ? await consumerHasReachableWallet(consumerId)
      : false;
  const plan = planTransports(noticeClass, reachable);
  const errors: string[] = [];
  if (plan.apple)
    errors.push(...(await sendApple(consumerId, message, opts.channel)));
  if (plan.google)
    errors.push(...(await sendGoogle(consumerId, message, opts.channel)));
  if (plan.webPush)
    errors.push(
      ...(await deliverWebPush(
        consumerId,
        { title: message.header, body: message.body, url: NOTICE_URL },
        opts.webPushChannel,
      )),
    );
  return errors;
}
