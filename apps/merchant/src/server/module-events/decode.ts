import { assertFinancialSettlement } from "@mi-pasaporte/domain/financial/validate";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import {
  captureQuantity,
  parseMeasure,
  trustedUnitSnapshotQuantity,
  UNIT_MEASURE,
} from "@mi-pasaporte/domain/measures";
import type {
  ResourceVersion,
  SaleClosedEvent,
  SaleClosedEventV2,
  SaleClosedEventV3,
  SaleClosedEventV4,
  MeasuredSaleClosedEvent,
  MeasuredSaleClosedEventView,
} from "./types";
const refs = (value: unknown): value is ResourceVersion[] =>
  Array.isArray(value) &&
  value.every(
    (r) =>
      r &&
      typeof r === "object" &&
      typeof r.providerId === "string" &&
      typeof r.slot === "string" &&
      isUuid(r.versionId),
  );
/** Runtime decoder for the union; never interprets an old event as financial evidence. */
export function decodeSaleClosedEvent(value: unknown): SaleClosedEvent {
  if (!value || typeof value !== "object")
    throw new Error("Invalid event envelope");
  const v = value as SaleClosedEvent;
  if (
    ![1, 2, 3].includes(v.eventVersion) ||
    !isUuid(v.sourceOrderId) ||
    !isUuid(v.locationId) ||
    typeof v.closedAt !== "string" ||
    !Number.isFinite(Date.parse(v.closedAt)) ||
    typeof v.userId !== "string" ||
    !Array.isArray(v.lines) ||
    !v.lines.length ||
    new Set(v.lines.map((l) => l.sourceLineId)).size !== v.lines.length ||
    v.lines.some(
      (l) =>
        !isUuid(l.sourceLineId) ||
        (l.productId !== null && !isUuid(l.productId)) ||
        !Number.isSafeInteger(l.quantity) ||
        l.quantity <= 0 ||
        !refs(l.resourceVersions),
    )
  )
    throw new Error("Invalid event envelope");
  if (v.eventVersion >= 2)
    assertFinancialEvent(v as SaleClosedEventV2 | SaleClosedEventV3);
  if (v.eventVersion === 3) assertProductMetadata(v);
  return v;
}

/** Shared durable validation, without recomputing prices or distributing money. */
function assertFinancialEvent(
  financial: SaleClosedEventV2 | SaleClosedEventV3 | SaleClosedEventV4,
): void {
  const m = financial.money;
  assertFinancialSettlement({
    ...m,
    originals: {
      gross: m.originalGross,
      discount: m.originalDiscount,
      net: m.originalNet,
    },
    lines: financial.lines,
    payments: financial.payments,
    paymentOriginals: financial.paymentOriginals,
  });
  for (const p of financial.payments)
    if (
      !isUuid(p.paymentId) ||
      !isUuid(p.methodId) ||
      typeof p.methodProviderId !== "string" ||
      !p.methodProviderId ||
      typeof p.methodName !== "string" ||
      !p.methodName ||
      !["none", "percent", "fixed", "percent_and_fixed"].includes(
        p.chargeShape,
      ) ||
      !refs(p.resourceVersions)
    )
      throw new Error("Invalid financial payment");
}

function assertProductMetadata(v: SaleClosedEventV3 | SaleClosedEventV4): void {
  if (
    v.lines.some(
      (l) =>
        typeof l.productLabel !== "string" ||
        !l.productLabel ||
        (l.commissionMinor !== null &&
          (typeof l.commissionMinor !== "string" ||
            !/^\d+$/.test(l.commissionMinor))),
    )
  )
    throw new Error("Missing product label");
}

/** Opt-in measured entry point; no producer/subscriber is connected here. */
export function decodeMeasuredSaleClosedEvent(
  value: unknown,
  eventVersion?: number,
): MeasuredSaleClosedEvent {
  if (!value || typeof value !== "object")
    throw new Error("Invalid event envelope");
  const v = value as SaleClosedEvent | SaleClosedEventV4;
  if (eventVersion !== undefined && eventVersion !== v.eventVersion)
    throw new Error("Event version mismatch");
  if (v.eventVersion !== 4) return decodeSaleClosedEvent(value);
  if (
    !isUuid(v.sourceOrderId) ||
    !isUuid(v.locationId) ||
    typeof v.closedAt !== "string" ||
    !Number.isFinite(Date.parse(v.closedAt)) ||
    typeof v.userId !== "string" ||
    !Array.isArray(v.lines) ||
    !v.lines.length ||
    v.lines.some((line) => !line || typeof line !== "object") ||
    new Set(v.lines.map((line) => line.sourceLineId)).size !== v.lines.length
  )
    throw new Error("Invalid event envelope");
  for (const line of v.lines) {
    if (
      !isUuid(line.sourceLineId) ||
      (line.productId !== null && !isUuid(line.productId)) ||
      !refs(line.resourceVersions) ||
      typeof line.quantity !== "string"
    )
      throw new Error("Invalid event line");
    const measure = parseMeasure(line.measure);
    if (measure.kind === "unit") trustedUnitSnapshotQuantity(line.quantity);
    else captureQuantity(line.quantity, measure.quantityUnit);
  }
  assertFinancialEvent(v);
  for (const original of v.paymentOriginals)
    if (!isUuid(original.paymentId) || !isUuid(original.methodId))
      throw new Error("Invalid financial payment original");
  assertProductMetadata(v);
  return v;
}

/** Explicit in-memory line view; payload keeps its wire version and original evidence. */
export function toMeasuredSaleClosedEventView(
  payload: MeasuredSaleClosedEvent,
): MeasuredSaleClosedEventView {
  if (payload.eventVersion === 4)
    return { payload, lines: payload.lines.map((line) => ({ ...line })) };
  // Historical decoder quantities are safe integers, independent of the DB INT32 bound.
  return {
    payload,
    lines: payload.lines.map((line) => ({
      ...line,
      quantity: String(line.quantity),
      measure: UNIT_MEASURE,
    })),
  } as MeasuredSaleClosedEventView;
}
