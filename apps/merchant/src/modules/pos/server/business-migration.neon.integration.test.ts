import { prepareLegacyStorage } from "./business-migration-support";
import { businessHttp } from "../../../server/business/http";
import { applyClaimedDelivery } from "../../../server/module-events/retry";
import { historicalHandlerKey } from "../../../server/business/historical-handler";
import {
  captureSaleResources,
  setResourceVersion,
} from "../../../server/module-events/publish";
import { freezeSaleCommission } from "../../../server/business/commission-close";
import { paymentMetadata } from "./settlement";
import {
  historicalEventHandlers,
  saleCommissions,
} from "@mi-pasaporte/db/schema";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { eq, inArray, sql } from "drizzle-orm";
import {
  paymentMethods,
  posOrderPayments,
  commissionRevisions,
  paymentCommissions,
  moduleEventDeliveries,
} from "@mi-pasaporte/db/schema";
import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import {
  seedPosWorld,
  dropPosWorld,
  openOrder,
  pos,
  posIntegrationEnabled,
  type PosWorld,
} from "./pos-integration-support";
import { paymentMethodsForClose } from "./payment-methods";
import { persistPaymentSnapshot } from "./settlement";
const run = describe.skipIf(!posIntegrationEnabled);
const worlds: PosWorld[] = [];
const migration = (name: string) =>
  readFileSync(
    new URL(
      `../../../../../../packages/db/drizzle/${name}.sql`,
      import.meta.url,
    ),
    "utf8",
  );
run("0235 physical schema transition (isolated DDL with rollback)", () => {
  beforeAll(async () => {
    for (const country of ["EC", "EC", "CO", "CO"])
      worlds.push(await seedPosWorld("N migration", country));
  }, 240000);
  afterAll(async () => {
    for (const world of worlds) await dropPosWorld(world);
  }, 240000);
  it("0093 intermediate keeps POS GET/close core alive while administration waits for0094", async () => {
    const mapping = await getDb().select().from(historicalEventHandlers);
    await getDb().execute(
      sql`alter table core.historical_event_handler drop column source_provider_id`,
    );
    try {
      const world = worlds[3];
      const response = await (
        await import("../../modules-integration-support")
      ).callModuleRoute(
        "GET",
        "/api/modules/pos/payment-methods",
        world.ownerCookie,
      );
      expect(response.status).toBe(200);
      const methods = await response.json();
      const order = await openOrder(world, [
        { productId: world.cafe, quantity: 1 },
      ]);
      const close = await pos.close(world.ownerCookie, order.id, {
        clientRequestId: randomUUID(),
        version: order.version,
        payments: [{ methodId: methods.defaultMethodId, amount: "2.00" }],
      });
      expect(close.status).toBe(200);
      expect(
        (
          await getDb()
            .select()
            .from(saleCommissions)
            .where(eq(saleCommissions.sourceOrderId, order.id))
        )[0],
      ).toMatchObject({ state: "completo", total: "0.00" });
      const business = await businessHttp(
        new Request("http://localhost:3001/api/business/payment-methods", {
          headers: { cookie: world.ownerCookie },
        }),
        ["payment-methods"],
      );
      expect(business.status).toBe(503);
      expect(await business.json()).toMatchObject({
        code: "business_unavailable",
      });
    } finally {
      await getDb().execute(
        sql`alter table core.historical_event_handler add column source_provider_id text`,
      );
      for (const row of mapping)
        await getDb().execute(
          sql`update core.historical_event_handler set source_provider_id=${row.sourceProviderId} where subscriber_id=${row.subscriberId} and event_type=${row.eventType}`,
        );
      await getDb().execute(
        sql`alter table core.historical_event_handler alter column source_provider_id set not null`,
      );
    }
  }, 120000);
  it("bridge reads both sides; preserves22 method IDs and2 legacy payment IDs/provider, OIDs, FK and trigger functions", async () => {
    const ids = worlds.map((w) => w.seed.business.id);
    const before = await getDb()
      .select()
      .from(paymentMethods)
      .where(inArray(paymentMethods.businessId, ids));
    expect(before).toHaveLength(22);
    const opened: Awaited<ReturnType<typeof openOrder>>[] = [];
    for (const world of worlds.slice(0, 3))
      opened.push(
        await openOrder(world, [{ productId: world.cafe, quantity: 1 }]),
      );
    const rollback = new Error("rollback-0235-migration");
    await expect(
      withDbTransaction(async (tx) => {
        const {
          paymentIds,
          oids,
          legacy,
          pending,
          subscriber,
          oldRateId,
          newRateId,
          legacyEventId,
          rateMethod,
        } = await prepareLegacyStorage(tx, worlds, opened, before);
        for (const name of [
          "0093_negocio_core",
          "0094_historical_commission_source",
          "0095_commission_total_precision",
        ])
          for (const statement of migration(name).split(
            "--> statement-breakpoint",
          ))
            if (statement.trim()) await tx.execute(sql.raw(statement));
        expect(await historicalHandlerKey(tx, subscriber, "sale.closed")).toBe(
          "commission_snapshot",
        );
        await tx.insert(commissionRevisions).values({
          id: newRateId,
          businessId: ids[0],
          methodProviderId: "core",
          methodId: rateMethod.id,
          chargeShape: "percent",
          percent: "50",
        });
        await setResourceVersion(tx, {
          businessId: ids[0],
          resourceType: "payment_method",
          resourceId: rateMethod.id,
          providerId: "core",
          slot: "commission",
          versionId: newRateId,
        });
        const token = randomUUID();
        await tx
          .update(moduleEventDeliveries)
          .set({
            state: "processing",
            claimToken: token,
            claimUntil: new Date(Date.now() + 30000),
            attempts: 1,
          })
          .where(eq(moduleEventDeliveries.id, pending.id));
        await applyClaimedDelivery(
          tx,
          {
            id: pending.id,
            event_id: legacyEventId,
            subscriber_id: subscriber,
          },
          token,
        );
        expect(
          (
            await tx
              .select()
              .from(moduleEventDeliveries)
              .where(eq(moduleEventDeliveries.id, pending.id))
          )[0],
        ).toMatchObject({ state: "applied", claimToken: null, attempts: 1 });
        const frozen = await tx
          .select()
          .from(paymentCommissions)
          .where(eq(paymentCommissions.eventId, legacyEventId));
        expect(frozen[0]).toMatchObject({
          commissionRevisionId: oldRateId,
          percent: "2.500000",
          result: { commission: "0.05" },
        });
        const newest = opened[2],
          newWorld = worlds[2],
          newMethod = before.find((m) => m.businessId === ids[2] && m.isCash)!;
        const currentMethods = await paymentMethodsForClose(tx, ids[2], [
          newMethod.id,
        ]);
        const newSettlement = buildFinancialSettlement({
          currencyCode: "USD",
          lines: [
            {
              sourceLineId: newest.items[0].lineId,
              position: 0,
              unitPrice: "2.00",
              quantity: 1,
            },
          ],
          discount: null,
          payments: [
            { paymentId: randomUUID(), methodId: newMethod.id, amount: "2.00" },
          ],
        });
        await persistPaymentSnapshot(
          tx,
          ids[2],
          newest.id,
          newSettlement,
          currentMethods,
          "core",
        );
        await freezeSaleCommission(tx, {
          businessId: ids[2],
          sourceProviderId: "pos",
          sourceOrderId: newest.id,
          locationId: newWorld.seed.locationId,
          settlement: newSettlement,
          paymentsMetadata: paymentMetadata(
            newSettlement,
            currentMethods,
            "core",
          ),
          capture: await captureSaleResources(tx, {
            businessId: ids[2],
            settlement: newSettlement,
            lines: [],
          }),
          eventId: null,
        });
        expect(
          (
            await tx
              .select()
              .from(posOrderPayments)
              .where(eq(posOrderPayments.posOrderId, newest.id))
          )[0].methodProviderId,
        ).toBe("core");
        const moved = await tx
          .select()
          .from(paymentMethods)
          .where(inArray(paymentMethods.businessId, ids));
        expect(moved.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
          before.sort((a, b) => a.id.localeCompare(b.id)),
        );
        expect(
          await tx
            .select()
            .from(posOrderPayments)
            .where(inArray(posOrderPayments.id, paymentIds)),
        ).toEqual(legacy);
        expect(legacy.map((p) => p.methodProviderId)).toEqual(["pos", "pos"]);
        const after = await tx.execute(
          sql`select 'core.payment_method'::regclass::oid::text as methods,'pos.order_payment'::regclass::oid::text as payments`,
        );
        expect(after.rows).toEqual(oids.rows);
        for (let i = 0; i < 2; i++)
          expect(
            await paymentMethodsForClose(tx, worlds[i].seed.business.id, [
              legacy[i].methodId,
            ]),
          ).toHaveProperty("size", 1);
        const dependencies = await tx.execute(
          sql`select pn.nspname as schema from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace pn on pn.oid=p.pronamespace where t.tgrelid in ('core.payment_method'::regclass,'core.commission_revision'::regclass,'core.payment_commission'::regclass,'core.sale_commission'::regclass) and not t.tgisinternal`,
        );
        expect(dependencies.rows.length).toBe(4);
        expect(dependencies.rows.every((r) => r.schema === "core")).toBe(true);
        const foreignKeys = await tx.execute(
          sql`select confrelid::regclass::text as target from pg_constraint where conrelid='pos.order_payment'::regclass and conname='pos_payment_method_fk'`,
        );
        expect(foreignKeys.rows).toEqual([{ target: "core.payment_method" }]);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  }, 180000);
});
