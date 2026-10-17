import { SERVER_MODULES } from "../server-registry";
import { and, eq, sql, inArray } from "drizzle-orm";
import { type DbTransaction, getDb } from "@mi-pasaporte/db";
import { moduleEvents, moduleEventDeliveries } from "@mi-pasaporte/db/schema";
import { ModuleError } from "../errors";
/** Explicit committed IDs, never a timestamp heuristic. */
export const stockSubscribers = () =>
  Object.entries(SERVER_MODULES)
    .filter(
      ([id, server]) =>
        id === "stock" ||
        server.eventSubscriptions?.some(
          (s) =>
            s.eventType === "sale.closed" &&
            s.requiredModules.includes("stock"),
        ),
    )
    .map(([id]) => id);
export async function captureCountCut(businessId: string, locationId: string) {
  const rows = await getDb()
    .select({ id: moduleEvents.id })
    .from(moduleEvents)
    .where(
      and(
        eq(moduleEvents.businessId, businessId),
        eq(moduleEvents.eventType, "sale.closed"),
        eq(moduleEvents.locationId, locationId),
      ),
    )
    .orderBy(moduleEvents.id);
  return rows.map((r) => r.id);
}
/** SERIALIZABLE predicate read also orders a close committing during final adjustment. */
export async function validateCountCut(
  tx: DbTransaction,
  businessId: string,
  locationId: string,
  cut: string[],
) {
  const current = await tx
    .select({ id: moduleEvents.id })
    .from(moduleEvents)
    .where(
      and(
        eq(moduleEvents.businessId, businessId),
        eq(moduleEvents.eventType, "sale.closed"),
        eq(moduleEvents.locationId, locationId),
      ),
    )
    .orderBy(moduleEvents.id);
  if (current.length !== cut.length || current.some((r, i) => r.id !== cut[i]))
    throw new ModuleError(
      409,
      "count_changed",
      "Hubo una venta mientras contabas. Actualiza e intenta otra vez.",
    );
  const subscribers = stockSubscribers();
  const [pending] = await tx
    .select({ id: moduleEventDeliveries.id })
    .from(moduleEventDeliveries)
    .innerJoin(moduleEvents, eq(moduleEvents.id, moduleEventDeliveries.eventId))
    .where(
      and(
        eq(moduleEvents.businessId, businessId),
        eq(moduleEvents.eventType, "sale.closed"),
        eq(moduleEvents.locationId, locationId),
        inArray(moduleEventDeliveries.subscriberId, subscribers),
        sql`${moduleEventDeliveries.state} in ('pending','processing')`,
      ),
    )
    .limit(1);
  if (pending)
    throw new ModuleError(
      409,
      "consumption_pending",
      "Hay consumos pendientes. Intenta el conteo otra vez cuando se apliquen.",
    );
}
