import { and, eq, sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import {
  moduleEvents,
  moduleEventDeliveries,
  moduleResourceVersions,
} from "@mi-pasaporte/db/schema";
import { SERVER_MODULES } from "../../modules/server-registry";
import type { SaleClosedEvent, ResourceVersion } from "./types";
export async function setResourceVersion(
  tx: DbTransaction,
  args: {
    businessId: string;
    resourceType: string;
    resourceId: string;
    providerId: string;
    slot: string;
    versionId: string;
  },
) {
  await tx
    .insert(moduleResourceVersions)
    .values(args)
    .onConflictDoUpdate({
      target: [
        moduleResourceVersions.businessId,
        moduleResourceVersions.resourceType,
        moduleResourceVersions.resourceId,
        moduleResourceVersions.providerId,
        moduleResourceVersions.slot,
      ],
      set: { versionId: args.versionId, updatedAt: new Date() },
    });
}
/** Only core pointers/activation are read here; no module handler is called. */
export async function publishSaleClosed(
  tx: DbTransaction,
  args: {
    businessId: string;
    sourceOrderId: string;
    locationId: string;
    closedAt: Date;
    userId: string;
    lines: {
      sourceLineId: string;
      productId: string | null;
      quantity: number;
    }[];
  },
) {
  if (process.env.MODULE_EVENTS_ENABLED !== "true") return null;
  if (
    args.lines.some(
      (l) => !Number.isSafeInteger(l.quantity) || l.quantity <= 0,
    ) ||
    new Set(args.lines.map((l) => l.sourceLineId)).size !== args.lines.length
  )
    throw new Error("Invalid event lines");
  const [existing] = await tx
    .select({ id: moduleEvents.id })
    .from(moduleEvents)
    .where(
      and(
        eq(moduleEvents.businessId, args.businessId),
        eq(moduleEvents.eventType, "sale.closed"),
        eq(moduleEvents.sourceId, args.sourceOrderId),
      ),
    )
    .limit(1);
  if (existing) {
    const [event] = await tx
      .select({ payload: moduleEvents.payload })
      .from(moduleEvents)
      .where(eq(moduleEvents.id, existing.id));
    return {
      eventId: existing.id,
      closedAt: new Date((event.payload as SaleClosedEvent).closedAt),
    };
  }
  // One statement = one committed visibility point for all pointers and activation.
  const capture = await tx.execute(sql`select clock_timestamp() as captured_at,
 (select coalesce(jsonb_agg(jsonb_build_object('resourceId',resource_id,'providerId',provider_id,'slot',slot,'versionId',version_id)),'[]'::jsonb) from core.module_resource_version where business_id=${args.businessId}::uuid and resource_type='product' and resource_id in (${
   args.lines.some((l) => l.productId)
     ? sql.join(
         args.lines.flatMap((l) =>
           l.productId ? [sql`${l.productId}::uuid`] : [],
         ),
         sql`,`,
       )
     : sql`null::uuid`
 })) as versions,
 (select coalesce(jsonb_agg(module_id),'[]'::jsonb) from core.business_module where business_id=${args.businessId}::uuid and enabled=true) as enabled`);
  const row = capture.rows[0] as unknown as {
    captured_at: Date | string;
    versions: (ResourceVersion & { resourceId: string })[];
    enabled: string[];
  };
  const payload: SaleClosedEvent = {
    eventVersion: 1,
    sourceOrderId: args.sourceOrderId,
    locationId: args.locationId,
    closedAt: new Date(row.captured_at).toISOString(),
    userId: args.userId,
    lines: args.lines.map((l) => ({
      ...l,
      resourceVersions: row.versions
        .filter((v) => v.resourceId === l.productId)
        .map(({ providerId, slot, versionId }) => ({
          providerId,
          slot,
          versionId,
        })),
    })),
  };
  const [event] = await tx
    .insert(moduleEvents)
    .values({
      businessId: args.businessId,
      eventType: "sale.closed",
      eventVersion: 1,
      sourceId: args.sourceOrderId,
      locationId: args.locationId,
      payload,
    })
    .returning({ id: moduleEvents.id });
  for (const [subscriberId, server] of Object.entries(SERVER_MODULES))
    for (const subscription of server.eventSubscriptions ?? []) {
      if (subscription.eventType !== "sale.closed") continue;
      const eligible = [subscriberId, ...subscription.requiredModules].every(
        (id) => row.enabled.includes(id),
      );
      await tx
        .insert(moduleEventDeliveries)
        .values({
          eventId: event.id,
          subscriberId,
          state: eligible ? "pending" : "skipped",
          terminalReason: eligible ? null : "modules_disabled",
        });
    }
  return { eventId: event.id, closedAt: new Date(payload.closedAt) };
}
