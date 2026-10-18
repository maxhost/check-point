import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  users,
  sessions,
  products,
  productLocations,
} from "@mi-pasaporte/db/schema";
import { updateProduct } from "@mi-pasaporte/domain/server/catalog";
import {
  seedModuleWorld,
  dropModuleWorld,
  moduleStaff,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "../../modules-integration-support";
import * as measurement from "../../../server/resource-measurement";
import { validateResourceMeasurementChange } from "../../../server/resource-measurement";
import { GET } from "../../../app/api/catalog/route";
import { POST } from "../../../app/api/catalog/product/route";
import { PUT, DELETE } from "../../../app/api/catalog/product/[id]/route";

let world: ModuleWorld, other: ModuleWorld;
let staff: string, denied: string;
const body = {
  name: "Producto",
  unitPrice: "2.00",
  unitCost: null,
  soldByWeight: false,
  pricingUnit: "unit",
};
function request(
  method: string,
  value?: unknown,
  cookie = world.cookie,
  v2 = true,
) {
  return new Request("http://localhost:3001/api/catalog/product", {
    method,
    headers: {
      cookie,
      "content-type": "application/json",
      ...(v2 ? { "X-Catalog-Contract": "2" } : {}),
    },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const readRow = async (id: string) =>
  (await getDb().select().from(products).where(eq(products.id, id)))[0];
async function response(r: Response, status: number) {
  const value = await r.json();
  expect(value).not.toHaveProperty("imageObjectKey");
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(r.status, JSON.stringify(value)).toBe(status);
  return value;
}
const create = async (value = body) =>
  response(await POST(request("POST", value)), 201);
const put = (id: string, value: unknown, cookie = world.cookie) =>
  PUT(request("PUT", value, cookie), params(id));
async function snapshot(id: string) {
  return Promise.all([
    readRow(id),
    getDb()
      .select()
      .from(productLocations)
      .where(eq(productLocations.productId, id)),
  ]);
}
describe.skipIf(!modulesIntegrationEnabled)(
  "0242 catalog v2 real HTTP and transactions",
  () => {
    beforeAll(async () => {
      world = await seedModuleWorld("catalog-v2");
      other = await seedModuleWorld("catalog-v2-other");
      await getDb()
        .update(users)
        .set({ emailVerified: false })
        .where(eq(users.id, world.ownerId));
      staff = await moduleStaff(world, ["catalog"]);
      denied = await moduleStaff(world, []);
    }, 120000);
    afterAll(async () => {
      for (const fixture of [world, other]) {
        if (!fixture) continue;
        await dropModuleWorld(fixture);
        expect(
          await getDb()
            .select()
            .from(businesses)
            .where(eq(businesses.id, fixture.businessId)),
        ).toEqual([]);
        expect(
          await getDb()
            .select()
            .from(users)
            .where(inArray(users.id, fixture.users)),
        ).toEqual([]);
        expect(
          await getDb()
            .select()
            .from(sessions)
            .where(inArray(sessions.userId, fixture.users)),
        ).toEqual([]);
      }
    }, 120000);
    it("preserves legacy shape and returns v2 strings, actual revision and catalog envelope", async () => {
      const p = await create();
      expect(p).toMatchObject({
        ...body,
        unitPrice: "2",
        catalogRevision: "1",
        locationIds: [],
      });
      const legacy = await GET(request("GET", undefined, world.cookie, false));
      expect(legacy.status).toBe(200);
      const v1 = (await legacy.json()).products.find(
        (x: { id: string }) => x.id === p.id,
      );
      expect(v1.unitPrice).toBe(2);
      for (const key of [
        "soldByWeight",
        "pricingUnit",
        "salesRevision",
        "catalogRevision",
        "imageObjectKey",
      ])
        expect(v1).not.toHaveProperty(key);
      const v2 = await response(await GET(request("GET")), 200);
      expect(v2).toMatchObject({
        currencyCode: "USD",
        importInProgress: false,
        categories: [],
        locations: [{ id: world.locationId }],
      });
      expect(v2.products.find((x: { id: string }) => x.id === p.id)).toEqual(p);
      const oldCreate = await POST(
        request(
          "POST",
          { name: "Legacy", unitPrice: "4.25" },
          world.cookie,
          false,
        ),
      );
      expect(oldCreate.status).toBe(201);
      const old = await oldCreate.json();
      expect(old.unitPrice).toBe(4.25);
      expect(old).not.toHaveProperty("salesRevision");
    }, 60000);
    it("increments once for commercial delta, preserves no-op and returns authorized conflict DTO", async () => {
      const p = await create();
      const noop = await response(
        await put(p.id, {
          ...body,
          unitPrice: "0002.000000000",
          expectedSalesRevision: "1",
        }),
        200,
      );
      expect(noop.catalogRevision).toBe("1");
      const changed = await response(
        await put(p.id, {
          ...body,
          name: "Cambio",
          unitPrice: "3",
          expectedSalesRevision: "1",
          availableAllLocations: false,
          locationIds: [world.locationId],
        }),
        200,
      );
      expect(changed.catalogRevision).toBe("2");
      const before = await snapshot(p.id);
      const conflict = await response(
        await put(p.id, { ...body, expectedSalesRevision: "1" }),
        409,
      );
      expect(conflict).toMatchObject({
        code: "catalog_changed",
        product: changed,
      });
      expect(JSON.stringify(conflict)).not.toContain("imageObjectKey");
      expect(await snapshot(p.id)).toEqual(before);
      expect(
        (
          await response(
            await put(p.id, {
              ...body,
              expectedSalesRevision: "2",
              imageAction: "remove",
              name: "Cambio",
              unitPrice: "3",
              availableAllLocations: false,
              locationIds: [world.locationId],
            }),
            200,
          )
        ).catalogRevision,
      ).toBe("2");
    }, 60000);
    it("same expected revision admits exactly one concurrent update", async () => {
      const p = await create();
      const replies = await Promise.all(
        ["A", "B"].map((name) =>
          put(p.id, { ...body, name, expectedSalesRevision: "1" }),
        ),
      );
      expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
      for (const reply of replies) await response(reply, reply.status);
      expect((await readRow(p.id)).salesRevision).toBe(2);
    }, 60000);
    it("uses catalog permission without email, keeps owner-only DELETE, and hides cross-tenant data", async () => {
      const p = await response(await POST(request("POST", body, staff)), 201);
      await response(
        await put(
          p.id,
          { ...body, name: "Staff", expectedSalesRevision: "1" },
          staff,
        ),
        200,
      );
      expect(
        (
          await response(
            await DELETE(request("DELETE", undefined, staff), params(p.id)),
            403,
          )
        ).code,
      ).toBe("not_owner");
      expect(
        (await response(await POST(request("POST", body, denied)), 403)).code,
      ).toBe("missing_permission");
      const before = await readRow(p.id);
      const foreign = await response(
        await put(p.id, { ...body, expectedSalesRevision: "2" }, other.cookie),
        404,
      );
      expect(foreign).not.toHaveProperty("product");
      expect(await readRow(p.id)).toEqual(before);
      await response(await DELETE(request("DELETE"), params(p.id)), 200);
      expect(await readRow(p.id)).toBeUndefined();
      await response(await GET(request("GET", undefined, "")), 401);
    }, 60000);
    it("rejects malformed body/revision/money/measure and preserves private caching", async () => {
      const p = await create();
      for (const delta of [
        { expectedSalesRevision: undefined },
        { expectedSalesRevision: 1 },
        { unitPrice: 2 },
        { unitPrice: "1e2" },
        { unitPrice: "1000000000" },
        { unitPrice: "1.0000000000" },
        { soldByWeight: false, pricingUnit: "kg" },
        { soldByWeight: true, pricingUnit: "lb" },
      ]) {
        await response(
          await put(p.id, { ...body, expectedSalesRevision: "1", ...delta }),
          422,
        );
      }
      const malformed = request("POST");
      await response(await POST(malformed), 400);
      expect((await readRow(p.id)).salesRevision).toBe(1);
    }, 60000);
    it("preserves exact historical high unit tariff only when unchanged", async () => {
      const p = await create();
      await getDb()
        .update(products)
        .set({ unitPrice: "9999999999.99" })
        .where(eq(products.id, p.id));
      const saved = await response(
        await put(p.id, {
          ...body,
          name: "Histórico",
          unitPrice: "9999999999.99",
          expectedSalesRevision: "1",
        }),
        200,
      );
      expect(saved).toMatchObject({
        unitPrice: "9999999999.99",
        catalogRevision: "2",
      });
      for (const delta of [
        { unitPrice: "9999999999.98" },
        { soldByWeight: true, pricingUnit: "kg", unitPrice: "9999999999.99" },
      ])
        await response(
          await put(p.id, { ...body, expectedSalesRevision: "2", ...delta }),
          422,
        );
      await response(
        await POST(request("POST", { ...body, unitPrice: "9999999999.99" })),
        422,
      );
      expect((await readRow(p.id)).unitPrice).toBe("9999999999.990000000");
    }, 60000);
    it("keeps expand barriers active and maps only their real failures without effects", async () => {
      const p = await create();
      const before = await snapshot(p.id);
      for (const delta of [
        { soldByWeight: true, pricingUnit: "kg" },
        { unitPrice: "1.001" },
        { unitCost: "0.000000001" },
      ]) {
        expect(
          (
            await response(
              await put(p.id, {
                ...body,
                expectedSalesRevision: "1",
                ...delta,
              }),
              409,
            )
          ).code,
        ).toBe("pos_client_upgrade_required");
        expect(await snapshot(p.id)).toEqual(before);
        expect(
          (
            await response(
              await POST(request("POST", { ...body, ...delta })),
              409,
            )
          ).code,
        ).toBe("pos_client_upgrade_required");
      }
      expect(
        (
          await getDb()
            .select()
            .from(products)
            .where(eq(products.businessId, world.businessId))
        ).filter((row) => row.soldByWeight),
      ).toEqual([]);
    }, 60000);
    it("passes the locked tx/context even for old==new, and rolls back provider writes and failures", async () => {
      const p = await create();
      const before = await snapshot(p.id);
      let seen = false;
      const callback = vi.fn(
        async (
          change: Parameters<typeof validateResourceMeasurementChange>[0],
        ) => {
          seen = true;
          expect(change).toMatchObject({
            businessId: world.businessId,
            resourceType: "product",
            resourceId: p.id,
            oldMeasure: { kind: "unit", pricingUnit: "unit" },
            newMeasure: { kind: "unit", pricingUnit: "unit" },
          });
          expect(
            (
              await change.tx
                .select()
                .from(products)
                .where(eq(products.id, p.id))
            )[0],
          ).toEqual(before[0]);
          await change.tx
            .update(products)
            .set({ name: "Must rollback" })
            .where(eq(products.id, p.id));
          return {
            code: "measurement_basis_required" as const,
            message: "Fixture rejection",
          };
        },
      );
      await expect(
        updateProduct(
          { id: world.businessId, currencyCode: "USD" },
          p.id,
          { ...body, expectedSalesRevision: "1" },
          { contract: 2, validateMeasurementChange: callback },
        ),
      ).rejects.toMatchObject({ code: "measurement_basis_required" });
      expect(seen).toBe(true);
      expect(await snapshot(p.id)).toEqual(before);
      const failure = new Error("Provider failure");
      await expect(
        updateProduct(
          { id: world.businessId, currencyCode: "USD" },
          p.id,
          { ...body, expectedSalesRevision: "1" },
          {
            contract: 2,
            validateMeasurementChange: async (change) => {
              await callback(change);
              throw failure;
            },
          },
        ),
      ).rejects.toBe(failure);
      expect(await snapshot(p.id)).toEqual(before);
    }, 60000);
  },
);
it("returns private 503 for unexpected injected provider failure and rolls back its writes", async () => {
  const p = await create();
  const before = await snapshot(p.id);
  const spy = vi
    .spyOn(measurement, "validateResourceMeasurementChange")
    .mockImplementationOnce(async ({ tx }) => {
      await tx
        .update(products)
        .set({ name: "Rollback" })
        .where(eq(products.id, p.id));
      throw new Error("Unexpected provider failure");
    });
  try {
    await response(
      await put(p.id, { ...body, expectedSalesRevision: "1" }),
      503,
    );
    expect(await snapshot(p.id)).toEqual(before);
  } finally {
    spy.mockRestore();
  }
}, 60000);
