import { withDbTransaction, type DbTransaction } from "@mi-pasaporte/db";
import {
  locations,
  moduleEvents,
  moduleEventDeliveries,
  profitabilityPaymentCommissions as snapshots,
} from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import {
  minorUnitForCurrency,
  normalizeMoney,
  type ExactAmount,
} from "@mi-pasaporte/domain/financial";
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
import { ModuleError } from "../../../errors";
import { readModuleResources } from "../../../resources";
import { decodeSaleClosedEvent } from "../../../../server/module-events/decode";
export type SaleCommissionDTO = {
  state: "completo" | "incompleto" | "pendiente";
  currencyCode: string | null;
  minorUnit: 0 | 2 | null;
  total: string | null;
  originalTotal: ExactAmount | null;
  totalNormalizationAdjustment: ExactAmount | null;
  payments: {
    paymentId: string;
    commission: string | null;
    originalCommission: ExactAmount | null;
    normalizationAdjustment: ExactAmount | null;
    configured: boolean;
    reasons: string[];
  }[];
  reasons: string[];
};
const absent = (reason: string): SaleCommissionDTO => ({
  state: "incompleto",
  currencyCode: null,
  minorUnit: null,
  total: null,
  originalTotal: null,
  totalNormalizationAdjustment: null,
  payments: [],
  reasons: [reason],
});
async function settlementMetadata(
  tx: DbTransaction,
  businessId: string,
  sourceOrderId: string,
  locationId: string,
) {
  try {
    const resources = await readModuleResources(
      tx,
      businessId,
      "sale_settlement",
      [sourceOrderId],
    );
    if (resources.length !== 1) return null;
    const m = resources[0].metadata;
    if (
      m.sourceOrderId !== sourceOrderId ||
      m.locationId !== locationId ||
      m.snapshotPresent !== true ||
      typeof m.collectedTotal !== "string" ||
      typeof m.currencyCode !== "string" ||
      minorUnitForCurrency(m.currencyCode) !== m.minorUnit
    )
      return null;
    if (
      normalizeMoney(m.collectedTotal, m.minorUnit as 0 | 2) !==
      m.collectedTotal
    )
      return null;
    return {
      collected: m.collectedTotal,
      currencyCode: m.currencyCode,
      minorUnit: m.minorUnit as 0 | 2,
    };
  } catch {
    return null;
  }
}
const zero = (currencyCode: string, minorUnit: 0 | 2): SaleCommissionDTO => ({
  state: "completo",
  currencyCode,
  minorUnit,
  total: formatMinor(0n, minorUnit),
  originalTotal: exact(rational(0n)),
  totalNormalizationAdjustment: exact(rational(0n)),
  payments: [],
  reasons: [],
});
export async function readSaleCommissions(
  businessId: string,
  rawOrderId: unknown,
  rawLocationId: unknown,
): Promise<SaleCommissionDTO> {
  if (!rawLocationId)
    throw new ModuleError(422, "location_required", "Elige un local.");
  if (!isUuid(rawLocationId) || !isUuid(rawOrderId))
    throw new ModuleError(
      404,
      "location_not_found",
      "Ese local o venta no existe.",
    );
  const locationId = rawLocationId as string,
    sourceOrderId = rawOrderId as string;
  return withDbTransaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`);
    const [local] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(eq(locations.businessId, businessId), eq(locations.id, locationId)),
      );
    if (!local)
      throw new ModuleError(404, "location_not_found", "Ese local no existe.");
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
    const [delivery] = await tx
      .select()
      .from(moduleEventDeliveries)
      .where(
        and(
          eq(moduleEventDeliveries.eventId, event.id),
          eq(moduleEventDeliveries.subscriberId, "profitability"),
        ),
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
        p.resourceVersions.find(
          (r) => r.providerId === "profitability" && r.slot === "commission",
        )?.versionId ?? null;
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
          (sum, p) => sum + toMinor(originalMoney(p.commission!), minorUnit),
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
