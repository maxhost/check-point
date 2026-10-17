import type { DbTransaction } from "@mi-pasaporte/db";
import { businesses } from "@mi-pasaporte/db/schema";
import { eq } from "drizzle-orm";
import { minorUnitForCurrency } from "@mi-pasaporte/domain/financial/rational";
import { appendModuleEvent } from "../../../server/module-events/append";
import type { PurchaseRecorded, AdjustmentRecorded } from "./analytics-facts";
export async function stockCurrency(tx: DbTransaction, businessId: string) {
  const [business] = await tx
    .select({ currencyCode: businesses.currencyCode })
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!business) throw new Error("Stock business unavailable");
  return {
    currencyCode: business.currencyCode,
    minorUnit: minorUnitForCurrency(business.currencyCode),
  };
}
export async function publishPurchase(
  tx: DbTransaction,
  businessId: string,
  payload: PurchaseRecorded,
) {
  return appendModuleEvent(tx, {
    businessId,
    eventType: "stock.purchase.recorded",
    eventVersion: 1,
    sourceId: payload.movementId,
    locationId: payload.locationId,
    payload,
  });
}
export async function publishAdjustment(
  tx: DbTransaction,
  businessId: string,
  payload: AdjustmentRecorded,
) {
  return appendModuleEvent(tx, {
    businessId,
    eventType: "stock.adjustment.recorded",
    eventVersion: 1,
    sourceId: payload.movementId,
    locationId: payload.locationId,
    payload,
  });
}
