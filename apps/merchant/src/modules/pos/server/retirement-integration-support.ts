import { randomUUID } from "node:crypto";
import { beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  historicalEventHandlers,
  commissionRevisions,
  paymentCommissions,
  moduleEventDeliveries,
} from "@mi-pasaporte/db/schema";
import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import { calculatePaymentCommission } from "@mi-pasaporte/domain/financial/commission";
import {
  seedPosWorld,
  dropPosWorld,
  type PosWorld,
} from "./pos-integration-support";
import { listPaymentMethods } from "../../../server/business/payment-methods";
import {
  publishSaleClosed,
  captureSaleResources,
  setResourceVersion,
} from "../../../server/module-events/publish";
export let world: PosWorld, subscriber: string, source: string;
export async function eventFor(amount = "2.00") {
  const method = (
    await listPaymentMethods(world.seed.business.id)
  ).methods.find((m) => m.chargeShape === "percent")!;
  const sourceOrderId = randomUUID(),
    lineId = randomUUID();
  const settlement = buildFinancialSettlement({
    currencyCode: "USD",
    lines: [
      { sourceLineId: lineId, position: 0, unitPrice: amount, quantity: 1 },
    ],
    discount: null,
    payments: [{ paymentId: randomUUID(), methodId: method.id, amount }],
  });
  const metadata = {
    paymentId: settlement.payments[0].paymentId,
    methodId: method.id,
    methodProviderId: source,
    methodName: method.name,
    chargeShape: method.chargeShape,
  };
  const event = await withDbTransaction(async (tx) => {
    const capture = await captureSaleResources(tx, {
      businessId: world.seed.business.id,
      settlement,
      lines: [{ productId: null }],
    });
    return publishSaleClosed(tx, {
      businessId: world.seed.business.id,
      sourceOrderId,
      locationId: world.seed.locationId,
      closedAt: new Date(),
      userId: world.seed.userId,
      settlement,
      paymentsMetadata: [metadata],
      capture,
      lines: [{ sourceLineId: lineId, productId: null, quantity: 1 }],
    });
  });
  return {
    eventId: event!.eventId,
    sourceOrderId,
    settlement,
    metadata,
    method,
  };
}

export function setupRetirementWorld() {
  beforeAll(async () => {
    world = await seedPosWorld("N retired");
    const [mapping] = await getDb()
      .select()
      .from(historicalEventHandlers)
      .where(eq(historicalEventHandlers.handlerKey, "commission_snapshot"));
    subscriber = mapping.subscriberId;
    source = mapping.sourceProviderId;
  }, 240000);
  afterAll(async () => {
    await dropPosWorld(world);
  }, 240000);
}
export async function seedAppliedHistory() {
  const method = (
    await listPaymentMethods(world.seed.business.id)
  ).methods.find((m) => m.chargeShape === "percent")!;
  const [revision] = await getDb()
    .insert(commissionRevisions)
    .values({
      businessId: world.seed.business.id,
      methodProviderId: source,
      methodId: method.id,
      chargeShape: "percent",
      percent: "3",
    })
    .returning();
  await withDbTransaction((tx) =>
    setResourceVersion(tx, {
      businessId: world.seed.business.id,
      resourceType: "payment_method",
      resourceId: method.id,
      providerId: subscriber,
      slot: "commission",
      versionId: revision.id,
    }),
  );
  const old = await eventFor();
  // This fixture begins as history already applied before cutover; it never had a pending row.
  const result = calculatePaymentCommission({
    amount: "2.00",
    currencyCode: "USD",
    minorUnit: 2,
    chargeShape: "percent",
    percent: "3",
    originalFixed: null,
    fixedCurrencyCode: null,
  });
  const [snapshot] = await getDb()
    .insert(paymentCommissions)
    .values({
      businessId: world.seed.business.id,
      eventId: old.eventId,
      sourceProviderId: source,
      sourceOrderId: old.sourceOrderId,
      locationId: world.seed.locationId,
      ...old.metadata,
      amount: "2.00",
      currencyCode: "USD",
      minorUnit: 2,
      commissionRevisionId: revision.id,
      percent: "3",
      result,
    })
    .returning();
  await getDb().insert(moduleEventDeliveries).values({
    eventId: old.eventId,
    subscriberId: subscriber,
    state: "applied",
    appliedAt: new Date(),
  });
  return { old, revision, snapshot };
}
