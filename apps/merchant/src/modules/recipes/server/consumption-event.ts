import { formatDecimal, fromDb } from "../../decimal";
import type { DbTransaction } from "@mi-pasaporte/db";
import {
  moduleEvents,
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
  observedAt?: string;
  sourceOrderId: string;
  locationId: string;
  closedAt: string;
  currencyCode: string | null;
  minorUnit: number | null;
  lines: {
    sourceLineId: string;
    productId: string | null;
    productLabel: string | null;
    quantity: string;
    revenueMinor: string | null;
    allocatedCommissionMinor: string | null;
    cost: {
      amountMinor: string;
      currencyCode: string;
      minorUnit: number;
    } | null;
  }[];
  items: {
    itemId: string;
    itemLabel: string;
    itemUnit?: string;
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
  const currencyCode = p.eventVersion === 1 ? null : p.money.currencyCode;
  const minorUnit = p.eventVersion === 1 ? null : p.money.minorUnit;
  const identities = p.lines.map((line) => ({
    sourceLineId: line.sourceLineId,
    productId: line.productId,
    productLabel: "productLabel" in line ? String(line.productLabel) : null,
    quantity: String(line.quantity),
    revenueMinor:
      p.eventVersion !== 1 && "money" in line
        ? String(toMinor(originalMoney(line.money.net), p.money.minorUnit))
        : null,
    allocatedCommissionMinor:
      p.eventVersion === 3 && "commissionMinor" in line
        ? line.commissionMinor
        : null,
  }));
  const [existing] = await tx
    .select()
    .from(moduleEvents)
    .where(
      and(
        eq(moduleEvents.businessId, event.businessId),
        eq(moduleEvents.eventType, "recipes.consumption.applied"),
        eq(moduleEvents.sourceId, p.sourceOrderId),
      ),
    );
  if (existing) {
    const previous = existing.payload as Partial<ConsumptionApplied> | null;
    if (
      existing.eventVersion !== 1 ||
      existing.locationId !== p.locationId ||
      !previous ||
      previous.eventVersion !== 1 ||
      previous.sourceOrderId !== p.sourceOrderId ||
      previous.locationId !== p.locationId ||
      previous.closedAt !== p.closedAt ||
      previous.currencyCode !== currencyCode ||
      previous.minorUnit !== minorUnit ||
      !Array.isArray(previous.lines) ||
      previous.lines.some((line) => !line || typeof line !== "object") ||
      JSON.stringify(
        previous.lines.map((line) => ({
          sourceLineId: line.sourceLineId,
          productId: line.productId,
          productLabel: line.productLabel,
          quantity: line.quantity,
          revenueMinor: line.revenueMinor,
          allocatedCommissionMinor: line.allocatedCommissionMinor,
        })),
      ) !== JSON.stringify(identities)
    )
      throw new Error("Captured consumption event snapshot conflict");
    // Costs, inventory observations and the original observation time stay frozen.
    return;
  }
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
          itemUnit: stockItems.unit,
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
    observedAt: new Date().toISOString(),
    sourceOrderId: p.sourceOrderId,
    locationId: p.locationId,
    closedAt: p.closedAt,
    currencyCode,
    minorUnit,
    lines: identities.map((line) => {
      const c = cost.lines.find((c) => c.sourceLineId === line.sourceLineId);
      return {
        ...line,
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
