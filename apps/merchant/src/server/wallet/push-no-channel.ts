import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";

/**
 * Closes a claimed notice that has NO channel (spec 0139 / ADR 0116 §2): a `transactional`
 * or `campaign` of a consumer without a Web Push subscription has nowhere to ring (ADR 0115
 * §2 forbids the wallet for them). It closes `suppressed` with `last_error = 'no_channel'`
 * and WITHOUT `sent_at`: the 24 h budget (`loadBudget`) counts `status = 'sent'` rows, and
 * something that never rang is not a notification — counting it would take the slot of
 * the wallet reminder. Nothing is written on the account (no `latest_message`, no
 * `last_push_at`, no preemption): the caller returns right after this. The notice still
 * exists in the queue, and that is what the consumer's Actividad lists (ADR 0116 §1).
 * Split out of `push.ts` to keep it under the file-size budget.
 */
export async function closeNoChannel(id: string): Promise<void> {
  await getDb().execute(sql`
    UPDATE consumer.wallet_push_queue
    SET status = 'suppressed', last_error = 'no_channel'
    WHERE id = ${id}`);
}
