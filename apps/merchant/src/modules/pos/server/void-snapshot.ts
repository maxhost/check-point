import { and, eq, sql } from "drizzle-orm";
import { moduleEvents, posOrders } from "@mi-pasaporte/db/schema";
import type { FinancialAmounts } from "@mi-pasaporte/domain/financial";
import type { LineMeasure } from "@mi-pasaporte/domain/measures";
import {
  formatMinor,
  minorUnitForCurrency,
} from "@mi-pasaporte/domain/financial/rational";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";

/** A void freezes amounts without inventing a paid financial settlement. */
export type OrderVoidedV2 = {
  eventVersion: 2;
  sourceOrderId: string;
  locationId: string | null;
  voidedAt: string;
  userId: string;
  lines: readonly (FinancialAmounts["lines"][number] & {
    productId: string | null;
    productLabel: string;
    quantity: string;
    unitPrice: string;
    measure: LineMeasure;
  })[];
  money: FinancialAmounts;
  amountMinor: string;
  currencyCode: string;
  minorUnit: 0 | 2;
};

export type VoidMetricSnapshot = Pick<
  OrderVoidedV2,
  | "sourceOrderId"
  | "locationId"
  | "voidedAt"
  | "amountMinor"
  | "currencyCode"
  | "minorUnit"
>;

/** Validate the explicit version and every consumed field, without interpreting sale payloads. */
export function decodeVoidMetricSnapshot(
  raw: unknown,
  version: number,
): VoidMetricSnapshot {
  if (!raw || typeof raw !== "object") throw new Error("Invalid void snapshot");
  const p = raw as Record<string, unknown>;
  if (
    (version !== 1 && version !== 2) ||
    p.eventVersion !== version ||
    typeof p.sourceOrderId !== "string" ||
    !isUuid(p.sourceOrderId) ||
    (p.locationId !== null &&
      (typeof p.locationId !== "string" || !isUuid(p.locationId))) ||
    typeof p.voidedAt !== "string" ||
    !Number.isFinite(Date.parse(p.voidedAt))
  )
    throw new Error("Invalid void snapshot");
  frozenVoidMoney(p.amountMinor, p.currencyCode, p.minorUnit);
  return p as unknown as VoidMetricSnapshot;
}

export function frozenVoidMoney(
  amount: unknown,
  currency: unknown,
  minorUnit: unknown,
) {
  if (
    typeof amount !== "string" ||
    !/^(0|[1-9]\d*)$/.test(amount) ||
    typeof currency !== "string" ||
    !/^[A-Z]{3}$/.test(currency) ||
    (minorUnit !== 0 && minorUnit !== 2) ||
    minorUnitForCurrency(currency) !== minorUnit
  )
    throw new Error("Invalid frozen void money");
  return {
    gross: formatMinor(BigInt(amount), minorUnit),
    currencyCode: currency,
  };
}

// The schema guarantees at most one event for this business/type/source. Only
// scalar fields enter the read projection, never the event's line array.
export const voidSnapshotJoin = and(
  eq(moduleEvents.businessId, posOrders.businessId),
  eq(moduleEvents.sourceId, posOrders.id),
  eq(moduleEvents.eventType, "pos.order.voided"),
  eq(moduleEvents.eventVersion, 2),
  eq(posOrders.status, "voided"),
);
export const voidSnapshotColumns = {
  voidEventId: moduleEvents.id,
  voidPayloadVersion: sql<
    number | null
  >`(${moduleEvents.payload}->>'eventVersion')::integer`,
  voidAmountMinor: sql<string | null>`${moduleEvents.payload}->>'amountMinor'`,
  voidCurrency: sql<string | null>`${moduleEvents.payload}->>'currencyCode'`,
  voidMinorUnit: sql<
    number | null
  >`(${moduleEvents.payload}->>'minorUnit')::integer`,
};
export function frozenVoidFromRow(row: {
  voidEventId: string | null;
  voidPayloadVersion: number | null;
  voidAmountMinor: string | null;
  voidCurrency: string | null;
  voidMinorUnit: number | null;
}) {
  if (row.voidEventId === null) return null;
  if (row.voidPayloadVersion !== 2)
    throw new Error("Invalid void snapshot version");
  return frozenVoidMoney(
    row.voidAmountMinor,
    row.voidCurrency,
    row.voidMinorUnit,
  );
}
