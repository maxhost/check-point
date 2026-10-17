import { appendModuleEvent } from "../module-events/append";
import type { DbTransaction } from "@mi-pasaporte/db";
import {
  commissionRevisions,
  paymentCommissions,
  saleCommissions,
} from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import {
  FinancialError,
  type FinancialSettlement,
} from "@mi-pasaporte/domain/financial";
import {
  add,
  exact,
  formatMinor,
  fromExact,
  minorRational,
  rational,
  subtract,
  toMinor,
} from "@mi-pasaporte/domain/financial/rational";
import {
  CommissionConfigurationError,
  calculatePaymentCommission,
  type ChargeShape,
} from "@mi-pasaporte/domain/financial/commission";
import type { PaymentMetadata } from "../module-events/types";
import type { ResourceCapture } from "../module-events/publish";

/** Domain outcomes are data. Database errors are deliberately never caught here. */
export async function freezeSaleCommission(
  tx: DbTransaction,
  args: {
    businessId: string;
    sourceProviderId: string;
    sourceOrderId: string;
    locationId: string;
    settlement: FinancialSettlement;
    paymentsMetadata: readonly PaymentMetadata[];
    capture: ResourceCapture;
    eventId: string | null;
  },
) {
  const { settlement } = args;
  const results = [];
  for (const payment of settlement.payments) {
    const metadata = args.paymentsMetadata.find(
      (p) => p.paymentId === payment.paymentId,
    )!;
    const refs = args.capture.versions.filter(
      (r) =>
        r.resourceType === "payment_method" &&
        r.resourceId === payment.methodId &&
        r.providerId === "core" &&
        r.slot === "commission",
    );
    const revisionId = refs[0]?.versionId ?? null;
    const [revision] = revisionId
      ? await tx
          .select()
          .from(commissionRevisions)
          .where(
            and(
              eq(commissionRevisions.businessId, args.businessId),
              eq(commissionRevisions.id, revisionId),
            ),
          )
      : [];
    let result;
    const invalid =
      refs.length > 1 ||
      (!!revisionId &&
        (!revision ||
          revision.methodId !== payment.methodId ||
          revision.chargeShape !== metadata.chargeShape));
    if (invalid) result = unavailable();
    else {
      // Only pure configuration decoding/calculation is converted into a marked outcome.
      // No query, INSERT or COMMIT is inside this catch.
      try {
        result = calculatePaymentCommission({
          amount: payment.amount,
          currencyCode: settlement.currencyCode,
          minorUnit: settlement.minorUnit,
          chargeShape: metadata.chargeShape as ChargeShape,
          percent: revision?.percent ?? null,
          originalFixed: revision?.originalFixed ?? null,
          fixedCurrencyCode: revision?.currencyCode ?? null,
        });
      } catch (error) {
        if (
          !(error instanceof FinancialError) &&
          !(error instanceof CommissionConfigurationError)
        )
          throw error;
        result = unavailable();
      }
    }
    await tx.insert(paymentCommissions).values({
      businessId: args.businessId,
      eventId: args.eventId,
      sourceProviderId: args.sourceProviderId,
      sourceOrderId: args.sourceOrderId,
      locationId: args.locationId,
      ...metadata,
      amount: payment.amount,
      currencyCode: settlement.currencyCode,
      minorUnit: settlement.minorUnit,
      commissionRevisionId: revisionId,
      percent: revision?.percent ?? null,
      originalFixed: revision?.originalFixed ?? null,
      fixedCurrencyCode: revision?.currencyCode ?? null,
      result,
    });
    results.push(result);
  }
  const reasons = [...new Set(results.flatMap((r) => r.reasons))];
  const known = results.every(
    (r) => r.commission !== null && r.originalCommission !== null,
  );
  const total = known
    ? results.reduce(
        (sum, r) =>
          sum + toMinor(fromExact(r.originalCommission!), settlement.minorUnit),
        0n,
      )
    : null;
  const original = known
    ? results.reduce(
        (sum, r) => add(sum, fromExact(r.originalCommission!)),
        rational(0n),
      )
    : null;
  await tx.insert(saleCommissions).values({
    businessId: args.businessId,
    sourceProviderId: args.sourceProviderId,
    sourceOrderId: args.sourceOrderId,
    locationId: args.locationId,
    collectedTotal: settlement.collected,
    currencyCode: settlement.currencyCode,
    minorUnit: settlement.minorUnit,
    state: reasons.length || !known ? "incompleto" : "completo",
    reasons,
    total: total === null ? null : formatMinor(total, settlement.minorUnit),
    originalTotal: original ? exact(original) : null,
    totalNormalizationAdjustment:
      total === null || !original
        ? null
        : exact(subtract(minorRational(total, settlement.minorUnit), original)),
  });
  if (
    total !== null &&
    results.every((result) => result.configured) &&
    args.paymentsMetadata.some((p) => p.chargeShape !== "none")
  )
    await appendModuleEvent(tx, {
      businessId: args.businessId,
      eventType: "sale.commission.frozen",
      eventVersion: 1,
      sourceId: args.sourceOrderId,
      locationId: args.locationId,
      payload: {
        eventVersion: 1,
        sourceOrderId: args.sourceOrderId,
        locationId: args.locationId,
        closedAt: new Date(args.capture.captured_at).toISOString(),
        amountMinor: String(total),
        currencyCode: settlement.currencyCode,
        minorUnit: settlement.minorUnit,
      },
    });
}
function unavailable() {
  return {
    commission: null,
    originalCommission: null,
    normalizationAdjustment: null,
    configured: false,
    reasons: ["commission_configuration_invalid"],
  };
}
