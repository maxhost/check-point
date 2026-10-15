import { assertFinancialSettlement } from "@mi-pasaporte/domain/financial/validate";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import type { ResourceVersion, SaleClosedEvent } from "./types";
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
    ![1, 2].includes(v.eventVersion) ||
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
  if (v.eventVersion === 2) {
    const m = v.money;
    assertFinancialSettlement({
      ...m,
      originals: {
        gross: m.originalGross,
        discount: m.originalDiscount,
        net: m.originalNet,
      },
      lines: v.lines,
      payments: v.payments,
      paymentOriginals: v.paymentOriginals,
    });
    for (const p of v.payments)
      if (
        !isUuid(p.paymentId) ||
        !isUuid(p.methodId) ||
        !p.methodProviderId ||
        !p.methodName ||
        !["none", "percent", "fixed", "percent_and_fixed"].includes(
          p.chargeShape,
        ) ||
        !refs(p.resourceVersions)
      )
        throw new Error("Invalid financial payment");
  }
  return v;
}
