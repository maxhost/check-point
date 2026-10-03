import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { walletPushQueue } from "@mi-pasaporte/db/schema";

/** How many notices Actividad gets at most (spec 0139 §3). */
export const NOTICES_LIMIT = 30;

/** One counter notice as the consumer sees it (contract of spec 0139 §3). */
export type NoticeDTO = {
  id: string;
  /** The business name (or «CheckPass Club»), as it was queued. */
  title: string;
  /** «+1 sello», «Canjeaste …»… — already written. */
  body: string;
  /** ISO 8601. */
  createdAt: string;
};

/**
 * THE CONSUMER'S COUNTER NOTICES for Actividad (spec 0139 §3 / ADR 0116 §1): every
 * `transactional` row of `consumer.wallet_push_queue` of THIS consumer, whatever its
 * `status` — the notice exists whether or not it rang (no subscription → `no_channel`, the
 * budget → `budget_24h`). Never `campaign` (it shows through its coupon), `reminder` or
 * `pass_refresh`. Newest first (`created_at desc, id desc`), at most {@link NOTICES_LIMIT}.
 *
 * `consumerId` comes ONLY from the session (`resolveSession`): it is the isolation. The DTO
 * is an allow-list and so is the query: it reads exactly the columns the migration 0062
 * grants to `checkpass_consumer` (`id, consumer_id, class, title, body, created_at`) —
 * reading `status`, `last_error` or `sent_at` would be a 42501 as the consumer's role.
 */
export async function listConsumerNotices(
  consumerId: string,
): Promise<NoticeDTO[]> {
  const rows = await getDb()
    .select({
      id: walletPushQueue.id,
      title: walletPushQueue.title,
      body: walletPushQueue.body,
      createdAt: walletPushQueue.createdAt,
    })
    .from(walletPushQueue)
    .where(
      and(
        eq(walletPushQueue.consumerId, consumerId),
        eq(walletPushQueue.class, "transactional"),
      ),
    )
    .orderBy(desc(walletPushQueue.createdAt), desc(walletPushQueue.id))
    .limit(NOTICES_LIMIT);
  return rows.map(toNotice);
}

/** The allow-list: a new column of the row never reaches the browser by accident. */
function toNotice(row: {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
}): NoticeDTO {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
