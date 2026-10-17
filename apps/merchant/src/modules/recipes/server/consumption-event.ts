import { formatDecimal, fromDb } from "../../decimal";
import type { DbTransaction } from "@mi-pasaporte/db";
import {
  stockItems,
  stockItemLocations,
  stockMovements,
} from "@mi-pasaporte/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { appendModuleEvent } from "../../../server/module-events/append";
import type { CapturedModuleEvent } from "../../../server/module-events/types";
import {
  readConsumptionCost,
  type ExpectedCostLine,
} from "../../stock/server/consumption-cost";
import {
  originalMoney,
  toMinor,
} from "@mi-pasaporte/domain/financial/rational";
export type ConsumptionApplied = {
  eventVersion: 1;
  sourceOrderId: string;
  locationId: string;
  closedAt: string;
  lines: {
    sourceLineId: string;
    productId: string | null;
    productLabel: string | null;
    quantity: string;
    cost: {
      amountMinor: string;
      currencyCode: string;
      minorUnit: number;
    } | null;
  }[];
  items: {
    itemId: string;
    itemLabel: string;
    quantity: string;
    onHandAfter: string;
  }[];
};
export async function publishConsumptionApplied(
  tx: DbTransaction,
  event: CapturedModuleEvent,
  expectedLines: ExpectedCostLine[],
) {
  const p = event.payload;
  const cost = await readConsumptionCost(tx, {
    businessId: event.businessId,
    locationId: p.locationId,
    sourceOrderId: p.sourceOrderId,
    expectedLines,
    delivery: { state: "applied" },
  });
  const movements = await tx
    .select()
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.businessId, event.businessId),
        eq(stockMovements.locationId, p.locationId),
        eq(stockMovements.sourceOrderId, p.sourceOrderId),
        eq(stockMovements.kind, "consumption"),
      ),
    );
  const ids = [...new Set(movements.map((m) => m.itemId))];
  const pairs = ids.length
    ? await tx
        .select({
          itemId: stockItems.id,
          itemLabel: stockItems.name,
          onHandAfter: sql<string>`(select coalesce(sum(m.quantity),0)::text from stock.movement m where m.business_id=${event.businessId}::uuid and m.location_id=${p.locationId}::uuid and m.item_id=${stockItems.id})`,
        })
        .from(stockItemLocations)
        .innerJoin(stockItems, eq(stockItems.id, stockItemLocations.itemId))
        .where(
          and(
            eq(stockItemLocations.businessId, event.businessId),
            eq(stockItemLocations.locationId, p.locationId),
            inArray(stockItems.id, ids),
          ),
        )
    : [];
  const payload: ConsumptionApplied = {
    eventVersion: 1,
    sourceOrderId: p.sourceOrderId,
    locationId: p.locationId,
    closedAt: p.closedAt,
    lines: p.lines.map((line) => {
      const c = cost.lines.find((c) => c.sourceLineId === line.sourceLineId);
      return {
        sourceLineId: line.sourceLineId,
        productId: line.productId,
        productLabel: "productLabel" in line ? String(line.productLabel) : null,
        quantity: String(line.quantity),
        cost:
          c?.state === "completo" &&
          c.knownCost !== null &&
          (c.minorUnits === 0 || c.minorUnits === 2) &&
          c.currencyCode
            ? {
                amountMinor: String(
                  toMinor(originalMoney(c.knownCost), c.minorUnits),
                ),
                currencyCode: c.currencyCode,
                minorUnit: c.minorUnits,
              }
            : null,
      };
    }),
    items: pairs.map((pair) => ({
      ...pair,
      quantity: formatDecimal(
        -movements
          .filter((m) => m.itemId === pair.itemId)
          .reduce((n, m) => n + fromDb(m.quantity, 3), 0n),
        3,
      ),
    })),
  };
  await appendModuleEvent(tx, {
    businessId: event.businessId,
    eventType: "recipes.consumption.applied",
    causationEventId: event.id,
    eventVersion: 1,
    sourceId: p.sourceOrderId,
    locationId: p.locationId,
    payload,
  });
}
