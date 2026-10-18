import {
  captureQuantity,
  parseMeasure,
  trustedUnitSnapshotQuantity,
  type LineMeasure,
} from "@mi-pasaporte/domain/measures";
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

export type MeasuredConsumptionApplied = Omit<
  ConsumptionApplied,
  "eventVersion" | "lines"
> & {
  eventVersion: 2;
  lines: (ConsumptionApplied["lines"][number] & { measure: LineMeasure })[];
};
export type ConsumptionAppliedEvent =
  ConsumptionApplied | MeasuredConsumptionApplied;
/** Historical V1 intentionally retains its additive-field tolerance. */
export function decodeConsumptionApplied(
  payload: unknown,
  version: number,
): ConsumptionAppliedEvent {
  if (version === 1) {
    if ((payload as { eventVersion?: unknown } | null)?.eventVersion === 2)
      throw new Error("Consumption event version mismatch");
    return payload as ConsumptionApplied;
  }
  if (version !== 2 || !payload || typeof payload !== "object")
    throw new Error("Invalid consumption event version");
  const p = payload as MeasuredConsumptionApplied;
  if (
    p.eventVersion !== 2 ||
    typeof p.sourceOrderId !== "string" ||
    !p.sourceOrderId ||
    typeof p.locationId !== "string" ||
    !p.locationId ||
    typeof p.closedAt !== "string" ||
    !Number.isFinite(Date.parse(p.closedAt)) ||
    typeof p.currencyCode !== "string" ||
    !p.currencyCode ||
    (p.minorUnit !== 0 && p.minorUnit !== 2) ||
    !Array.isArray(p.lines) ||
    !p.lines.length ||
    !Array.isArray(p.items)
  )
    throw new Error("Invalid measured consumption event");
  const ids = new Set<string>();
  for (const line of p.lines) {
    if (
      !line ||
      typeof line !== "object" ||
      typeof line.sourceLineId !== "string" ||
      !line.sourceLineId ||
      ids.has(line.sourceLineId) ||
      (line.productId !== null && typeof line.productId !== "string") ||
      (line.productLabel !== null && typeof line.productLabel !== "string") ||
      typeof line.quantity !== "string" ||
      (line.revenueMinor !== null &&
        (typeof line.revenueMinor !== "string" ||
          !/^\d+$/.test(line.revenueMinor))) ||
      (line.allocatedCommissionMinor !== null &&
        (typeof line.allocatedCommissionMinor !== "string" ||
          !/^\d+$/.test(line.allocatedCommissionMinor)))
    )
      throw new Error("Invalid measured consumption line");
    ids.add(line.sourceLineId);
    const measure = parseMeasure(line.measure);
    if (measure.kind === "unit") trustedUnitSnapshotQuantity(line.quantity);
    else captureQuantity(line.quantity, measure.quantityUnit);
    if (
      line.cost !== null &&
      (!line.cost ||
        typeof line.cost.amountMinor !== "string" ||
        !/^\d+$/.test(line.cost.amountMinor) ||
        typeof line.cost.currencyCode !== "string" ||
        !line.cost.currencyCode ||
        (line.cost.minorUnit !== 0 && line.cost.minorUnit !== 2))
    )
      throw new Error("Invalid measured consumption cost");
  }
  return p;
}
