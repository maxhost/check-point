import { after } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { consumerAccounts } from "../schema";
import {
  type PushChannel,
  type PushMessage,
  pushChannelFromEnv,
} from "./push-channel";
import {
  type WebPushChannel,
  webPushChannelFromEnv,
} from "../push/webpush-channel";
import { deliverTransports } from "./push-transports";

/** Minimum spacing between two pushes to the same consumer (ADR 0037). */
export const COOLDOWN_MINUTES = Number(
  process.env.WALLET_PUSH_COOLDOWN_MINUTES ?? 3,
);
export const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000;
/** After this many failed attempts a row is parked as `failed` (observability). */
export const MAX_PUSH_ATTEMPTS = Number(
  process.env.WALLET_PUSH_MAX_ATTEMPTS ?? 5,
);
/** Backoff added to `not_before` after a failed attempt. */
export const BACKOFF_MS = COOLDOWN_MS;
/**
 * How long a claimed (`sending`) row may stay in-flight before it is considered
 * orphaned (the runner died between claim and delivery) and may be re-claimed. There
 * is no separate column: `not_before` **doubles as the reclaim deadline** once a row
 * is `sending` — {@link claimRow} stamps `not_before = now + STALE_CLAIM_MS` on claim,
 * so a fresh claim sits in the future (not re-picked) while a stranded one falls due
 * again and is swept by the next worker pass. Keeps at-least-once alive across crashes
 * without a schema change (spec 0033 correction).
 */
export const STALE_CLAIM_MINUTES = Number(
  process.env.WALLET_PUSH_STALE_CLAIM_MINUTES ?? 5,
);
export const STALE_CLAIM_MS = STALE_CLAIM_MINUTES * 60 * 1000;

/** neon-http returns `{ rows }`; normalize to an array of records. */
function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown[] } | null)?.rows;
  return (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
}

/**
 * The transactional notice body as a full sentence, e.g. `Se acreditó 1 sello en tu
 * cuenta 🎉` / `Se acreditaron 30 puntos en tu cuenta 🎉`. A complete sentence (not a
 * `+N` fragment) reads clearly both inside the Wallet pass and, where the platform
 * surfaces it, in the notification itself — the business name rides in the title/header.
 */
export function buildTransactionalBody(
  units: number,
  kind: "points" | "stamps",
): string {
  const singular = units === 1;
  const noun =
    kind === "points"
      ? singular
        ? "punto"
        : "puntos"
      : singular
        ? "sello"
        : "sellos";
  const verb = singular ? "Se acreditó" : "Se acreditaron";
  return `${verb} ${units} ${noun} en tu cuenta 🎉`;
}

// The pure drain planner lives in `push-plan.ts` (kept DB-free + under the file-size
// budget); re-exported here so existing importers keep using `./push`.
export {
  type QueueRow,
  type DrainAction,
  planConsumerDrain,
} from "./push-plan";

type Claim = {
  consumerId: string;
  title: string;
  body: string;
  class: string;
};

/**
 * Race-safe claim: flips exactly one due row to `sending` and returns its payload, or
 * null when another runner already took it (dispatch-inline vs cron). Claims a fresh
 * `pending` row OR re-claims a stranded `sending` one whose reclaim deadline has passed
 * — the guard `status IN ('pending','sending') AND not_before <= now` covers both.
 * On claim it stamps `not_before = now + STALE_CLAIM_MS`, which (a) parks a fresh claim
 * in the future so `selectDue` won't re-pick it mid-flight and (b) becomes the reclaim
 * deadline if the runner dies before closing the row (at-least-once across crashes).
 */
async function claimRow(id: string, now: Date): Promise<Claim | null> {
  const reclaimDeadline = new Date(
    now.getTime() + STALE_CLAIM_MS,
  ).toISOString();
  const res = await getDb().execute(sql`
    UPDATE consumer.wallet_push_queue
    SET status = 'sending', not_before = ${reclaimDeadline}
    WHERE id = ${id}
      AND status IN ('pending', 'sending')
      AND not_before <= ${now.toISOString()}
    RETURNING consumer_id, title, body, class`);
  const [row] = rowsOf(res);
  if (!row) return null;
  return {
    consumerId: String(row.consumer_id),
    title: String(row.title),
    body: String(row.body),
    class: String(row.class),
  };
}

/**
 * Delivery context threaded from the claim path: the wallet channel (Apple/Google),
 * the Web Push channel (null when Web Push is disabled — no VAPID), and the clock.
 */
type DeliverOpts = {
  channel: PushChannel;
  webPushChannel: WebPushChannel | null;
  now: Date;
};

/** Materializes the notice on the consumer and delivers it over the transports selected
 * by its `class` (ADR 0040: transactional → wallet, else Web Push fallback), then closes
 * the row (`sent`) and preempts pending campaigns — or backs off on failure. It is ONE
 * notice: exactly one queue row closes, so the per-consumer cooldown counts it as a single
 * push (ADR 0038) regardless of how many transports the class selected. */
async function deliverClaimed(
  id: string,
  claim: Claim,
  opts: DeliverOpts,
): Promise<void> {
  const { channel, webPushChannel, now } = opts;
  const message: PushMessage = { header: claim.title, body: claim.body };
  const latest = claim.title ? `${claim.title}: ${claim.body}` : claim.body;
  try {
    await getDb()
      .update(consumerAccounts)
      .set({ latestMessage: latest, messageUpdatedAt: now, updatedAt: now })
      .where(eq(consumerAccounts.id, claim.consumerId));
    // Per-transport delivery is best-effort (one bad transport never blocks the pass
    // update or another transport); every APNs/Google/Web Push error is recorded on the
    // row so a misconfigured transport is visible in the DB instead of a silent `sent`.
    const deliveryErrors = await deliverTransports(
      claim.consumerId,
      message,
      claim.class,
      { channel, webPushChannel },
    );
    const deliveryError = deliveryErrors.length
      ? deliveryErrors.join(" | ").slice(0, 500)
      : null;
    await getDb().execute(sql`
      UPDATE consumer.wallet_push_queue
      SET status = 'sent', sent_at = ${now.toISOString()},
          last_error = ${deliveryError}
      WHERE id = ${id}`);
    await getDb()
      .update(consumerAccounts)
      .set({ lastPushAt: now })
      .where(eq(consumerAccounts.id, claim.consumerId));
    // Preemption: push out any pending campaign of this consumer by the cooldown.
    await getDb().execute(sql`
      UPDATE consumer.wallet_push_queue
      SET not_before = ${new Date(now.getTime() + COOLDOWN_MS).toISOString()}
      WHERE consumer_id = ${claim.consumerId}
        AND class = 'campaign' AND status = 'pending'
        AND not_before < ${new Date(now.getTime() + COOLDOWN_MS).toISOString()}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await getDb().execute(sql`
      UPDATE consumer.wallet_push_queue
      SET attempts = attempts + 1,
          last_error = ${msg},
          status = CASE WHEN attempts + 1 >= ${MAX_PUSH_ATTEMPTS}
                        THEN 'failed' ELSE 'pending' END,
          not_before = CASE WHEN attempts + 1 >= ${MAX_PUSH_ATTEMPTS}
                        THEN not_before
                        ELSE ${new Date(now.getTime() + BACKOFF_MS).toISOString()} END
      WHERE id = ${id}`);
  }
}

/**
 * Best-effort inline dispatch of one queued row (after the grant commit). Claims it;
 * if another runner already did, no-op. Never throws — durability is the cron's job.
 */
export async function dispatchInline(
  id: string,
  opts: {
    channel: PushChannel;
    webPushChannel?: WebPushChannel | null;
    now?: Date;
  },
): Promise<void> {
  try {
    const now = opts.now ?? new Date();
    const claim = await claimRow(id, now);
    if (claim)
      await deliverClaimed(id, claim, {
        channel: opts.channel,
        webPushChannel: resolveWebPushChannel(opts.webPushChannel),
        now,
      });
  } catch {
    // swallow — the row stays claimable/retryable by the cron.
  }
}

/** Uses the injected Web Push channel when given (tests), else resolves from env. */
function resolveWebPushChannel(
  channel: WebPushChannel | null | undefined,
): WebPushChannel | null {
  return channel === undefined ? webPushChannelFromEnv() : channel;
}

/**
 * Best-effort dispatch for the grant path (ADR 0037): delivers the just-enqueued row
 * without blocking the response and never throws. On Vercel a fire-and-forget promise
 * is frozen the moment the response returns, so the push is scheduled with `after()`,
 * which keeps the serverless invocation alive until it finishes — this is what makes
 * "te dieron puntos" reach the phone at the moment of the sale. Outside a request scope
 * (the cron worker, unit tests) `after()` throws and we fall back to an inline dispatch.
 */
export function dispatchGranted(pushQueueId: string | null | undefined): void {
  if (!pushQueueId) return;
  const run = () =>
    dispatchInline(pushQueueId, { channel: pushChannelFromEnv() }).catch(
      () => {},
    );
  try {
    after(run);
  } catch {
    void run();
  }
}

/** Claims and delivers a specific row for the cron worker (shares the inline path). */
export async function deliverRow(
  id: string,
  opts: {
    channel: PushChannel;
    webPushChannel?: WebPushChannel | null;
    now: Date;
  },
): Promise<boolean> {
  const claim = await claimRow(id, opts.now);
  if (!claim) return false;
  await deliverClaimed(id, claim, {
    channel: opts.channel,
    webPushChannel: resolveWebPushChannel(opts.webPushChannel),
    now: opts.now,
  });
  return true;
}

// The rotation mechanism (spec 0032 invokes it) lives in `./rotate`; re-exported here
// so existing importers keep using `./push`. Split out to stay under the file-size hook.
export { rotatePassCredentials } from "./rotate";
