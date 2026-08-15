import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { generateOpaqueToken } from "../consumer/core";

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
