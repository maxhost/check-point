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
import type { MeasuredSaleClosedEvent } from "../../../server/module-events/types";
import {
  readConsumptionCost,
  type ExpectedCostLine,
} from "../../stock/server/consumption-cost";
import {
  originalMoney,
  toMinor,
} from "@mi-pasaporte/domain/financial/rational";
import type {
  ConsumptionAppliedEvent,
  MeasuredConsumptionApplied,
} from "./consumption-applied";
import { decodeConsumptionApplied } from "./consumption-applied";
export type { ConsumptionApplied } from "./consumption-applied";
import { decodeMeasuredSaleClosedEvent } from "../../../server/module-events/decode";
import { parseMeasure } from "@mi-pasaporte/domain/measures";
export async function publishConsumptionApplied(
  tx: DbTransaction,
  event: {
    id: string;
    businessId: string;
    eventVersion?: number;
    payload: MeasuredSaleClosedEvent;
  },
  expectedLines: ExpectedCostLine[],
) {
  const p = event.payload;
  if (p.eventVersion === 4)
    decodeMeasuredSaleClosedEvent(p, event.eventVersion ?? 4);
  const eventVersion = p.eventVersion === 4 ? 2 : 1;
  const currencyCode = p.eventVersion === 1 ? null : p.money.currencyCode;
  const minorUnit = p.eventVersion === 1 ? null : p.money.minorUnit;
  const identities = p.lines.map((line) => ({
    sourceLineId: line.sourceLineId,
    productId: line.productId,
    productLabel: "productLabel" in line ? String(line.productLabel) : null,
    quantity: String(line.quantity),
    ...(p.eventVersion === 4 && "measure" in line
      ? { measure: parseMeasure(line.measure) }
      : {}),
    revenueMinor:
      p.eventVersion !== 1 && "money" in line
        ? String(toMinor(originalMoney(line.money.net), p.money.minorUnit))
        : null,
    allocatedCommissionMinor:
      (p.eventVersion === 3 || p.eventVersion === 4) &&
      "commissionMinor" in line
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
    const previous =
      existing.payload as Partial<ConsumptionAppliedEvent> | null;
    if (
      existing.eventVersion !== eventVersion ||
      existing.locationId !== p.locationId ||
      !previous ||
      previous.eventVersion !== eventVersion ||
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
          ...(eventVersion === 2
            ? {
                measure: parseMeasure(
                  (line as MeasuredConsumptionApplied["lines"][number]).measure,
                ),
              }
            : {}),
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
  const payload = {
    eventVersion,
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
  if (eventVersion === 2) decodeConsumptionApplied(payload, eventVersion);
  await appendModuleEvent(tx, {
    businessId: event.businessId,
    eventType: "recipes.consumption.applied",
    causationEventId: event.id,
    eventVersion,
    sourceId: p.sourceOrderId,
    locationId: p.locationId,
    payload,
  });
}
