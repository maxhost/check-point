import { and, eq } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import {
  businessModules,
  moduleEvents,
  moduleEventDeliveries,
} from "@mi-pasaporte/db/schema";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { SERVER_MODULES } from "../../modules/server-registry";

/** Mandatory transactional log append. Producers validate their complete versioned payload. */
export async function appendModuleEvent<T extends { eventVersion: number }>(
  tx: DbTransaction,
  args: {
    businessId: string;
    eventType: string;
    eventVersion: number;
    sourceId: string;
    locationId: string | null;
    payload: T;
    enabledModuleIds?: readonly string[];
  },
) {
  if (
    !isUuid(args.businessId) ||
    !isUuid(args.sourceId) ||
    (args.locationId !== null && !isUuid(args.locationId)) ||
    !/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(args.eventType) ||
    !Number.isSafeInteger(args.eventVersion) ||
    args.eventVersion < 1 ||
    args.payload.eventVersion !== args.eventVersion
  )
    throw new Error("Invalid module event envelope");
  const [event] = await tx
    .insert(moduleEvents)
    .values({
      businessId: args.businessId,
      eventType: args.eventType,
      eventVersion: args.eventVersion,
      sourceId: args.sourceId,
      locationId: args.locationId,
      payload: args.payload,
    })
    .returning({ id: moduleEvents.id });
  const subscriptions = Object.entries(SERVER_MODULES).flatMap(
    ([subscriberId, server]) =>
      (server.eventSubscriptions ?? [])
        .filter((s) => s.eventType === args.eventType)
        .map((subscription) => ({ subscriberId, subscription })),
  );
  if (!subscriptions.length) return { eventId: event.id };
  const enabled =
    args.enabledModuleIds ??
    (
      await tx
        .select({ moduleId: businessModules.moduleId })
        .from(businessModules)
        .where(
          and(
            eq(businessModules.businessId, args.businessId),
            eq(businessModules.enabled, true),
          ),
        )
    ).map((r) => r.moduleId);
  for (const { subscriberId, subscription } of subscriptions) {
    const eligible = [subscriberId, ...subscription.requiredModules].every(
      (id) => enabled.includes(id),
    );
    await tx.insert(moduleEventDeliveries).values({
      eventId: event.id,
      subscriberId,
      state: eligible ? "pending" : "skipped",
      terminalReason: eligible ? null : "modules_disabled",
    });
  }
  return { eventId: event.id };
}
