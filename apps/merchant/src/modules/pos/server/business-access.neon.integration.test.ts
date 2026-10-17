import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { commissionRevisions } from "@mi-pasaporte/db/schema";
import { posStaff, posIntegrationEnabled } from "./pos-integration-support";
import { GET as brandGet, PUT as brandPut } from "../../../app/api/brand/route";

import {
  listPaymentMethods,
  createPaymentMethod,
} from "../../../server/business/payment-methods";

import { readSaleCommissions } from "../../../server/business/commission-read";
import {
  readConfiguration,
  saveConfiguration,
} from "../../../server/business/configuration";

import { world, other, api, setupBusinessWorld } from "./business-core-support";
describe.skipIf(!posIntegrationEnabled)("0235 business-access", () => {
  setupBusinessWorld();
  it("owner always accesses; business delegates without brand/POS; brand cannot see or mutate regional/fiscal", async () => {
    const delegated = await posStaff(world, ["business"]),
      brand = await posStaff(world, ["brand"]),
      operator = await posStaff(world, ["pos"]);
    expect((await api("payment-methods")).status).toBe(200);
    expect(
      (await api("regional", "GET", undefined, delegated.cookie)).status,
    ).toBe(200);
    expect((await api("fiscal", "GET", undefined, brand.cookie)).status).toBe(
      403,
    );
    expect(
      (await api("payment-methods", "GET", undefined, operator.cookie)).status,
    ).toBe(403);
    const branding = await (
      await brandGet(
        new Request("http://localhost:3001/api/brand", {
          headers: { cookie: brand.cookie },
        }),
      )
    ).json();
    for (const key of [
      "timezone",
      "currencyCode",
      "chargesVat",
      "saleVatRate",
      "recoversPurchaseVat",
    ])
      expect(branding).not.toHaveProperty(key);
    for (const field of [
      { timezone: "America/Lima" },
      { currencyCode: "EUR" },
      { chargesVat: false },
      { saleVatRate: null },
      { recoversPurchaseVat: false },
    ]) {
      const response = await brandPut(
        new Request("http://localhost:3001/api/brand", {
          method: "PUT",
          headers: { cookie: brand.cookie, "content-type": "application/json" },
          body: JSON.stringify({
            ...branding,
            ...field,
            revision: branding.brandRevision,
            logoAction: "keep",
          }),
        }),
      );
      expect(response.status).toBe(422);
    }
  }, 120000);
  it("regional/fiscal share their own optimistic revision; branding remains independent", async () => {
    const original = await readConfiguration(
      world.seed.business.id,
      "regional",
    );
    const result = await saveConfiguration(world.seed.business.id, "regional", {
      ...original,
      timezone: "America/Lima",
    });
    expect(result.revision).toBe(original.revision + 1);
    await expect(
      saveConfiguration(world.seed.business.id, "fiscal", {
        chargesVat: false,
        saleVatRate: null,
        recoversPurchaseVat: false,
        revision: original.revision,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "business_revision_conflict",
    });
    const fiscal = await saveConfiguration(world.seed.business.id, "fiscal", {
      chargesVat: true,
      saleVatRate: "15",
      recoversPurchaseVat: true,
      revision: result.revision,
    });
    expect(fiscal).toMatchObject({ saleVatRate: "15.00", chargesVat: true });
  }, 120000);
  it("foreign IDs/locations do not leak or alter another business", async () => {
    const method = (await listPaymentMethods(other.seed.business.id))
      .methods[0];
    expect(
      (
        await api(`payment-methods/${method.id}/commission`, "PUT", {
          expectedRevisionId: null,
        })
      ).status,
    ).toBe(404);
    await expect(
      readSaleCommissions(
        world.seed.business.id,
        randomUUID(),
        other.seed.locationId,
        "pos",
      ),
    ).rejects.toMatchObject({ status: 404 });
  }, 120000);
  it("fixed edit with stale currency conflicts before inserting a revision", async () => {
    const method = await createPaymentMethod(world.seed.business.id, {
      name: "Currency race",
      chargeShape: "fixed",
    });
    const regional = await readConfiguration(
      world.seed.business.id,
      "regional",
    );
    const changed = await saveConfiguration(
      world.seed.business.id,
      "regional",
      { ...regional, currencyCode: "EUR" },
    );
    try {
      const response = await api(
        `payment-methods/${method.id}/commission`,
        "PUT",
        {
          expectedRevisionId: null,
          fixed: "0.60",
          expectedCurrencyCode: "USD",
        },
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        code: "commission_currency_conflict",
      });
      expect(
        await getDb()
          .select()
          .from(commissionRevisions)
          .where(eq(commissionRevisions.methodId, method.id)),
      ).toHaveLength(0);
    } finally {
      await saveConfiguration(world.seed.business.id, "regional", {
        ...regional,
        revision: changed.revision,
      });
    }
  }, 120000);
});
