import { purchaseSubscription } from "./purchase-cost-event";
import { publishConsumptionApplied } from "./consumption-event";
import {
  defineEventSubscription,
  type EventSubscription,
} from "../../../server/module-events/types";
import { applyConsumption } from "../../stock/consumption";
import { capturedMeasuredConsumption } from "./model/captured-measured";
import { decodeMeasuredSaleClosedEvent } from "../../../server/module-events/decode";
import { persistProvenance } from "./model/provenance";

/** Both captured formats are immutable; the transaction also owns delivery acknowledgment. */
export const eventSubscriptions = [
  defineEventSubscription({
    eventType: "sale.closed",
    resourceType: "product",
    slot: "composition",
    requiredModules: ["stock"],
    decode: decodeMeasuredSaleClosedEvent,
    handler: async (tx, event) => {
      const captured = await capturedMeasuredConsumption(
        tx,
        event.businessId,
        event.payload,
      );
      await applyConsumption(tx, {
        businessId: event.businessId,
        locationId: event.payload.locationId,
        sourceOrderId: event.payload.sourceOrderId,
        closedAt: new Date(event.payload.closedAt),
        userId: event.payload.userId,
        lines: captured.movements,
      });
      await persistProvenance(tx, event, captured.sources);
      await publishConsumptionApplied(tx, event, captured.expectedLines);
    },
  }),
  purchaseSubscription,
] as const satisfies readonly EventSubscription[];
