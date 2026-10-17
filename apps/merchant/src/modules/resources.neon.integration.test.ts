import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { and, eq } from "drizzle-orm";
import {
  businessModules,
  businesses,
  moduleResourceVersions,
  paymentMethodCatalog,
  paymentMethods,
  paymentCommissions as snapshots,
  commissionRevisions as revisions,
} from "@mi-pasaporte/db/schema";
import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import {
  seedModuleWorld,
  dropModuleWorld,
  enableModules,
  moduleStaff,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "./modules-integration-support";
import { SERVER_MODULES } from "./server-registry";
import type { ModuleServer, ModuleResource } from "./route-table";
import { setModuleEnabled } from "./activation";
import {
  publishSaleClosed,
  retryModuleEvents,
  setResourceVersion,
} from "../server/module-events";
import {
  saveCommission,
  listCommissions,
} from "../server/business/commission-config";
import { readSaleCommissions as readCoreSaleCommissions } from "../server/business/commission-read";
const readSaleCommissions = (
  businessId: string,
  id: unknown,
  location: unknown,
) => readCoreSaleCommissions(businessId, id, location, "pos");
import { businessHttp } from "../server/business/http";
import { freezeSaleCommission } from "../server/business/commission-close";
import { captureSaleResources } from "../server/module-events/publish";
let world: ModuleWorld, other: ModuleWorld;
const providerId = "core",
  registry = SERVER_MODULES as Record<string, ModuleServer>;
const methodIds = {
  none: randomUUID(),
  percent: randomUUID(),
  fixed: randomUUID(),
  mixed: randomUUID(),
};
const methods = new Map<string, ModuleResource[]>(),
  settlements = new Map<string, ModuleResource>();
beforeAll(async () => {
  world = await seedModuleWorld("P1 commissions");
  other = await seedModuleWorld("P1 other");
  await enableModules(world, ["expenses"]);
  await enableModules(other, ["expenses"]);
  methods.set(
    world.businessId,
    Object.entries(methodIds).map(([shape, resourceId]) => ({
      resourceId,
      metadata: {
        name: shape,
        status: "active",
        chargeShape: shape === "mixed" ? "percent_and_fixed" : shape,
      },
    })),
  );
  methods.set(other.businessId, [
    {
      resourceId: randomUUID(),
      metadata: { name: "Foreign", status: "active", chargeShape: "percent" },
    },
  ]);
  for (const owner of [world, other])
    await getDb()
      .insert(paymentMethods)
      .values(
        methods.get(owner.businessId)!.map((m) => ({
          id: m.resourceId,
          businessId: owner.businessId,
          name: String(m.metadata.name),
          chargeShape: String(m.metadata.chargeShape),
        })),
      );
  registry[providerId] = {
    routes: [],
    resourceProviders: [
      {
        resourceType: "sale_settlement",
        read: async (_tx, businessId, ids) =>
          ids.flatMap((id) => {
            const r = settlements.get(businessId + "/" + id);
            return r ? [r] : [];
          }),
      },
    ],
  };
}, 120000);
afterAll(async () => {
  delete registry[providerId];
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}, 120000);
async function sale(
  payments = [{ methodId: methodIds.mixed, amount: "9.00" }],
  price = "9.00",
) {
  const sourceOrderId = randomUUID(),
    sourceLineId = randomUUID();
  const settlement = buildFinancialSettlement({
    currencyCode: "USD",
    lines: [{ sourceLineId, position: 0, unitPrice: price, quantity: 1 }],
    discount: null,
    payments: payments.map((p) => ({ ...p, paymentId: randomUUID() })),
  });
  const event = await withDbTransaction(async (tx) => {
    const lines = [{ sourceLineId, productId: null, quantity: 1 }];
    const paymentsMetadata = settlement.payments.map((p) => {
      const method = methods
        .get(world.businessId)!
        .find((m) => m.resourceId === p.methodId)!;
      return {
        paymentId: p.paymentId,
        methodId: p.methodId,
        methodProviderId: providerId,
        methodName: String(method.metadata.name),
        chargeShape: method.metadata.chargeShape as
          "none" | "percent" | "fixed" | "percent_and_fixed",
      };
    });
    const capture = await captureSaleResources(tx, {
      businessId: world.businessId,
      settlement,
      lines,
    });
    const event = await publishSaleClosed(tx, {
      businessId: world.businessId,
      sourceOrderId,
      locationId: world.locationId,
      closedAt: new Date(),
      userId: world.ownerId,
      lines,
      settlement,
      paymentsMetadata,
      capture,
    });
    await freezeSaleCommission(tx, {
      businessId: world.businessId,
      sourceProviderId: "pos",
      sourceOrderId,
      locationId: world.locationId,
      settlement,
      paymentsMetadata,
      capture,
      eventId: event?.eventId ?? null,
    });
    return event;
  });
  return { sourceOrderId, eventId: event?.eventId };
}
const drain = (eventId: string) =>
  retryModuleEvents({
    businessId: world.businessId,
    eventIds: [eventId],
    force: true,
    budgetMs: 20000,
  });
const read = (id: string) =>
  readSaleCommissions(world.businessId, id, world.locationId);
const rows = (eventId: string) =>
  getDb().select().from(snapshots).where(eq(snapshots.eventId, eventId));
describe.skipIf(!modulesIntegrationEnabled)(
  "P1 resource metadata and durable commissions",
  () => {
    it("seeds approved country/base metadata without rates or Peigo", async () => {
      const catalog = await getDb().select().from(paymentMethodCatalog);
      expect(catalog).toHaveLength(12);
      expect(catalog.some((c) => c.name.toLowerCase().includes("peigo"))).toBe(
        false,
      );
      expect(
        catalog.filter((c) => c.countryCode === "EC" && c.initiallySuggested),
      ).toHaveLength(6);
      expect(
        catalog.filter((c) => c.countryCode === null && c.initiallySuggested),
      ).toHaveLength(5);
    });
    it("configures with its own permission while the payment producer is disabled, validates inputs and tenants", async () => {
      const staff = await moduleStaff(world, ["business"]);
      expect(
        (
          await businessHttp(
            new Request("http://localhost:3001/api/business/payment-methods", {
              headers: { cookie: staff },
            }),
            ["payment-methods"],
          )
        ).status,
      ).toBe(200);
      expect((await listCommissions(world.businessId)).methods).toHaveLength(4);
      for (const body of [
        { expectedRevisionId: null, percent: "1.0000001" },
        { expectedRevisionId: null, percent: "Infinity" },
        { expectedRevisionId: null, percent: "1", fixed: "0" },
      ])
        await expect(
          saveCommission(world.businessId, methodIds.percent, body),
        ).rejects.toMatchObject({ code: "invalid_commission" });
      await expect(
        saveCommission(other.businessId, methodIds.percent, {
          expectedRevisionId: null,
          percent: "1",
        }),
      ).rejects.toMatchObject({ status: 404 });
      const configured = await saveCommission(
        world.businessId,
        methodIds.percent,
        { expectedRevisionId: null, percent: "2" },
      );
      await expect(
        saveCommission(world.businessId, methodIds.percent, {
          expectedRevisionId: null,
          percent: "3",
        }),
      ).rejects.toMatchObject({ code: "commission_revision_conflict" });
      expect(configured).toMatchObject({
        configured: true,
        percent: "2.000000",
      });
    }, 30000);
    it("captures an immutable rate at close and replay never takes the current rate", async () => {
      const configured = await saveCommission(
        world.businessId,
        methodIds.mixed,
        { expectedRevisionId: null, percent: "2.5", fixed: "0.10" },
      );
      const closed = await sale();
      await saveCommission(world.businessId, methodIds.mixed, {
        expectedRevisionId: configured.revisionId,
        percent: "50",
        fixed: "1.00",
      });
      expect((await drain(closed.eventId!)).applied).toBe(0);
      expect(await read(closed.sourceOrderId)).toMatchObject({
        state: "completo",
        total: "0.33",
        originalTotal: { numerator: "65", denominator: "2", scale: 2 },
      });
      const before = await rows(closed.eventId!);
      expect(before[0].commissionRevisionId).toBe(configured.revisionId);
      expect((await drain(closed.eventId!)).applied).toBe(0);
      expect(await rows(closed.eventId!)).toEqual(before);
      await expect(
        getDb()
          .update(revisions)
          .set({ percent: "99" })
          .where(eq(revisions.id, configured.revisionId!)),
      ).rejects.toThrow();
      await expect(
        getDb()
          .update(snapshots)
          .set({ amount: "1.00" })
          .where(eq(snapshots.id, before[0].id)),
      ).rejects.toThrow();
    }, 45000);
    it("freezes absent configuration and retains known partial components", async () => {
      const fixed = await saveCommission(world.businessId, methodIds.fixed, {
        expectedRevisionId: null,
        fixed: "0.20",
      });
      const mixed = (await listCommissions(world.businessId)).methods.find(
        (m) => m.methodId === methodIds.mixed,
      )!;
      await saveCommission(world.businessId, methodIds.mixed, {
        expectedRevisionId: mixed.revisionId,
        percent: null,
        fixed: "0.20",
      });
      const closed = await sale([
        { methodId: methodIds.fixed, amount: "4.00" },
        { methodId: methodIds.mixed, amount: "5.00" },
      ]);
      expect((await drain(closed.eventId!)).applied).toBe(0);
      expect(await read(closed.sourceOrderId)).toMatchObject({
        state: "incompleto",
        total: "0.40",
        reasons: ["commission_unconfigured"],
      });
      const absentId = randomUUID();
      methods.get(world.businessId)!.push({
        resourceId: absentId,
        metadata: {
          name: "Unconfigured",
          status: "active",
          chargeShape: "percent",
        },
      });
      await getDb().insert(paymentMethods).values({
        id: absentId,
        businessId: world.businessId,
        name: "Unconfigured",
        chargeShape: "percent",
      });
      const absent = await sale([{ methodId: absentId, amount: "9.00" }]);
      await saveCommission(world.businessId, absentId, {
        expectedRevisionId: null,
        percent: "10",
      });
      expect((await drain(absent.eventId!)).applied).toBe(0);
      expect(await read(absent.sourceOrderId)).toMatchObject({
        state: "incompleto",
        total: "0.00",
        reasons: ["commission_unconfigured"],
      });
      expect((await rows(absent.eventId!))[0].commissionRevisionId).toBeNull();
      expect(fixed.originalFixed).toEqual({
        numerator: "20",
        denominator: "1",
        scale: 2,
      });
    }, 45000);
    it("handles currency mismatch from the original fixed value and preserves zero compatibility", async () => {
      await getDb()
        .update(businesses)
        .set({ currencyCode: "COP" })
        .where(eq(businesses.id, world.businessId));
      const current = (await listCommissions(world.businessId)).methods.find(
        (m) => m.methodId === methodIds.fixed,
      )!;
      const cfg = await saveCommission(world.businessId, methodIds.fixed, {
        expectedRevisionId: current.revisionId,
        fixed: "0.10",
      });
      expect(cfg).toMatchObject({
        fixed: "0",
        originalFixed: { numerator: "10", denominator: "1", scale: 2 },
        currencyCode: "COP",
      });
      await getDb()
        .update(businesses)
        .set({ currencyCode: "USD" })
        .where(eq(businesses.id, world.businessId));
      const closed = await sale([
        { methodId: methodIds.fixed, amount: "9.00" },
      ]);
      await drain(closed.eventId!);
      expect(await read(closed.sourceOrderId)).toMatchObject({
        state: "incompleto",
        total: null,
        reasons: ["commission_currency_mismatch"],
      });
      await saveCommission(world.businessId, methodIds.fixed, {
        expectedRevisionId: cfg.revisionId,
        fixed: "0",
      });
      expect(await read(closed.sourceOrderId)).toMatchObject({ total: null });
    }, 40000);
    it("disabling the former commission module cannot disable core results or explicit zero", async () => {
      await getDb()
        .update(businessModules)
        .set({ enabled: false })
        .where(
          and(
            eq(businessModules.businessId, world.businessId),
            eq(businessModules.moduleId, "expenses"),
          ),
        );
      const positive = await sale([
        { methodId: methodIds.none, amount: "9.00" },
      ]);
      expect(await read(positive.sourceOrderId)).toMatchObject({
        state: "completo",
        total: "0.00",
        reasons: [],
      });
      const zero = await sale([], "0.00");
      expect(await read(zero.sourceOrderId)).toMatchObject({
        state: "completo",
        total: "0.00",
        payments: [],
      });
      await enableModules(world, ["expenses"]);
      await drain(positive.eventId!);
      expect(await read(positive.sourceOrderId)).toMatchObject({
        total: "0.00",
      });
    }, 30000);
    it("without event only a persisted canonical zero can supply known zero", async () => {
      const id = randomUUID(),
        resourceId = id;
      settlements.set(world.businessId + "/" + id, {
        resourceId,
        metadata: {
          sourceOrderId: id,
          locationId: world.locationId,
          snapshotPresent: true,
          collectedTotal: "0.00",
          currencyCode: "USD",
          minorUnit: 2,
        },
      });
      expect(await read(id)).toMatchObject({
        state: "completo",
        total: "0.00",
      });
      settlements.get(world.businessId + "/" + id)!.metadata.collectedTotal =
        "1.00";
      expect(await read(id)).toMatchObject({
        state: "incompleto",
        total: null,
      });
      expect(
        await readSaleCommissions(other.businessId, id, other.locationId),
      ).toMatchObject({ total: null });
      await expect(
        readSaleCommissions(world.businessId, id, other.locationId),
      ).rejects.toMatchObject({ status: 404 });
    }, 25000);
    it("a bad captured reference commits a marked result and creates no asynchronous obligation", async () => {
      await withDbTransaction((tx) =>
        setResourceVersion(tx, {
          businessId: world.businessId,
          resourceType: "payment_method",
          resourceId: methodIds.fixed,
          providerId: "core",
          slot: "commission",
          versionId: randomUUID(),
        }),
      );
      const closed = await sale([
        { methodId: methodIds.none, amount: "4.00" },
        { methodId: methodIds.fixed, amount: "5.00" },
      ]);
      expect(await drain(closed.eventId!)).toMatchObject({
        failed: 0,
        applied: 0,
      });
      expect(await rows(closed.eventId!)).toHaveLength(2);
      expect(await read(closed.sourceOrderId)).toMatchObject({
        state: "incompleto",
        total: null,
        reasons: ["commission_configuration_invalid"],
      });
    }, 30000);
    it("onEnable shares rollback with activation and is not rerun by idempotent enable", async () => {
      await setModuleEnabled(other.businessId, "expenses", {
        enabled: false,
      });
      const original = registry.expenses,
        resourceId = randomUUID();
      let calls = 0,
        fail = true;
      registry.expenses = {
        ...original,
        onEnable: async (tx, { businessId }) => {
          calls++;
          await setResourceVersion(tx, {
            businessId,
            resourceType: "activation_probe",
            resourceId,
            providerId: "activation-probe",
            slot: "initialized",
            versionId: randomUUID(),
          });
          if (fail) throw new Error("hook failed");
        },
      };
      try {
        await expect(
          setModuleEnabled(other.businessId, "expenses", {
            enabled: true,
          }),
        ).rejects.toThrow("hook failed");
        expect(
          await getDb()
            .select()
            .from(moduleResourceVersions)
            .where(eq(moduleResourceVersions.resourceId, resourceId)),
        ).toEqual([]);
        const [state] = await getDb()
          .select()
          .from(businessModules)
          .where(
            and(
              eq(businessModules.businessId, other.businessId),
              eq(businessModules.moduleId, "expenses"),
            ),
          );
        expect(state.enabled).toBe(false);
        fail = false;
        await setModuleEnabled(other.businessId, "expenses", {
          enabled: true,
        });
        await setModuleEnabled(other.businessId, "expenses", {
          enabled: true,
        });
        expect(calls).toBe(2);
      } finally {
        registry.expenses = original;
      }
    }, 30000);
  },
);
