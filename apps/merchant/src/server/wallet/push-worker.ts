import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { getDb } from "../db";
import { consumerAccounts, walletPushQueue } from "../schema";
import { type PushChannel } from "./push-channel";
import { type WebPushChannel } from "../push/webpush-channel";
import {
  COOLDOWN_MS,
  type QueueRow,
  deliverRow,
  planConsumerDrain,
} from "./push";

export type WorkerSummary = {
  sent: number;
  rescheduled: number;
  skipped: number;
};

/**
 * Reads all sendable rows grouped by consumer: fresh `pending` rows AND stranded
 * `sending` rows whose reclaim deadline has passed (`not_before ≤ now`). A row claimed
 * this instant has `not_before = now + STALE_CLAIM_MS` (in the future), so it is NOT
 * re-picked while its runner is still in-flight; only a crashed claim falls due again.
 *
 * `consumerIds`, when given, restricts the drain to those consumers. Production leaves
 * it undefined (drain everyone); integration tests pass their own seeded ids so a run
 * is deterministic and never touches rows another parallel test file seeded.
 */
async function selectDue(
  now: Date,
  consumerIds?: string[],
): Promise<Map<string, QueueRow[]>> {
  const scope =
    consumerIds && consumerIds.length > 0
      ? inArray(walletPushQueue.consumerId, consumerIds)
      : undefined;
  const rows = await getDb()
    .select({
      id: walletPushQueue.id,
      consumerId: walletPushQueue.consumerId,
      klass: walletPushQueue.class,
      notBefore: walletPushQueue.notBefore,
      createdAt: walletPushQueue.createdAt,
    })
    .from(walletPushQueue)
    .where(
      and(
        inArray(walletPushQueue.status, ["pending", "sending"]),
        lte(walletPushQueue.notBefore, now),
        scope,
      ),
    )
    .orderBy(asc(walletPushQueue.consumerId), asc(walletPushQueue.createdAt));

  const byConsumer = new Map<string, QueueRow[]>();
  for (const r of rows) {
    const row: QueueRow = {
      id: r.id,
      consumerId: r.consumerId,
      klass: r.klass === "campaign" ? "campaign" : "transactional",
      notBefore: r.notBefore,
      createdAt: r.createdAt,
    };
    const list = byConsumer.get(r.consumerId) ?? [];
    list.push(row);
    byConsumer.set(r.consumerId, list);
  }
  return byConsumer;
}

async function lastPushAt(consumerId: string): Promise<Date | null> {
  const [row] = await getDb()
    .select({ lastPushAt: consumerAccounts.lastPushAt })
    .from(consumerAccounts)
    .where(eq(consumerAccounts.id, consumerId))
    .limit(1);
  return row?.lastPushAt ?? null;
}

/**
 * Cron drain (ADR 0037 §3). Per consumer: sends `transactional` immediately (preempts),
 * defers `campaign` behind the cooldown. The clock is injectable so integration tests
 * drive it deterministically. Each send goes through {@link deliverRow}'s race-safe
 * claim, so it never double-sends against an inline dispatch.
 */
export async function runPushWorker(opts: {
  channel: PushChannel;
  /** Web Push transport; omit to resolve from env, null to disable (spec 0037). */
  webPushChannel?: WebPushChannel | null;
  now?: Date;
  /** Test scope: restrict the drain to these consumers (prod passes none = all). */
  consumerIds?: string[];
}): Promise<WorkerSummary> {
  const now = opts.now ?? new Date();
  const byConsumer = await selectDue(now, opts.consumerIds);
  const summary: WorkerSummary = { sent: 0, rescheduled: 0, skipped: 0 };

  for (const [consumerId, rows] of byConsumer) {
    const last = await lastPushAt(consumerId);
    const actions = planConsumerDrain(rows, last, now, COOLDOWN_MS);
    for (const action of actions) {
      if (action.kind === "reschedule") {
        await getDb()
          .update(walletPushQueue)
          .set({ notBefore: action.notBefore })
          .where(eq(walletPushQueue.id, action.row.id));
        summary.rescheduled += 1;
        continue;
      }
      const delivered = await deliverRow(action.row.id, {
        channel: opts.channel,
        webPushChannel: opts.webPushChannel,
        now,
      });
      if (delivered) summary.sent += 1;
      else summary.skipped += 1;
    }
  }
  return summary;
}
