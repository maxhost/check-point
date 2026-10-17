import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction, type DbTransaction } from "@mi-pasaporte/db";
import { moduleEvents, moduleEventDeliveries } from "@mi-pasaporte/db/schema";
import { SERVER_MODULES } from "../../modules/server-registry";
import { decodeSaleClosedEvent } from "./decode";
export type RetryOptions = {
  businessId?: string;
  locationId?: string;
  eventIds?: string[];
  budgetMs?: number;
  batchSize?: number;
  force?: boolean;
};
function connectionBudget(deadline: number) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("Retry budget exhausted");
  return [1, 50, 100, 250, 500, 1000].filter((n) => n <= remaining).at(-1) ?? 1;
}
/** Configure both local limits in one round trip; the transaction still has the absolute retry deadline. */
async function setRetryTimeouts(tx: DbTransaction, deadline: number) {
  const remaining = Math.max(1, deadline - Date.now());
  await tx.execute(sql`select
    pg_catalog.set_config('transaction_timeout', ${String(remaining)}, true),
    pg_catalog.set_config('statement_timeout', ${String(Math.max(1, remaining - 1))}, true)
  `);
}
export async function retryModuleEvents(options: RetryOptions = {}) {
  const result = { claimed: 0, applied: 0, pending: 0, failed: 0 };
  const deadline = Date.now() + Math.min(options.budgetMs ?? 20000, 20000);
  const batch = Math.min(options.batchSize ?? 50, 50);
  if (options.eventIds?.length === 0) return result;
  const attempted: string[] = [];
  for (let n = 0; n < batch && Date.now() < deadline; n++) {
    const token = randomUUID();
    const claimed = await withDbTransaction(
      async (tx) => {
        if (Date.now() >= deadline) throw new Error("Retry budget exhausted");
        await setRetryTimeouts(tx, deadline);
        return tx.execute(sql`with candidate as (
   select d.id from core.module_event_delivery d join core.module_event e on e.id=d.event_id
   where ((d.state='pending' and (${options.force === true} or d.next_attempt_at<=now())) or (d.state='processing' and d.claim_until<=now()))
   ${options.businessId ? sql`and e.business_id=${options.businessId}::uuid` : sql``}
   ${options.locationId ? sql`and e.location_id=${options.locationId}::uuid` : sql``}
   ${
     options.eventIds
       ? sql`and e.id = any(${sql.param(options.eventIds)}::uuid[])`
       : sql``
   }
   ${
     attempted.length
       ? sql`and d.id not in (${sql.join(
           attempted.map((id) => sql`${id}::uuid`),
           sql`,`,
         )})`
       : sql``
   }
   order by d.next_attempt_at,d.id for update of d skip locked limit 1
  ) update core.module_event_delivery d set state='processing',claim_token=${token}::uuid,claim_until=now()+interval '30 seconds',attempts=d.attempts+1
    from candidate c where d.id=c.id returning d.id,d.event_id,d.subscriber_id,d.attempts`);
      },
      { connectionTimeoutMs: connectionBudget(deadline) },
    );
    const delivery = claimed.rows[0] as unknown as
      | {
          id: string;
          event_id: string;
          subscriber_id: string;
          attempts: number;
        }
      | undefined;
    if (!delivery) break;
    attempted.push(delivery.id);
    result.claimed++;
    try {
      if (Date.now() >= deadline) throw new Error("Retry budget exhausted");
      await withDbTransaction(
        async (tx) => {
          if (Date.now() >= deadline) throw new Error("Retry budget exhausted");
          await setRetryTimeouts(tx, deadline);
          await applyClaimedDelivery(tx, delivery, token);
        },
        { connectionTimeoutMs: connectionBudget(deadline) },
      );
      result.applied++;
    } catch {
      // Never return provider messages, payload or stacks through diagnostics.
      const minutes = [1, 5, 15, 30][Math.min(delivery.attempts - 1, 3)];
      if (Date.now() < deadline)
        await withDbTransaction(
          async (tx) => {
            await setRetryTimeouts(tx, deadline);
            await tx
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
          },
          { connectionTimeoutMs: connectionBudget(deadline) },
        ).catch(() => {}); // Abandoned durable claim is recovered on its deadline.
      result.failed++;
      result.pending++;
    }
  }
  // pending means unresolved deliveries in this attempted batch. The complete local
  // backlog is exposed by pendingSummary; empty cron avoids a second DB query.
  result.pending = result.claimed - result.applied;
  return result;
}
export async function pendingSummary(businessId: string, locationId: string) {
  const rows = await getDb().execute(
    sql`select count(*)::int as count,count(*) filter(where d.diagnostic is not null)::int as failed from core.module_event_delivery d join core.module_event e on e.id=d.event_id where e.business_id=${businessId}::uuid and e.location_id=${locationId}::uuid and d.state in ('pending','processing')`,
  );
  return rows.rows[0] as unknown as { count: number; failed: number };
}

export async function applyClaimedDelivery(
  tx: DbTransaction,
  delivery: { id: string; event_id: string; subscriber_id: string },
  token: string,
) {
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
    payload: decodeSaleClosedEvent(event.payload),
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
}
