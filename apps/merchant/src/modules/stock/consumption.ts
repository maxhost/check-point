import type { DbTransaction } from "@mi-pasaporte/db";
import { and, eq, inArray, sql } from "drizzle-orm";
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
  if (
    new Set(args.lines.map((l) => `${l.sourceLineId}/${l.itemId}`)).size !==
    args.lines.length
  )
    throw new Error("Duplicate consumption line item");
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
    const inserted = await tx
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
      .onConflictDoNothing({
        target: [
          stockMovements.businessId,
          stockMovements.sourceOrderId,
          stockMovements.sourceLineId,
          stockMovements.itemId,
        ],
        where: sql`${stockMovements.kind}='consumption'`,
      })
      .returning({ id: stockMovements.id });
    if (!inserted.length) {
      const [existing] = await tx
        .select()
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.businessId, args.businessId),
            eq(stockMovements.sourceOrderId, args.sourceOrderId),
            eq(stockMovements.sourceLineId, line.sourceLineId),
            eq(stockMovements.itemId, line.itemId),
            eq(stockMovements.kind, "consumption"),
          ),
        );
      if (
        !existing ||
        existing.locationId !== args.locationId ||
        existing.productId !== line.productId ||
        existing.quantity !== formatDecimal(-quantity, 3) ||
        existing.occurredAt.getTime() !== args.closedAt.getTime()
      )
        throw new Error("Consumption snapshot conflict");
    }
  }
}
