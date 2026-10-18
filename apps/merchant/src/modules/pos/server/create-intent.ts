import { createHash } from "node:crypto";
import { parsePosCreateV2 } from "./measured-input";

/** Server-only canonical create intent. Request identity is keyed separately by business
 * + createRequestId; this digest is neither a credential nor DB idempotency itself. */
export function createIntentFingerprint(raw: unknown): string {
  const command = parsePosCreateV2(raw);
  const canonical = {
    saleType: command.saleType,
    orderLabel: command.orderLabel,
    locationId: command.locationId,
    tableId: command.tableId,
    note: command.note,
    items: command.items.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      quantityUnit: line.quantityUnit,
      catalogRevision: line.catalogRevision,
    })),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
