import { createHash } from "node:crypto";
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
  originalMoney,
  allocateCumulative,
} from "@mi-pasaporte/domain/financial/rational";
import {
  CommissionConfigurationError,
  calculatePaymentCommission,
  type ChargeShape,
} from "@mi-pasaporte/domain/financial/commission";
import type { PaymentMetadata } from "../module-events/types";
import type { ResourceCapture } from "../module-events/publish";

export type SaleCommissionInput = {
  businessId: string;
  sourceProviderId: string;
  sourceOrderId: string;
  locationId: string;
  settlement: FinancialSettlement;
  paymentsMetadata: readonly PaymentMetadata[];
  capture: ResourceCapture;
};
export type PreparedSaleCommission = Readonly<{
  lineCommissions: Readonly<Record<string, string | null>>;
}>;
type PreparedData = {
  binding: string;
  payments: (typeof paymentCommissions.$inferInsert)[];
  sale: typeof saleCommissions.$inferInsert;
  total: bigint | null;
  configured: boolean;
};
const preparedSnapshots = new WeakMap<PreparedSaleCommission, PreparedData>();
const binding = (a: SaleCommissionInput) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        businessId: a.businessId,
        sourceProviderId: a.sourceProviderId,
        sourceOrderId: a.sourceOrderId,
        locationId: a.locationId,
        settlement: a.settlement,
        paymentsMetadata: a.paymentsMetadata,
        capture: a.capture,
      }),
    )
    .digest("hex");
/** Allocate every frozen cent across all lines, before applying any cost-coverage filter. */
export function allocateLineCommissions(
  total: bigint | null,
  lines: FinancialSettlement["lines"],
): Readonly<Record<string, string | null>> {
  const ordered = [...lines].sort(
    (a, b) =>
      a.position - b.position || a.sourceLineId.localeCompare(b.sourceLineId),
  );
  const amounts =
    total === null
      ? null
      : allocateCumulative(
          total,
          ordered.map((line) => exact(originalMoney(line.money.net))),
        );
  return Object.freeze(
    Object.fromEntries(
      ordered.map((line, index) => [
        line.sourceLineId,
        amounts === null ? null : String(amounts[index]),
      ]),
    ),
  );
}
/** Read only immutable captured configuration; prepare once before publishing the sale. */
export async function prepareSaleCommission(
  tx: DbTransaction,
  args: SaleCommissionInput,
): Promise<PreparedSaleCommission> {
  const payments: (typeof paymentCommissions.$inferInsert)[] = [];
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
    payments.push({
      businessId: args.businessId,
      eventId: null,
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
  const sale: typeof saleCommissions.$inferInsert = {
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
  };
  const configured = results.every((result) => result.configured);
  const prepared = Object.freeze({
    lineCommissions: allocateLineCommissions(
      known && configured ? total : null,
      settlement.lines,
    ),
  });
  preparedSnapshots.set(prepared, {
    binding: binding(args),
    payments,
    sale,
    total,
    configured,
  });
  return prepared;
}
/** Persist exactly the prepared snapshot and its event in the origin transaction. */
export async function freezeSaleCommission(
  tx: DbTransaction,
  args: SaleCommissionInput & { eventId: string | null },
  prepared?: PreparedSaleCommission,
) {
  const snapshot = prepared ?? (await prepareSaleCommission(tx, args));
  const data = preparedSnapshots.get(snapshot);
  if (!data || data.binding !== binding(args))
    throw new Error("Prepared commission does not match origin");
  if (data.payments.length)
    await tx
      .insert(paymentCommissions)
      .values(data.payments.map((row) => ({ ...row, eventId: args.eventId })));
  await tx.insert(saleCommissions).values(data.sale);
  const { settlement } = args;
  const { total, configured } = data;
  if (
    total !== null &&
    configured &&
    args.paymentsMetadata.some((p) => p.chargeShape !== "none")
  )
    await appendModuleEvent(tx, {
      businessId: args.businessId,
      eventType: "sale.commission.frozen",
      causationEventId: args.eventId ?? undefined,
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
