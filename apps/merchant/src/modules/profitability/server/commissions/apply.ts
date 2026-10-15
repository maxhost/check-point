import type { DbTransaction } from "@mi-pasaporte/db";
import {
  profitabilityCommissionRevisions as revisions,
  profitabilityPaymentCommissions as snapshots,
} from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { normalizeMoney } from "@mi-pasaporte/domain/financial";
import type { EventSubscription } from "../../../../server/module-events/types";
import {
  calculatePaymentCommission,
  type ChargeShape,
} from "../../commission-arithmetic";

export const commissionSubscriptions: readonly EventSubscription[] = [
  {
    eventType: "sale.closed",
    resourceType: "payment_method",
    slot: "commission",
    requiredModules: [],
    handler: async (tx, event) => {
      const payload = event.payload;
      if (payload.eventVersion === 1) return;
      for (const payment of payload.payments) {
        const captured = payment.resourceVersions.filter(
          (r) => r.providerId === "profitability" && r.slot === "commission",
        );
        if (captured.length > 1)
          throw new Error("Ambiguous commission reference");
        const revisionId = captured[0]?.versionId ?? null;
        const [revision] = revisionId
          ? await tx
              .select()
              .from(revisions)
              .where(
                and(
                  eq(revisions.businessId, event.businessId),
                  eq(revisions.id, revisionId),
                ),
              )
          : [];
        if (
          revisionId &&
          (!revision ||
            revision.methodProviderId !== payment.methodProviderId ||
            revision.methodId !== payment.methodId ||
            revision.chargeShape !== payment.chargeShape)
        )
          throw new Error("Captured commission revision unavailable");
        const result = calculatePaymentCommission({
          amount: payment.amount,
          currencyCode: payload.money.currencyCode,
          minorUnit: payload.money.minorUnit,
          chargeShape: payment.chargeShape as ChargeShape,
          percent: revision?.percent ?? null,
          originalFixed: revision?.originalFixed ?? null,
          fixedCurrencyCode: revision?.currencyCode ?? null,
        });
        const expected = {
          businessId: event.businessId,
          eventId: event.id,
          paymentId: payment.paymentId,
          sourceOrderId: payload.sourceOrderId,
          locationId: payload.locationId,
          methodProviderId: payment.methodProviderId,
          methodId: payment.methodId,
          methodName: payment.methodName,
          chargeShape: payment.chargeShape,
          amount: payment.amount,
          currencyCode: payload.money.currencyCode,
          minorUnit: payload.money.minorUnit,
          commissionRevisionId: revisionId,
          percent: revision?.percent ?? null,
          originalFixed: revision?.originalFixed ?? null,
          fixedCurrencyCode: revision?.currencyCode ?? null,
          result,
        };
        await persistPaymentCommission(tx, expected);
      }
    },
  },
];
export async function persistPaymentCommission(
  tx: DbTransaction,
  expected: typeof snapshots.$inferInsert,
) {
  await tx
    .insert(snapshots)
    .values(expected)
    .onConflictDoNothing({
      target: [snapshots.businessId, snapshots.eventId, snapshots.paymentId],
    });
  const [saved] = await tx
    .select()
    .from(snapshots)
    .where(
      and(
        eq(snapshots.businessId, expected.businessId),
        eq(snapshots.eventId, expected.eventId),
        eq(snapshots.paymentId, expected.paymentId),
      ),
    );
  if (!saved) throw new Error("Commission snapshot unavailable");
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    const actual =
      key === "amount"
        ? normalizeMoney(saved.amount, saved.minorUnit as 0 | 2)
        : saved[key];
    if (!isDeepStrictEqual(actual, expected[key]))
      throw new Error("Commission replay differs from frozen snapshot");
  }
}
