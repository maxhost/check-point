import {
  world,
  subscriber,
  source,
  eventFor,
  seedAppliedHistory,
  setupRetirementWorld,
} from "./pos/server/retirement-integration-support";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  moduleEventDeliveries,
  paymentMethods,
  paymentMethodInitializations,
  posOrderPayments,
  posOrders,
  saleCommissions,
  paymentCommissions,
  commissionRevisions,
} from "@mi-pasaporte/db/schema";
import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import { SERVER_MODULES } from "./server-registry";
import {
  openOrder,
  pos,
  posStaff,
  seedProduct,
  posIntegrationEnabled,
} from "./pos/server/pos-integration-support";
import { callModuleRoute } from "./modules-integration-support";
import {
  listPaymentMethods,
  archivePaymentMethod,
} from "../server/business/payment-methods";
import { readSaleCommissions } from "../server/business/commission-read";
import { applyClaimedDelivery } from "../server/module-events/retry";
const preflightSql = readFileSync(
  new URL("../server/business/retirement-preflight.sql", import.meta.url),
  "utf8",
);
const preflight = async () =>
  (await getDb().execute(sql.raw(preflightSql))).rows[0];
describe.skipIf(!posIntegrationEnabled)(
  "0235 conditioned post-drain retirement",
  () => {
    setupRetirementWorld();
    it("POS activation cannot initialize or resurrect methods; only settlement metadata remains modular", async () => {
      const first = await listPaymentMethods(world.seed.business.id, "all");
      const method = first.methods.find((m) => !m.isCash)!;
      await archivePaymentMethod(world.seed.business.id, method.id);
      const before = await getDb()
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.businessId, world.seed.business.id));
      const marker = await getDb()
        .select()
        .from(paymentMethodInitializations)
        .where(
          eq(paymentMethodInitializations.businessId, world.seed.business.id),
        );
      expect(SERVER_MODULES.pos.onEnable).toBeUndefined();
      expect(
        SERVER_MODULES.pos.resourceProviders?.map((p) => p.resourceType),
      ).toEqual(["sale_settlement"]);
      expect((await pos.setModule(world.ownerCookie, false)).status).toBe(200);
      expect((await pos.setModule(world.ownerCookie, true)).status).toBe(200);
      expect(
        await getDb()
          .select()
          .from(paymentMethods)
          .where(eq(paymentMethods.businessId, world.seed.business.id)),
      ).toEqual(before);
      expect(
        await getDb()
          .select()
          .from(paymentMethodInitializations)
          .where(
            eq(paymentMethodInitializations.businessId, world.seed.business.id),
          ),
      ).toEqual(marker);
    }, 120000);
    it("POS-only operator keeps selector metadata and closes with core results when event publication is OFF", async () => {
      const staff = await posStaff(world, ["pos"]);
      const response = await callModuleRoute(
        "GET",
        "/api/modules/pos/payment-methods",
        staff.cookie,
      );
      expect(response.status).toBe(200);
      const methods = await response.json();
      expect(
        methods.methods.every(
          (m: Record<string, unknown>) => !Object.hasOwn(m, "commission"),
        ),
      ).toBe(true);
      const order = await openOrder(world, [
        { productId: world.cafe, quantity: 1 },
      ]);
      expect(
        (
          await pos.close(staff.cookie, order.id, {
            clientRequestId: randomUUID(),
            version: order.version,
            payments: [{ methodId: methods.defaultMethodId, amount: "2.00" }],
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await getDb()
            .select()
            .from(posOrderPayments)
            .where(eq(posOrderPayments.posOrderId, order.id))
        )[0],
      ).toMatchObject({ methodProviderId: "core" });
      expect(
        (
          await getDb()
            .select()
            .from(saleCommissions)
            .where(eq(saleCommissions.sourceOrderId, order.id))
        )[0],
      ).toMatchObject({ state: "completo", total: "0.00" });
      expect(
        await readSaleCommissions(
          world.seed.business.id,
          order.id,
          world.seed.locationId,
          source,
        ),
      ).toMatchObject({ state: "completo", total: "0.00" });
    }, 120000);
    it("historical canonical zero is readable without a header while absent/foreign evidence never manufactures zero", async () => {
      const free = await seedProduct(world, "Historical free", "0.00");
      const order = await openOrder(world, [{ productId: free, quantity: 1 }]);
      const settlement = buildFinancialSettlement({
        currencyCode: "USD",
        lines: [
          {
            sourceLineId: order.items[0].lineId,
            position: 0,
            unitPrice: "0.00",
            quantity: 1,
          },
        ],
        discount: null,
        payments: [],
      });
      await getDb()
        .update(posOrders)
        .set({ status: "closed", closedAt: new Date(), settlement })
        .where(eq(posOrders.id, order.id));
      expect(
        await readSaleCommissions(
          world.seed.business.id,
          order.id,
          world.seed.locationId,
          source,
        ),
      ).toMatchObject({ state: "completo", total: "0.00", payments: [] });
      expect(
        await readSaleCommissions(
          world.seed.business.id,
          randomUUID(),
          world.seed.locationId,
          source,
        ),
      ).toMatchObject({ state: "incompleto", total: null });
      expect(
        await readSaleCommissions(
          world.seed.business.id,
          order.id,
          world.seed.locationId,
          "unrelated",
        ),
      ).toMatchObject({ total: null });
    }, 120000);
    it("already-applied historical commission and frozen IDs survive without any application handler", async () => {
      const { old, revision, snapshot } = await seedAppliedHistory();
      const before = await readSaleCommissions(
        world.seed.business.id,
        old.sourceOrderId,
        world.seed.locationId,
        source,
      );
      expect(before).toMatchObject({
        state: "completo",
        total: "0.06",
        reasons: [],
      });
      expect(SERVER_MODULES[subscriber]?.eventSubscriptions).toBeUndefined();
      expect(
        await getDb()
          .select()
          .from(paymentCommissions)
          .where(eq(paymentCommissions.id, snapshot.id)),
      ).toEqual([snapshot]);
      expect(
        (
          await getDb()
            .select()
            .from(commissionRevisions)
            .where(eq(commissionRevisions.id, revision.id))
        )[0],
      ).toEqual(revision);
    }, 120000);
    it("read-only retirement precondition detects a failed pending attempt and unresolved claim; missing handler cannot ACK or erase them", async () => {
      const old = await eventFor();
      const [pending] = await getDb()
        .insert(moduleEventDeliveries)
        .values({
          eventId: old.eventId,
          subscriberId: subscriber,
          state: "pending",
          diagnostic: "application_failed",
          attempts: 1,
        })
        .returning();
      const check = await preflight();
      expect(check.schema_ready).toBe(true);
      expect(check.database_ready_for_retirement).toBe(false);
      expect(check.unresolved_deliveries).toBeGreaterThanOrEqual(1);
      expect(check.failed_attempts).toBeGreaterThanOrEqual(1);
      expect(
        (
          await getDb()
            .select()
            .from(moduleEventDeliveries)
            .where(eq(moduleEventDeliveries.id, pending.id))
        )[0],
      ).toEqual(pending);
      const claimed = await eventFor();
      const token = randomUUID();
      const [claim] = await getDb()
        .insert(moduleEventDeliveries)
        .values({
          eventId: claimed.eventId,
          subscriberId: subscriber,
          state: "processing",
          claimToken: token,
          claimUntil: new Date(Date.now() + 30000),
          attempts: 1,
        })
        .returning();
      await expect(
        withDbTransaction((tx) =>
          applyClaimedDelivery(
            tx,
            {
              id: claim.id,
              event_id: claim.eventId,
              subscriber_id: claim.subscriberId,
            },
            token,
          ),
        ),
      ).rejects.toThrow("Subscriber unavailable");
      const after = await preflight();
      expect(after.database_ready_for_retirement).toBe(false);
      expect(after.unresolved_claims).toBeGreaterThanOrEqual(1);
      expect(
        (
          await getDb()
            .select()
            .from(moduleEventDeliveries)
            .where(eq(moduleEventDeliveries.id, claim.id))
        )[0],
      ).toEqual(claim);
      expect(
        await getDb()
          .select()
          .from(paymentCommissions)
          .where(
            and(
              eq(paymentCommissions.eventId, claimed.eventId),
              eq(paymentCommissions.businessId, world.seed.business.id),
            ),
          ),
      ).toEqual([]);
    }, 120000);
  },
);
