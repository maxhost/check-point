import { and, eq, sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { moduleEvents } from "@mi-pasaporte/db/schema";
import type { FinancialSettlement } from "@mi-pasaporte/domain/financial";
import { assertFinancialSettlement } from "@mi-pasaporte/domain/financial/validate";
import {
  exactSnapshotLineGross,
  parseMeasure,
  type Decimal,
  type LineMeasure,
} from "@mi-pasaporte/domain/measures";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { appendModuleEvent } from "./append";
import { decodeMeasuredSaleClosedEvent } from "./decode";
import type { ResourceCapture } from "./publish";
import type { PaymentMetadata, SaleClosedEventV4 } from "./types";

/** Server-owned snapshots only: never pass HTTP quantities, prices or measures directly. */
export type MeasuredSaleClosedInput = {
  businessId: string;
  sourceOrderId: string;
  locationId: string;
  userId: string;
  settlement: FinancialSettlement;
  capture: ResourceCapture;
  paymentsMetadata: readonly PaymentMetadata[];
  commissionByLine: Readonly<Record<string, string | null>>;
  lines: readonly {
    sourceLineId: string;
    position: number;
    productId: string | null;
    productLabel: string;
    quantity: Decimal;
    unitPrice: Decimal;
    measure: LineMeasure;
  }[];
};

/** Pure assembly; tariff evidence stays private, while all settled money stays frozen. */
export function buildMeasuredSaleClosedPayload(
  args: MeasuredSaleClosedInput,
): SaleClosedEventV4 {
  if (
    !args.capture ||
    !Array.isArray(args.capture.enabled) ||
    !args.capture.enabled.every((id) => typeof id === "string") ||
    !Array.isArray(args.capture.versions)
  )
    throw new Error("Missing resource capture");
  const financial = args.settlement;
  assertFinancialSettlement(financial);
  const sources = new Map(args.lines.map((line) => [line.sourceLineId, line]));
  if (
    sources.size !== args.lines.length ||
    sources.size !== financial.lines.length ||
    new Set(args.lines.map((line) => line.position)).size !== sources.size ||
    new Set(financial.lines.map((line) => line.position)).size !==
      sources.size ||
    Object.keys(args.commissionByLine).length !== sources.size ||
    args.paymentsMetadata.length !== financial.payments.length ||
    new Set(args.paymentsMetadata.map((payment) => payment.paymentId)).size !==
      financial.payments.length
  )
    throw new Error("Invalid measured event sources");
  const refs = (resourceType: string, resourceId: string | null) =>
    args.capture.versions
      .filter(
        (version) =>
          version.resourceType === resourceType &&
          version.resourceId === resourceId,
      )
      .map(({ providerId, slot, versionId }) => ({
        providerId,
        slot,
        versionId,
      }));
  const payload: SaleClosedEventV4 = {
    eventVersion: 4,
    sourceOrderId: args.sourceOrderId,
    locationId: args.locationId,
    userId: args.userId,
    closedAt: new Date(args.capture.captured_at).toISOString(),
    money: {
      gross: financial.gross,
      discount: financial.discount,
      roundingAdjustment: financial.roundingAdjustment,
      collected: financial.collected,
      currencyCode: financial.currencyCode,
      minorUnit: financial.minorUnit,
      originalGross: financial.originals.gross,
      originalDiscount: financial.originals.discount,
      originalNet: financial.originals.net,
      normalizationAdjustments: financial.normalizationAdjustments,
    },
    lines: financial.lines.map((frozen) => {
      const source = sources.get(frozen.sourceLineId);
      if (
        !source ||
        source.position !== frozen.position ||
        typeof source.quantity !== "string" ||
        typeof source.unitPrice !== "string" ||
        !Object.hasOwn(args.commissionByLine, source.sourceLineId)
      )
        throw new Error("Invalid measured event source");
      const measure = parseMeasure(source.measure);
      const original = exactSnapshotLineGross(
        source.quantity,
        source.unitPrice,
        measure,
      );
      // assertFinancialSettlement already requires reduced canonical rationals.
      if (
        original.numerator !== frozen.money.originals.gross.numerator ||
        original.denominator !== frozen.money.originals.gross.denominator
      )
        throw new Error("Measured source original mismatch");
      return {
        sourceLineId: source.sourceLineId,
        productId: source.productId,
        productLabel: source.productLabel,
        quantity: source.quantity,
        measure,
        position: frozen.position,
        money: frozen.money,
        discountOrigin: frozen.discountOrigin,
        commissionMinor: args.commissionByLine[source.sourceLineId],
        resourceVersions: refs("product", source.productId),
      };
    }),
    payments: financial.payments.map((payment) => {
      const metadata = args.paymentsMetadata.find(
        (candidate) =>
          candidate.paymentId === payment.paymentId &&
          candidate.methodId === payment.methodId,
      );
      if (!metadata) throw new Error("Missing payment metadata");
      return {
        ...payment,
        paymentId: metadata.paymentId,
        methodId: metadata.methodId,
        methodProviderId: metadata.methodProviderId,
        methodName: metadata.methodName,
        chargeShape: metadata.chargeShape,
        resourceVersions: refs("payment_method", payment.methodId),
      };
    }),
    paymentOriginals: financial.paymentOriginals,
  };
  decodeMeasuredSaleClosedEvent(payload, 4);
  return payload;
}

/**
 * Opt-in producer; append and deliveries belong to the caller's transaction.
 * Cooperating V4 writers serialize by business/source before the replay lookup.
 * Use READ COMMITTED; at stronger snapshot isolation the caller must retry the
 * whole transaction on serialization/unique failure. Legacy writers do not take
 * this lock: the durable unique key rejects that race, without partial effects.
 * Capture must come from this transaction; replay never inspects it or pointers.
 */
export async function publishMeasuredSaleClosed(
  tx: DbTransaction,
  args: MeasuredSaleClosedInput,
) {
  if (!isUuid(args.businessId) || !isUuid(args.sourceOrderId))
    throw new Error("Invalid measured event identity");
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${args.businessId + "/sale.closed/" + args.sourceOrderId}, 0))`,
  );
  const [existing] = await tx
    .select({ id: moduleEvents.id, payload: moduleEvents.payload })
    .from(moduleEvents)
    .where(
      and(
        eq(moduleEvents.businessId, args.businessId),
        eq(moduleEvents.eventType, "sale.closed"),
        eq(moduleEvents.sourceId, args.sourceOrderId),
      ),
    )
    .limit(1);
  if (existing) {
    const payload = decodeMeasuredSaleClosedEvent(existing.payload);
    return {
      eventId: existing.id,
      closedAt: new Date(payload.closedAt),
      payload,
    };
  }
  const payload = buildMeasuredSaleClosedPayload(args);
  const { eventId } = await appendModuleEvent(tx, {
    businessId: args.businessId,
    eventType: "sale.closed",
    eventVersion: 4,
    sourceId: args.sourceOrderId,
    locationId: args.locationId,
    payload,
    enabledModuleIds: args.capture.enabled,
  });
  return { eventId, closedAt: new Date(payload.closedAt), payload };
}
