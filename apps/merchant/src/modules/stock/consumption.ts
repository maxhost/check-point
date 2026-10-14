import type { DbTransaction } from "@mi-pasaporte/db";
import { and, eq, inArray } from "drizzle-orm";
import { stockItems, stockMovements } from "@mi-pasaporte/db/schema";
import { formatDecimal, fromDb } from "../decimal";
import { lockItemLocation } from "./local";
/** Caller owns the delivery transaction. Archived ingredients remain consumable. */
export async function applyConsumption(
  tx: DbTransaction,
  args: {
    businessId: string;
    locationId: string;
    sourceOrderId: string;
    closedAt: Date;
    userId: string;
    lines: {
      sourceLineId: string;
      productId: string;
      itemId: string;
      quantity: string;
    }[];
  },
) {
  const ids = [...new Set(args.lines.map((l) => l.itemId))].sort();
  if (!ids.length) return;
  const items = await tx
    .select({ id: stockItems.id })
    .from(stockItems)
    .where(
      and(
        eq(stockItems.businessId, args.businessId),
        inArray(stockItems.id, ids),
      ),
    );
  if (items.length !== ids.length)
    throw new Error("Consumption item unavailable");
  for (const id of ids)
    await lockItemLocation(tx, args.businessId, id, args.locationId);
  for (const line of args.lines) {
    const quantity = fromDb(line.quantity, 3);
    if (quantity <= 0n || quantity >= 10n ** 14n)
      throw new Error("Invalid consumption quantity");
    await tx
      .insert(stockMovements)
      .values({
        businessId: args.businessId,
        itemId: line.itemId,
        locationId: args.locationId,
        kind: "consumption",
        quantity: formatDecimal(-quantity, 3),
        sourceOrderId: args.sourceOrderId,
        sourceLineId: line.sourceLineId,
        productId: line.productId,
        occurredAt: args.closedAt,
        createdByUserId: args.userId,
      })
      .onConflictDoNothing();
  }
}
