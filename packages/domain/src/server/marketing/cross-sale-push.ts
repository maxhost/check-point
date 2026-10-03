import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { rowsOf } from "./cross-store";

/**
 * THE WORKER'S GATE OF THE «REGALO MISTERIO» (spec 0143 §5). A `campaign` queue row with a
 * `core.cross_decision` behind it (`queue_id`) is the cross sale's push: SEND, with the
 * decision's id as the click id — no window and no cancellations (owner, 2026-10-03: «No,
 * sale con la compra»; the coupon is already the consumer's). `null` when there is no
 * decision behind the row, and `gateCampaignPush` (`push-delivery.ts`) goes on asking.
 */
export async function gateCrossSalePush(
  queueId: string,
): Promise<{ kind: "send"; clickId: string } | null> {
  const [row] = rowsOf<{ id: string }>(
    await getDb().execute(sql`
      select d.id from core.cross_decision d
      where d.queue_id = ${queueId}
      limit 1`),
  );
  return row ? { kind: "send", clickId: String(row.id) } : null;
}

/** The click of the «regalo misterio»: the first one wins; an unknown id changes nothing. */
export async function recordCrossSaleClick(decisionId: string): Promise<void> {
  await getDb().execute(sql`
    update core.cross_decision
    set clicked_at = coalesce(clicked_at, now())
    where id = ${decisionId}`);
}
