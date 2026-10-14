import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { moduleEvents, moduleEventDeliveries } from "@mi-pasaporte/db/schema";
import { SERVER_MODULES } from "../../modules/server-registry";
import type { SaleClosedEvent } from "./types";
export type RetryOptions = {
  businessId?: string;
  locationId?: string;
  eventIds?: string[];
  budgetMs?: number;
  batchSize?: number;
  force?: boolean;
};
export async function retryModuleEvents(options: RetryOptions = {}) {
  const result = { claimed: 0, applied: 0, pending: 0, failed: 0 };
  const deadline = Date.now() + Math.min(options.budgetMs ?? 20000, 20000);
  const batch = Math.min(options.batchSize ?? 50, 50);
  if (options.eventIds?.length === 0) return result;
  for (let n = 0; n < batch && Date.now() < deadline; n++) {
    const token = randomUUID();
    const claimed = await getDb().execute(sql`with candidate as (
   select d.id from core.module_event_delivery d join core.module_event e on e.id=d.event_id
   where ((d.state='pending' and (${options.force === true} or d.next_attempt_at<=now())) or (d.state='processing' and d.claim_until<=now()))
   ${options.businessId ? sql`and e.business_id=${options.businessId}::uuid` : sql``}
   ${options.locationId ? sql`and e.location_id=${options.locationId}::uuid` : sql``}
   ${
     options.eventIds
       ? sql`and e.id in (${sql.join(
           options.eventIds.map((id) => sql`${id}::uuid`),
           sql`,`,
         )})`
       : sql``
   }
   order by d.next_attempt_at,d.id for update of d skip locked limit 1
  ) update core.module_event_delivery d set state='processing',claim_token=${token}::uuid,claim_until=now()+interval '30 seconds',attempts=d.attempts+1
    from candidate c where d.id=c.id returning d.id,d.event_id,d.subscriber_id,d.attempts`);
    const delivery = claimed.rows[0] as unknown as
      | {
          id: string;
          event_id: string;
          subscriber_id: string;
          attempts: number;
        }
      | undefined;
    if (!delivery) break;
    result.claimed++;
    try {
      await withDbTransaction(async (tx) => {
        await tx.execute(
          sql`set local statement_timeout = ${sql.raw(String(Math.max(1, deadline - Date.now())))}`,
        );
        const [locked] = await tx
          .select()
          .from(moduleEventDeliveries)
          .where(
            and(
              eq(moduleEventDeliveries.id, delivery.id),
              eq(moduleEventDeliveries.claimToken, token),
              eq(moduleEventDeliveries.state, "processing"),
            ),
          )
          .for("update");
        if (!locked) throw new Error("Claim lost");
        const [event] = await tx
          .select()
          .from(moduleEvents)
          .where(eq(moduleEvents.id, delivery.event_id));
        const subscription = SERVER_MODULES[
          delivery.subscriber_id
        ]?.eventSubscriptions?.find((s) => s.eventType === event.eventType);
        if (!subscription) throw new Error("Subscriber unavailable");
        await subscription.handler(tx, {
          id: event.id,
          businessId: event.businessId,
          payload: event.payload as SaleClosedEvent,
        });
        await tx
          .update(moduleEventDeliveries)
          .set({
            state: "applied",
            appliedAt: new Date(),
            claimToken: null,
            claimUntil: null,
            diagnostic: null,
          })
          .where(
            and(
              eq(moduleEventDeliveries.id, delivery.id),
              eq(moduleEventDeliveries.claimToken, token),
            ),
          );
      });
      result.applied++;
    } catch {
      // Never return provider messages, payload or stacks through diagnostics.
      const minutes = [1, 5, 15, 30][Math.min(delivery.attempts - 1, 3)];
      await getDb()
        .update(moduleEventDeliveries)
        .set({
          state: "pending",
          nextAttemptAt: new Date(Date.now() + minutes * 60000),
          claimToken: null,
          claimUntil: null,
          diagnostic: "application_failed",
        })
        .where(
          and(
            eq(moduleEventDeliveries.id, delivery.id),
            eq(moduleEventDeliveries.claimToken, token),
          ),
        );
      result.failed++;
      result.pending++;
    }
  }
  return result;
}
export async function pendingSummary(businessId: string, locationId: string) {
  const rows = await getDb().execute(
    sql`select count(*)::int as count,count(*) filter(where d.diagnostic is not null)::int as failed from core.module_event_delivery d join core.module_event e on e.id=d.event_id where e.business_id=${businessId}::uuid and e.location_id=${locationId}::uuid and d.state in ('pending','processing')`,
  );
  return rows.rows[0] as unknown as { count: number; failed: number };
}
