import type { ModuleServer } from "../../route-table";
import { applyConsumption } from "../../stock/consumption";
import { capturedConsumption } from "./model/captured";
import { persistProvenance } from "./model/provenance";

/** Both captured formats are immutable; the transaction also owns delivery acknowledgment. */
export const eventSubscriptions: NonNullable<
  ModuleServer["eventSubscriptions"]
> = [
  {
    eventType: "sale.closed",
    resourceType: "product",
    slot: "composition",
    requiredModules: ["stock"],
    handler: async (tx, event) => {
      const captured = await capturedConsumption(
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
    },
  },
];
