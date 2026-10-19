import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  moduleEvents,
  paymentCommissions,
  posOrderPayments,
} from "@mi-pasaporte/db/schema";
import {
  openOrderV2,
  seedProduct,
  scopedPos,
  posIntegrationEnabled,
} from "./pos-integration-support";

import { createPaymentMethod } from "../../../server/business/payment-methods";
import { saveCommission } from "../../../server/business/commission-config";
import { readSaleCommissions } from "../../../server/business/commission-read";

import {
  world,
  worldScope,
  close,
  setupBusinessWorld,
} from "./business-core-support";
describe.skipIf(!posIntegrationEnabled)("0235 business-financial", () => {
  setupBusinessWorld({ posContract: 2 });
  it("flagOFF still closes with core method and durable provisional0; retry keeps it after new configuration", async () => {
    const method = await createPaymentMethod(world.seed.business.id, {
      name: "No tariff",
      chargeShape: "percent",
    });
    const { order, body, response } = await close(method.id);
    expect(response.status).toBe(200);
    const first = await readSaleCommissions(
      world.seed.business.id,
      order.id,
      world.seed.locationId,
      "pos",
    );
    expect(first).toMatchObject({
      state: "incompleto",
      total: "0.00",
      reasons: ["commission_unconfigured"],
      payments: [{ configured: false, commission: "0.00" }],
    });
    expect(
      await getDb()
        .select()
        .from(moduleEvents)
        .where(eq(moduleEvents.sourceId, order.id)),
    ).toHaveLength(0);
    await saveCommission(world.seed.business.id, method.id, {
      expectedRevisionId: null,
      percent: "10",
    });
    expect(
      (await scopedPos(world.ownerCookie, worldScope!).close(order.id, body))
        .status,
    ).toBe(200);
    expect(
      await readSaleCommissions(
        world.seed.business.id,
        order.id,
        world.seed.locationId,
        "pos",
      ),
    ).toEqual(first);
    const rows = await getDb()
      .select()
      .from(posOrderPayments)
      .where(eq(posOrderPayments.posOrderId, order.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].methodProviderId).toBe("core");
  }, 120000);
  it("revision A remains frozen after B; another close uses B; publication reuses captured core revision", async () => {
    const method = await createPaymentMethod(world.seed.business.id, {
      name: "Frozen rate",
      chargeShape: "percent",
    });
    const a = await saveCommission(world.seed.business.id, method.id, {
      expectedRevisionId: null,
      percent: "2.5",
    });
    const { order, response } = await close(method.id);
    expect(response.status).toBe(200);
    await saveCommission(world.seed.business.id, method.id, {
      expectedRevisionId: a.revisionId,
      percent: "10",
    });
    const frozen = await getDb()
      .select()
      .from(paymentCommissions)
      .where(eq(paymentCommissions.sourceOrderId, order.id));
    expect(frozen[0]).toMatchObject({
      commissionRevisionId: a.revisionId,
      percent: "2.500000",
      result: { commission: "0.05", configured: true },
    });
    const [event] = await getDb()
      .select()
      .from(moduleEvents)
      .where(eq(moduleEvents.sourceId, order.id));
    expect(JSON.stringify(event.payload)).toContain(a.revisionId!);
    const next = await close(method.id);
    expect(next.response.status).toBe(200);
    expect(
      await readSaleCommissions(
        world.seed.business.id,
        next.order.id,
        world.seed.locationId,
        "pos",
      ),
    ).toMatchObject({ total: "0.20", state: "completo" });
  }, 120000);
  it("partial rate and currency mismatch are committed outcomes, never blocked sales", async () => {
    const method = await createPaymentMethod(world.seed.business.id, {
      name: "Partial/mismatch",
      chargeShape: "percent_and_fixed",
    });
    const a = await saveCommission(world.seed.business.id, method.id, {
      expectedRevisionId: null,
      percent: null,
      fixed: "0.20",
    });
    const partial = await close(method.id);
    expect(partial.response.status).toBe(200);
    expect(
      await readSaleCommissions(
        world.seed.business.id,
        partial.order.id,
        world.seed.locationId,
        "pos",
      ),
    ).toMatchObject({
      total: "0.20",
      state: "incompleto",
      payments: [{ configured: false }],
    });
    await saveCommission(world.seed.business.id, method.id, {
      expectedRevisionId: a.revisionId,
      percent: "2",
      fixed: "0.20",
    });
    await getDb()
      .update(businesses)
      .set({ currencyCode: "EUR" })
      .where(eq(businesses.id, world.seed.business.id));
    try {
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
        reasons: ["commission_currency_mismatch"],
        payments: [{ configured: true, commission: null }],
      });
    } finally {
      await getDb()
        .update(businesses)
        .set({ currencyCode: "USD" })
        .where(eq(businesses.id, world.seed.business.id));
    }
  }, 120000);
  it("net0 flagOFF has an explicit durable core header and no fake payment; absence is unknown", async () => {
    const free = await seedProduct(world, "Free test", "0.00");
    const order = await openOrderV2(world, worldScope!, [
      { productId: free, quantity: 1 },
    ]);
    // Use the existing POS-authorized free product, not a browser-supplied net.
    const response = await scopedPos(world.ownerCookie, worldScope!).close(
      order.id,
      {
        clientRequestId: randomUUID(),
        version: order.version,
        payments: [],
      },
    );
    expect(response.status).toBe(200);
    expect(
      await readSaleCommissions(
        world.seed.business.id,
        order.id,
        world.seed.locationId,
        "pos",
      ),
    ).toMatchObject({
      state: "completo",
      total: "0.00",
      payments: [],
      reasons: [],
    });
    expect(
      await getDb()
        .select()
        .from(posOrderPayments)
        .where(eq(posOrderPayments.posOrderId, order.id)),
    ).toHaveLength(0);
    expect(
      await readSaleCommissions(
        world.seed.business.id,
        randomUUID(),
        world.seed.locationId,
        "pos",
      ),
    ).toMatchObject({ total: null, state: "incompleto" });
  }, 120000);
  it("valid fixed fee greater than an input amount persists without aggregate overflow", async () => {
    const method = await createPaymentMethod(world.seed.business.id, {
      name: "Large fixed",
      chargeShape: "fixed",
    });
    await saveCommission(world.seed.business.id, method.id, {
      expectedRevisionId: null,
      fixed: "9999999999999999.99",
    });
    const sale = await close(method.id);
    expect(sale.response.status).toBe(200);
    expect(
      await readSaleCommissions(
        world.seed.business.id,
        sale.order.id,
        world.seed.locationId,
        "pos",
      ),
    ).toMatchObject({ state: "completo", total: "9999999999999999.99" });
    const mixed = await createPaymentMethod(world.seed.business.id, {
      name: "Large fixed plus rate",
      chargeShape: "percent_and_fixed",
    });
    await saveCommission(world.seed.business.id, mixed.id, {
      expectedRevisionId: null,
      fixed: "9999999999999999.99",
      percent: "100",
    });
    const result = await close(mixed.id);
    expect(result.response.status).toBe(200);
    expect(
      await readSaleCommissions(
        world.seed.business.id,
        result.order.id,
        world.seed.locationId,
        "pos",
      ),
    ).toMatchObject({ state: "completo", total: "10000000000000001.99" });
  }, 120000);
});
