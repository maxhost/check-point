import { withDbTransaction } from "@mi-pasaporte/db";
import { moduleEvents, moduleEventDeliveries } from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { SaleClosedEvent } from "../../../server/module-events/types";
import { capturedConsumption } from "./model/captured";
import {
  readConsumptionCost,
  type ConsumptionDelivery,
  type ExpectedCostLine,
} from "../../stock/server/consumption-cost";

export type SaleCostContext = {
  lines: { sourceLineId: string; productId: string | null }[];
};

/** Internal server API; its future caller authenticates/authorizes the business.
 * No current recipe, POS table, module toggle or current price participates in this read.
 */
export async function readSaleConsumptionCost(args: {
  businessId: string;
  locationId: string;
  sourceOrderId: string;
  saleContext?: SaleCostContext;
}) {
  return withDbTransaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );
    const [event] = await tx
      .select()
      .from(moduleEvents)
      .where(
        and(
          eq(moduleEvents.businessId, args.businessId),
          eq(moduleEvents.locationId, args.locationId),
          eq(moduleEvents.sourceId, args.sourceOrderId),
          eq(moduleEvents.eventType, "sale.closed"),
        ),
      );
    let expectedLines: ExpectedCostLine[] = (args.saleContext?.lines ?? []).map(
      (line) => ({
        ...line,
        recipe: "unknown",
        consumptions: [],
      }),
    );
    let delivery: ConsumptionDelivery = { state: "unknown" };
    if (event) {
      const [storedDelivery] = await tx
        .select()
        .from(moduleEventDeliveries)
        .where(
          and(
            eq(moduleEventDeliveries.eventId, event.id),
            eq(moduleEventDeliveries.subscriberId, "recipes"),
          ),
        );
      if (storedDelivery)
        delivery = {
          state: storedDelivery.state as ConsumptionDelivery["state"],
          terminalReason: storedDelivery.terminalReason,
        };
      const payload = event.payload as SaleClosedEvent;
      try {
        const captured = await capturedConsumption(
          tx,
          args.businessId,
          payload,
        );
        expectedLines = captured.expectedLines.map((line) =>
          delivery.state === "skipped" &&
          delivery.terminalReason === "modules_disabled"
            ? {
                ...line,
                recipe: "absent" as const,
                consumptions: [],
                roundingOmissions: false,
              }
            : line,
        );
      } catch {
        expectedLines = payload.lines.map((line) => ({
          sourceLineId: line.sourceLineId,
          productId: line.productId,
          recipe:
            delivery.state === "skipped" &&
            delivery.terminalReason === "modules_disabled"
              ? "absent"
              : "unknown",
          consumptions: [],
        }));
      }
    }
    return readConsumptionCost(tx, { ...args, expectedLines, delivery });
  });
}
