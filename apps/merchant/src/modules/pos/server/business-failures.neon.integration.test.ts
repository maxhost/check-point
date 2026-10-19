import * as publication from "../../../server/module-events/publish";
import { setResourceVersion } from "../../../server/module-events/publish";
import { scannedCustomer as seedScannedCustomer } from "../../../server/counter/coupon-cycle-support";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  consumerAccounts,
  users,
  sessions,
  commissionRevisions,
  moduleEvents,
  orders,
  paymentCommissions,
  paymentMethods,
  posOrders,
  posOrderPayments,
  saleCommissions,
} from "@mi-pasaporte/db/schema";
import {
  posIntegrationEnabled,
  dropPosWorld,
  type PosWorld,
} from "./pos-integration-support";

import {
  listPaymentMethods,
  createPaymentMethod,
} from "../../../server/business/payment-methods";
import { saveCommission } from "../../../server/business/commission-config";
import { readSaleCommissions } from "../../../server/business/commission-read";

import {
  world,
  other,
  close,
  setupBusinessWorld,
} from "./business-core-support";
const consumerIds: string[] = [];
async function scannedCustomer(target: PosWorld) {
  const customer = await seedScannedCustomer(target);
  consumerIds.push(customer.consumerId);
  return customer;
}
describe.skipIf(!posIntegrationEnabled)("0235 business-failures", () => {
  setupBusinessWorld({ posContract: 2 });
  afterAll(async () => {
    // The support's teardown is idempotent; ensure all owned business roots are gone first.
    for (const target of [world, other].filter(Boolean))
      await dropPosWorld(target);
    if (consumerIds.length) {
      await getDb()
        .delete(consumerAccounts)
        .where(inArray(consumerAccounts.id, consumerIds));
      expect(
        await getDb()
          .select({ id: consumerAccounts.id })
          .from(consumerAccounts)
          .where(inArray(consumerAccounts.id, consumerIds)),
      ).toEqual([]);
    }
    const owners = [world, other]
      .filter(Boolean)
      .map((target) => target.seed.userId);
    if (owners.length) {
      await getDb().delete(users).where(inArray(users.id, owners));
      expect(
        await getDb()
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, owners)),
      ).toEqual([]);
      expect(
        await getDb()
          .select({ id: sessions.id })
          .from(sessions)
          .where(inArray(sessions.userId, owners)),
      ).toEqual([]);
    }
  }, 240000);
  it("technical database write failure rolls back close, payment, header and accreditation", async () => {
    const cash = (await listPaymentMethods(world.seed.business.id))
      .defaultMethodId!;
    await getDb().execute(
      sql`create function core.qa_0235_fail() returns trigger language plpgsql as $$ begin raise exception 'induced database write failure' using errcode='40001'; end $$`,
    );
    await getDb().execute(
      sql`create trigger qa_0235_fail before insert on core.sale_commission for each row execute function core.qa_0235_fail()`,
    );
    const customer = await scannedCustomer(world);
    const before = await getDb()
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.businessId, world.seed.business.id));
    try {
      const { order, response } = await close(cash, "2.00", {
        membershipId: customer.membershipId,
      });
      expect(response.status).toBe(503);
      expect(
        (
          await getDb()
            .select()
            .from(posOrders)
            .where(eq(posOrders.id, order.id))
        )[0].status,
      ).toBe("open");
      expect(
        await getDb()
          .select()
          .from(posOrderPayments)
          .where(eq(posOrderPayments.posOrderId, order.id)),
      ).toHaveLength(0);
      expect(
        await getDb()
          .select()
          .from(saleCommissions)
          .where(eq(saleCommissions.sourceOrderId, order.id)),
      ).toHaveLength(0);
      expect(
        await getDb()
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.businessId, world.seed.business.id)),
      ).toEqual(before);
    } finally {
      await getDb().execute(
        sql`drop trigger qa_0235_fail on core.sale_commission`,
      );
      await getDb().execute(sql`drop function core.qa_0235_fail()`);
    }
  }, 120000);
  it("concurrent edit after shared capture cannot change the closed revision or publisher envelope", async () => {
    const method = await createPaymentMethod(world.seed.business.id, {
      name: "Capture race",
      chargeShape: "percent",
    });
    const a = await saveCommission(world.seed.business.id, method.id, {
      expectedRevisionId: null,
      percent: "2.5",
    });
    const capture = publication.captureSaleResources;
    let changed = false;
    const spy = vi
      .spyOn(publication, "captureSaleResources")
      .mockImplementation(async (tx, args) => {
        const frozen = await capture(tx, args);
        if (args.businessId === world.seed.business.id && !changed) {
          changed = true;
          await saveCommission(world.seed.business.id, method.id, {
            expectedRevisionId: a.revisionId,
            percent: "10",
          });
        }
        return frozen;
      });
    try {
      const sale = await close(method.id);
      expect(sale.response.status).toBe(200);
      expect(changed).toBe(true);
      const [row] = await getDb()
        .select()
        .from(paymentCommissions)
        .where(eq(paymentCommissions.sourceOrderId, sale.order.id));
      expect(row).toMatchObject({
        commissionRevisionId: a.revisionId,
        result: { commission: "0.05" },
      });
      const [event] = await getDb()
        .select()
        .from(moduleEvents)
        .where(eq(moduleEvents.sourceId, sale.order.id));
      expect(JSON.stringify(event.payload)).toContain(a.revisionId!);
    } finally {
      spy.mockRestore();
    }
  }, 120000);
  it("inconsistent captured reference persists a marked unknown commission without blocking close", async () => {
    const method = await createPaymentMethod(world.seed.business.id, {
      name: "Broken reference",
      chargeShape: "percent",
    });
    const { withDbTransaction } = await import("@mi-pasaporte/db");
    await withDbTransaction((tx) =>
      setResourceVersion(tx, {
        businessId: world.seed.business.id,
        resourceType: "payment_method",
        resourceId: method.id,
        providerId: "core",
        slot: "commission",
        versionId: randomUUID(),
      }),
    );
    const sale = await close(method.id);
    expect(sale.response.status).toBe(200);
    expect(
      await readSaleCommissions(
        world.seed.business.id,
        sale.order.id,
        world.seed.locationId,
        "pos",
      ),
    ).toMatchObject({
      total: null,
      state: "incompleto",
      reasons: ["commission_configuration_invalid"],
    });
  }, 120000);
  it("immutable revisions, outcomes and method identities remain protected", async () => {
    const [revision] = await getDb()
      .select()
      .from(commissionRevisions)
      .where(eq(commissionRevisions.businessId, world.seed.business.id));
    await expect(
      getDb()
        .update(commissionRevisions)
        .set({ percent: "99" })
        .where(eq(commissionRevisions.id, revision.id)),
    ).rejects.toThrow();
    await expect(
      getDb()
        .delete(commissionRevisions)
        .where(eq(commissionRevisions.id, revision.id)),
    ).rejects.toThrow();
    const [method] = await getDb()
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.businessId, world.seed.business.id));
    await expect(
      getDb()
        .update(paymentMethods)
        .set({ isCash: !method.isCash })
        .where(
          and(
            eq(paymentMethods.businessId, world.seed.business.id),
            eq(paymentMethods.id, method.id),
          ),
        ),
    ).rejects.toThrow();
  }, 120000);
});
