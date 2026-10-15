import type { DbTransaction } from "@mi-pasaporte/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  businesses,
  stockItems,
  stockMovements,
} from "@mi-pasaporte/db/schema";
import { formatDecimal, fromDb } from "../decimal";
import { lockItemLocations } from "./local";
import { consumptionMinorUnits } from "./consumption-money";
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
  // Validate every quantity before any ledger write, using exact stored decimals.
  const movements = args.lines.map((line) => {
    const quantity = fromDb(line.quantity, 3);
    if (quantity <= 0n || quantity >= 10n ** 14n)
      throw new Error("Invalid consumption quantity");
    return {
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
    };
  });
  const ids = [...new Set(args.lines.map((line) => line.itemId))].sort();
  if (!ids.length) return;
  // Purchases/counts take item FOR UPDATE before pair FOR UPDATE. Take all FK
  // KEY SHARE locks before pairs too, so inserts cannot invert that lock order.
  const items = await tx
    .select({ id: stockItems.id })
    .from(stockItems)
    .where(
      and(
        eq(stockItems.businessId, args.businessId),
        inArray(stockItems.id, ids),
      ),
    )
    .orderBy(stockItems.id)
    .for("key share");
  if (items.length !== ids.length)
    throw new Error("Consumption item unavailable");
  const pairs = await lockItemLocations(
    tx,
    args.businessId,
    ids,
    args.locationId,
  );
  const existing = await tx
    .select({
      sourceLineId: stockMovements.sourceLineId,
      itemId: stockMovements.itemId,
      locationId: stockMovements.locationId,
      productId: stockMovements.productId,
      quantity: stockMovements.quantity,
      occurredAt: stockMovements.occurredAt,
      createdByUserId: stockMovements.createdByUserId,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.businessId, args.businessId),
        eq(stockMovements.sourceOrderId, args.sourceOrderId),
        eq(stockMovements.kind, "consumption"),
      ),
    );
  const byOrigin = new Map(
    existing.map((row) => [`${row.sourceLineId}/${row.itemId}`, row]),
  );
  const fresh = movements.filter((movement) => {
    const previous = byOrigin.get(
      `${movement.sourceLineId}/${movement.itemId}`,
    );
    if (!previous) return true;
    if (
      previous.locationId !== movement.locationId ||
      previous.productId !== movement.productId ||
      previous.quantity !== movement.quantity ||
      previous.occurredAt.getTime() !== movement.occurredAt.getTime() ||
      previous.createdByUserId !== movement.createdByUserId
    )
      throw new Error("Consumption snapshot conflict");
    return false;
  });
  if (!fresh.length) return;
  // Read currency only for a new valuation, once for this complete delivery.
  // A replay must also work after today's currency/policy has changed.
  const [business] = await tx
    .select({ currencyCode: businesses.currencyCode })
    .from(businesses)
    .where(eq(businesses.id, args.businessId));
  if (!business) throw new Error("Consumption business unavailable");
  const minorUnits = consumptionMinorUnits(business.currencyCode);
  const costs = new Map(
    pairs.map((pair) => [pair.itemId, pair.weightedAverageUnitCost]),
  );
  const valued = fresh.map((movement) => ({
    ...movement,
    consumptionUnitCost: costs.get(movement.itemId) ?? null,
    consumptionLossFactor: "1.000000",
    consumptionCurrencyCode: business.currencyCode,
    consumptionMinorUnits: minorUnits,
  }));
  // At most 20k bind parameters per query, safely below PostgreSQL's 65535 cap.
  // Every chunk and the delivery acknowledgment still share the caller transaction.
  for (let offset = 0; offset < valued.length; offset += 1000) {
    const chunk = valued.slice(offset, offset + 1000);
    const inserted = await tx
      .insert(stockMovements)
      .values(chunk)
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
    if (inserted.length !== chunk.length)
      throw new Error("Consumption snapshot conflict");
  }
}
