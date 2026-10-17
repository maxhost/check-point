import { formatResultMoney } from "./commission-read-support";
import {
  absent,
  zero,
  settlementMetadata,
  type SaleCommissionDTO,
} from "./commission-read-support";
import { businessStorageReady } from "./storage";
import { withDbTransaction } from "@mi-pasaporte/db";
import {
  locations,
  paymentCommissions as snapshots,
  saleCommissions,
  historicalEventHandlers,
  moduleEvents,
  moduleEventDeliveries,
} from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { normalizeMoney } from "@mi-pasaporte/domain/financial";
import {
  add,
  exact,
  formatMinor,
  fromExact,
  minorRational,
  originalMoney,
  rational,
  subtract,
  toMinor,
} from "@mi-pasaporte/domain/financial/rational";
import { BusinessError } from "./error";
import { decodeSaleClosedEvent } from "../module-events/decode";
export async function readSaleCommissions(
  businessId: string,
  rawOrderId: unknown,
  rawLocationId: unknown,
  sourceProviderId: string,
): Promise<SaleCommissionDTO> {
  if (!rawLocationId)
    throw new BusinessError(422, "location_required", "Elige un local.");
  if (!isUuid(rawLocationId) || !isUuid(rawOrderId))
    throw new BusinessError(
      404,
      "location_not_found",
      "Ese local o venta no existe.",
    );
  const locationId = (rawLocationId as string).trim().toLowerCase(),
    sourceOrderId = (rawOrderId as string).trim().toLowerCase();
  return withDbTransaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`);
    const [local] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(eq(locations.businessId, businessId), eq(locations.id, locationId)),
      );
    if (!local)
      throw new BusinessError(
        404,
        "location_not_found",
        "Ese local no existe.",
      );
    const [header] = await tx
      .select()
      .from(saleCommissions)
      .where(
        and(
          eq(saleCommissions.businessId, businessId),
          eq(saleCommissions.sourceProviderId, sourceProviderId),
          eq(saleCommissions.sourceOrderId, sourceOrderId),
        ),
      );
    if (header) {
      if (header.locationId !== locationId)
        throw new BusinessError(
          404,
          "location_not_found",
          "Ese local o venta no existe.",
        );
      const rows = await tx
        .select()
        .from(snapshots)
        .where(
          and(
            eq(snapshots.businessId, businessId),
            eq(snapshots.sourceProviderId, sourceProviderId),
            eq(snapshots.sourceOrderId, sourceOrderId),
            eq(snapshots.locationId, locationId),
          ),
        );
      return {
        state: header.state as "completo" | "incompleto",
        currencyCode: header.currencyCode,
        minorUnit: header.minorUnit as 0 | 2,
        total:
          header.total === null
            ? null
            : formatResultMoney(header.total, header.minorUnit as 0 | 2),
        originalTotal: header.originalTotal,
        totalNormalizationAdjustment: header.totalNormalizationAdjustment,
        payments: rows.map((r) => ({ paymentId: r.paymentId, ...r.result })),
        reasons: header.reasons,
      };
    }
    // Legacy events do not carry a producer field. Match only the frozen producer
    // from existing payment snapshots; otherwise do not guess a foreign source.
    if (!(await businessStorageReady(tx)))
      throw new BusinessError(
        503,
        "business_unavailable",
        "La actualización de Negocio está en curso.",
      );
    const origins = await tx
      .select()
      .from(historicalEventHandlers)
      .where(
        and(
          eq(historicalEventHandlers.handlerKey, "commission_snapshot"),
          eq(historicalEventHandlers.sourceProviderId, sourceProviderId),
        ),
      );
    if (!origins.length) return absent("commission_no_data");
    const sourceRows = await tx
      .select({ source: snapshots.sourceProviderId })
      .from(snapshots)
      .where(
        and(
          eq(snapshots.businessId, businessId),
          eq(snapshots.sourceOrderId, sourceOrderId),
        ),
      );
    if (
      sourceRows.length &&
      sourceRows.some((r) => r.source !== sourceProviderId)
    )
      return absent("commission_no_data");
    const [event] = await tx
      .select()
      .from(moduleEvents)
      .where(
        and(
          eq(moduleEvents.businessId, businessId),
          eq(moduleEvents.sourceId, sourceOrderId),
          eq(moduleEvents.locationId, locationId),
          eq(moduleEvents.eventType, "sale.closed"),
        ),
      );
    if (!event) {
      const persisted = await settlementMetadata(
        tx,
        businessId,
        sourceOrderId,
        locationId,
      );
      return persisted && originalMoney(persisted.collected).n === 0n
        ? zero(persisted.currencyCode, persisted.minorUnit)
        : absent("commission_no_data");
    }
    let payload;
    try {
      payload = decodeSaleClosedEvent(event.payload);
    } catch {
      return absent("commission_invalid_event");
    }
    if (payload.eventVersion !== 2) return absent("commission_legacy_event");
    const { currencyCode, minorUnit } = payload.money;
    if (originalMoney(payload.money.collected).n === 0n) {
      const persisted = await settlementMetadata(
        tx,
        businessId,
        sourceOrderId,
        locationId,
      );
      if (
        payload.payments.length ||
        (persisted &&
          (originalMoney(persisted.collected).n !== 0n ||
            persisted.currencyCode !== currencyCode ||
            persisted.minorUnit !== minorUnit))
      )
        return absent("commission_snapshot_conflict");
      return zero(currencyCode, minorUnit);
    }
    const handlers = await tx
      .select()
      .from(historicalEventHandlers)
      .where(eq(historicalEventHandlers.handlerKey, "commission_snapshot"));
    const deliveries = await tx
      .select()
      .from(moduleEventDeliveries)
      .where(and(eq(moduleEventDeliveries.eventId, event.id)));
    const delivery = deliveries.find((d) =>
      handlers.some((h) => h.subscriberId === d.subscriberId),
    );
    if (!delivery || delivery.state === "skipped")
      return {
        ...absent(
          delivery?.terminalReason === "modules_disabled"
            ? "commission_module_disabled"
            : "commission_no_data",
        ),
        currencyCode,
        minorUnit,
      };
    if (delivery.state !== "applied")
      return {
        ...absent(
          delivery.diagnostic === "application_failed"
            ? "application_failed"
            : "commission_pending",
        ),
        currencyCode,
        minorUnit,
        state: "pendiente",
        payments: payload.payments.map((p) => ({
          paymentId: p.paymentId,
          commission: null,
          originalCommission: null,
          normalizationAdjustment: null,
          configured: false,
          reasons: ["commission_pending"],
        })),
      };
    const frozen = await tx
      .select()
      .from(snapshots)
      .where(
        and(
          eq(snapshots.businessId, businessId),
          eq(snapshots.eventId, event.id),
          eq(snapshots.locationId, locationId),
          eq(snapshots.sourceOrderId, sourceOrderId),
        ),
      );
    const payments = payload.payments.map((p) => {
      const row = frozen.find((r) => r.paymentId === p.paymentId);
      const revisionId =
        p.resourceVersions.find((r) => r.slot === "commission")?.versionId ??
        null;
      if (
        !row ||
        row.commissionRevisionId !== revisionId ||
        row.methodId !== p.methodId ||
        row.methodProviderId !== p.methodProviderId ||
        row.currencyCode !== currencyCode ||
        row.minorUnit !== minorUnit ||
        normalizeMoney(row.amount, minorUnit) !== p.amount
      )
        return {
          paymentId: p.paymentId,
          commission: null,
          originalCommission: null,
          normalizationAdjustment: null,
          configured: false,
          reasons: ["commission_snapshot_missing"],
        };
      return { paymentId: p.paymentId, ...row.result };
    });
    const reasons = [...new Set(payments.flatMap((p) => p.reasons))];
    if (frozen.length !== payments.length)
      reasons.push("commission_snapshot_inconsistent");
    const allKnown =
      payments.length > 0 &&
      payments.every(
        (p) => p.commission !== null && p.originalCommission !== null,
      );
    const totalMinor = allKnown
      ? payments.reduce(
          (sum, p) =>
            sum + toMinor(fromExact(p.originalCommission!), minorUnit),
          0n,
        )
      : null;
    const original = allKnown
      ? payments.reduce(
          (sum, p) => add(sum, fromExact(p.originalCommission!)),
          rational(0n),
        )
      : null;
    return {
      state: reasons.length || !allKnown ? "incompleto" : "completo",
      currencyCode,
      minorUnit,
      total: totalMinor === null ? null : formatMinor(totalMinor, minorUnit),
      originalTotal: original ? exact(original) : null,
      totalNormalizationAdjustment:
        totalMinor === null || !original
          ? null
          : exact(subtract(minorRational(totalMinor, minorUnit), original)),
      payments,
      reasons,
    };
  });
}
