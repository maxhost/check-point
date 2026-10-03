import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { walletPushQueue } from "@mi-pasaporte/db/schema";
import { upsertSubscription } from "@mi-pasaporte/domain/server/push/subscriptions";

/** Shared helpers for the wallet-push Neon integration suites (kept out of the test
 * files so each stays under the file-size budget). */

export type EnqueueOpts = {
  title?: string;
  body?: string;
  notBefore?: Date;
  status?: "pending" | "sending" | "sent" | "failed";
};

/** Inserts one `wallet_push_queue` row directly (bypassing the grant) and returns its id. */
export async function enqueue(
  consumerId: string,
  klass: "transactional" | "campaign" | "pass_refresh" | "reminder",
  opts: EnqueueOpts = {},
): Promise<string> {
  const [row] = await getDb()
    .insert(walletPushQueue)
    .values({
      consumerId,
      class: klass,
      title: opts.title ?? "La Gringa",
      body: opts.body ?? "+1 sello",
      status: opts.status ?? "pending",
      notBefore: opts.notBefore ?? new Date(0),
    })
    .returning({ id: walletPushQueue.id });
  return row.id;
}

/** Reads a queue row by id (full row, so tests can assert `status`/`lastError`/etc.). */
export async function queueRow(id: string) {
  const [row] = await getDb()
    .select()
    .from(walletPushQueue)
    .where(eq(walletPushQueue.id, id));
  return row;
}

/** Gives the consumer one Web Push subscription (the PWA's notifications) and returns its
 * endpoint. Since spec 0139 a `transactional`/`campaign` only has a channel with one. The
 * row cascades with the consumer account. */
export async function subscribe(consumerId: string): Promise<string> {
  const endpoint = `https://push.test/${randomUUID()}`;
  await upsertSubscription({
    consumerId,
    endpoint,
    p256dhKey: "p256dh",
    authKey: "auth",
    userAgent: "UA",
  });
  return endpoint;
}
