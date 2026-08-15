import { after } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { consumerAccounts, walletPasses, walletPushDevices } from "../schema";
import { generateOpaqueToken } from "../consumer/core";
import {
  ApnsGoneError,
  type PushChannel,
  type PushMessage,
  passTypeIdFromEnv,
  pushChannelFromEnv,
} from "./push-channel";

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

/** The pluralized transactional notice body, e.g. `+1 sello` / `+3 puntos`. */
export function buildTransactionalBody(
  units: number,
  kind: "points" | "stamps",
): string {
  const noun =
    kind === "points"
      ? units === 1
        ? "punto"
        : "puntos"
      : units === 1
        ? "sello"
        : "sellos";
  return `+${units} ${noun}`;
}

// The pure drain planner lives in `push-plan.ts` (kept DB-free + under the file-size
// budget); re-exported here so existing importers keep using `./push`.
export {
  type QueueRow,
  type DrainAction,
  planConsumerDrain,
} from "./push-plan";

type Claim = { consumerId: string; title: string; body: string };

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
    RETURNING consumer_id, title, body`);
  const [row] = rowsOf(res);
  if (!row) return null;
  return {
    consumerId: String(row.consumer_id),
    title: String(row.title),
    body: String(row.body),
  };
}

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

async function sendApple(
  consumerId: string,
  message: PushMessage,
  channel: PushChannel,
): Promise<void> {
  void message; // Apple push is empty; the pulled pass carries the new field.
  const targets = await appleTargets(consumerId);
  const passTypeId = passTypeIdFromEnv();
  for (const t of targets) {
    try {
      await channel.sendApple({ pushToken: t.pushToken, passTypeId });
    } catch (error) {
      // A dead token (410) is pruned; any other per-device error is swallowed so
      // one bad device never aborts the rest (spec 0033).
      if (error instanceof ApnsGoneError) {
        await getDb()
          .delete(walletPushDevices)
          .where(eq(walletPushDevices.id, t.id));
      }
    }
  }
}

async function sendGoogle(
  consumerId: string,
  message: PushMessage,
  channel: PushChannel,
): Promise<void> {
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
  if (pass) await channel.sendGoogle(pass.serialNumber, message);
}

/** Materializes the notice on the consumer and pushes it on both providers, then
 * closes the row (`sent`) and preempts pending campaigns — or backs off on failure. */
async function deliverClaimed(
  id: string,
  claim: Claim,
  opts: { channel: PushChannel; now: Date },
): Promise<void> {
  const { channel, now } = opts;
  const message: PushMessage = { header: claim.title, body: claim.body };
  const latest = claim.title ? `${claim.title}: ${claim.body}` : claim.body;
  try {
    await getDb()
      .update(consumerAccounts)
      .set({ latestMessage: latest, messageUpdatedAt: now, updatedAt: now })
      .where(eq(consumerAccounts.id, claim.consumerId));
    await sendApple(claim.consumerId, message, channel);
    await sendGoogle(claim.consumerId, message, channel);
    await getDb().execute(sql`
      UPDATE consumer.wallet_push_queue
      SET status = 'sent', sent_at = ${now.toISOString()}
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
  opts: { channel: PushChannel; now?: Date },
): Promise<void> {
  try {
    const now = opts.now ?? new Date();
    const claim = await claimRow(id, now);
    if (claim)
      await deliverClaimed(id, claim, {
        channel: opts.channel,
        now,
      });
  } catch {
    // swallow — the row stays claimable/retryable by the cron.
  }
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
  opts: { channel: PushChannel; now: Date },
): Promise<boolean> {
  const claim = await claimRow(id, opts.now);
  if (!claim) return false;
  await deliverClaimed(id, claim, opts);
  return true;
}

/**
 * Rotates the pass credentials of one consumer (spec 0032 invokes this on recovery):
 * in a single statement rotates BOTH `qr_token` and `web_view_token`, deletes the
 * consumer's push devices (old devices stop receiving push), and enqueues a
 * `transactional` re-emission push (forces a pull of the pass with the new token).
 * The old `qr_token` no longer resolves in the counter scan (0030).
 */
export async function rotatePassCredentials(
  consumerId: string,
): Promise<{ qrToken: string; webViewToken: string }> {
  const qrToken = generateOpaqueToken();
  const webViewToken = generateOpaqueToken();
  await getDb().execute(sql`
    WITH rotated AS (
      UPDATE consumer.consumer_account
      SET qr_token = ${qrToken}, web_view_token = ${webViewToken}, updated_at = now()
      WHERE id = ${consumerId}
      RETURNING id
    ),
    wiped AS (
      DELETE FROM consumer.wallet_push_device
      USING consumer.wallet_pass
      WHERE consumer.wallet_push_device.wallet_pass_id = consumer.wallet_pass.id
        AND consumer.wallet_pass.consumer_id = ${consumerId}
    )
    INSERT INTO consumer.wallet_push_queue
      (consumer_id, class, title, body, status, not_before)
    SELECT id, 'transactional', 'Mi Pasaporte',
           'Actualizá tu pase', 'pending', now()
    FROM rotated`);
  return { qrToken, webViewToken };
}
