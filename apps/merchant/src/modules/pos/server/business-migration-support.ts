import {
  captureSaleResources,
  setResourceVersion,
} from "../../../server/module-events/publish";

import { randomUUID } from "node:crypto";

import { expect } from "vitest";
import { withDbTransaction } from "@mi-pasaporte/db";
import { eq, inArray, sql } from "drizzle-orm";
import {
  paymentMethods,
  posOrderPayments,
  posOrders,
  moduleEvents,
  moduleEventDeliveries,
} from "@mi-pasaporte/db/schema";
import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import { openOrder, type PosWorld } from "./pos-integration-support";
import { paymentMethodsForClose } from "./payment-methods";
import { persistPaymentSnapshot } from "./settlement";

export async function prepareLegacyStorage(
  tx: Parameters<Parameters<typeof withDbTransaction>[0]>[0],
  worlds: PosWorld[],
  opened: Awaited<ReturnType<typeof openOrder>>[],
  before: (typeof paymentMethods.$inferSelect)[],
) {
  const ids = worlds.map((w) => w.seed.business.id);
  await tx.execute(sql`select pg_advisory_xact_lock(2350150)`);
  const mapping = await tx.execute(
    sql`select subscriber_id from core.historical_event_handler where handler_key='commission_snapshot'`,
  );
  const subscriber = String(mapping.rows[0].subscriber_id);

  // Reconstruct the pre-cut location inside a transaction that is always rolled back.
  await tx.execute(
    sql`drop table core.sale_commission,core.business_configuration,core.historical_event_handler`,
  );
  await tx.execute(
    sql`alter function core.p1_method_identity() set schema pos`,
  );
  await tx.execute(
    sql`alter function core.p1_immutable() set schema profitability`,
  );
  await tx.execute(
    sql`alter table core.payment_commission drop column source_provider_id`,
  );
  await tx.execute(sql`alter table core.payment_method set schema pos`);
  await tx.execute(
    sql`alter table core.payment_method_initialization set schema pos`,
  );
  await tx.execute(
    sql`alter table core.commission_revision set schema profitability`,
  );
  await tx.execute(
    sql`alter table core.payment_commission set schema profitability`,
  );
  const oids = await tx.execute(
    sql`select 'pos.payment_method'::regclass::oid::text as methods,'pos.order_payment'::regclass::oid::text as payments`,
  );
  const paymentIds = [];
  for (let i = 0; i < 2; i++) {
    const world = worlds[i],
      order = opened[i],
      method = before.find(
        (m) => m.businessId === world.seed.business.id && m.isCash,
      )!;
    const methods = await paymentMethodsForClose(tx, world.seed.business.id, [
      method.id,
    ]);
    expect(methods.get(method.id)?.name).toBe("Efectivo");
    const paymentId = randomUUID();
    paymentIds.push(paymentId);
    const settlement = buildFinancialSettlement({
      currencyCode: "USD",
      lines: [
        {
          sourceLineId: order.items[0].lineId,
          position: 0,
          unitPrice: "2.00",
          quantity: 1,
        },
      ],
      discount: null,
      payments: [{ paymentId, methodId: method.id, amount: "2.00" }],
    });
    await persistPaymentSnapshot(
      tx,
      world.seed.business.id,
      order.id,
      settlement,
      methods,
      "pos",
    );
    await tx
      .update(posOrders)
      .set({
        status: "closed",
        closedAt: new Date(),
        closedByUserId: world.seed.userId,
        closeRequestId: randomUUID(),
        settlement,
      })
      .where(eq(posOrders.id, order.id));
  }
  const oldRateId = randomUUID(),
    newRateId = randomUUID(),
    legacyEventId = randomUUID();
  const rateMethod = before.find(
    (m) =>
      m.businessId === worlds[0].seed.business.id &&
      m.chargeShape === "percent",
  )!;
  await tx.execute(
    sql`insert into profitability.commission_revision(id,business_id,method_provider_id,method_id,charge_shape,percent) values (${oldRateId}::uuid,${ids[0]}::uuid,'pos',${rateMethod.id}::uuid,'percent',2.5)`,
  );
  await setResourceVersion(tx, {
    businessId: ids[0],
    resourceType: "payment_method",
    resourceId: rateMethod.id,
    providerId: subscriber,
    slot: "commission",
    versionId: oldRateId,
  });
  const oldSettlement = buildFinancialSettlement({
    currencyCode: "USD",
    lines: [
      {
        sourceLineId: randomUUID(),
        position: 0,
        unitPrice: "2.00",
        quantity: 1,
      },
    ],
    discount: null,
    payments: [
      {
        paymentId: randomUUID(),
        methodId: rateMethod.id,
        amount: "2.00",
      },
    ],
  });
  const oldCapture = await captureSaleResources(tx, {
    businessId: ids[0],
    settlement: oldSettlement,
    lines: [],
  });
  const oldMetadata = {
    paymentId: oldSettlement.payments[0].paymentId,
    methodId: rateMethod.id,
    methodProviderId: "pos",
    methodName: rateMethod.name,
    chargeShape: "percent" as const,
  };
  const legacyPayload = {
    eventVersion: 2 as const,
    sourceOrderId: randomUUID(),
    locationId: worlds[0].seed.locationId,
    closedAt: new Date().toISOString(),
    userId: worlds[0].seed.userId,
    money: {
      gross: oldSettlement.gross,
      discount: oldSettlement.discount,
      roundingAdjustment: oldSettlement.roundingAdjustment,
      collected: oldSettlement.collected,
      currencyCode: "USD",
      minorUnit: 2 as const,
      originalGross: oldSettlement.originals.gross,
      originalDiscount: oldSettlement.originals.discount,
      originalNet: oldSettlement.originals.net,
      normalizationAdjustments: oldSettlement.normalizationAdjustments,
    },
    lines: oldSettlement.lines.map((l) => ({
      sourceLineId: l.sourceLineId,
      productId: null,
      quantity: 1,
      position: l.position,
      money: l.money,
      discountOrigin: l.discountOrigin,
      resourceVersions: [],
    })),
    payments: oldSettlement.payments.map((p) => ({
      ...p,
      ...oldMetadata,
      resourceVersions: oldCapture.versions
        .filter((r) => r.slot === "commission")
        .map(({ providerId, slot, versionId }) => ({
          providerId,
          slot,
          versionId,
        })),
    })),
    paymentOriginals: oldSettlement.paymentOriginals,
  };
  await tx.insert(moduleEvents).values({
    id: legacyEventId,
    businessId: ids[0],
    eventType: "sale.closed",
    eventVersion: 2,
    sourceId: legacyPayload.sourceOrderId,
    locationId: worlds[0].seed.locationId,
    payload: legacyPayload,
  });
  const [pending] = await tx
    .insert(moduleEventDeliveries)
    .values({
      eventId: legacyEventId,
      subscriberId: subscriber,
      state: "pending",
    })
    .returning();
  const legacy = await tx
    .select()
    .from(posOrderPayments)
    .where(inArray(posOrderPayments.id, paymentIds));
  return {
    ids,
    paymentIds,
    oids,
    legacy,
    pending,
    subscriber,
    oldRateId,
    newRateId,
    legacyEventId,
    rateMethod,
  };
}
