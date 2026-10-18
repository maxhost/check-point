import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  users,
  sessions,
  products,
  productLocations,
  compositionRevisions,
  recipeSaleResolutions,
  productCompositions,
  moduleResourceVersions,
} from "@mi-pasaporte/db/schema";
import {
  seedModuleWorld,
  dropModuleWorld,
  enableModules,
  newItem,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "../../modules-integration-support";
import { createRecipe } from "./library";
import { saveComposition } from "./compositions";
import { lockRecipes } from "./model/common";
import { businessHttp } from "../../../server/business/http";
import { POST } from "../../../app/api/catalog/product/route";
import { PUT } from "../../../app/api/catalog/product/[id]/route";
let world: ModuleWorld;
const body = {
  name: "Producto",
  unitPrice: "2.00",
  unitCost: null,
  soldByWeight: false,
  pricingUnit: "unit",
};
function request(method: string, value?: unknown) {
  return new Request("http://localhost:3001/api/catalog/product", {
    method,
    headers: {
      cookie: world.cookie,
      "content-type": "application/json",
      "X-Catalog-Contract": "2",
    },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function response(r: Response, status: number) {
  const value = await r.json();
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(r.status, JSON.stringify(value)).toBe(status);
  return value;
}
const create = async () => response(await POST(request("POST", body)), 201);
const put = (id: string, value: unknown) =>
  PUT(request("PUT", value), params(id));
async function snapshot(id: string) {
  return Promise.all([
    getDb().select().from(products).where(eq(products.id, id)),
    getDb()
      .select()
      .from(productLocations)
      .where(eq(productLocations.productId, id)),
    getDb()
      .select()
      .from(productCompositions)
      .where(eq(productCompositions.productId, id)),
    getDb()
      .select()
      .from(compositionRevisions)
      .where(eq(compositionRevisions.productId, id)),
    getDb()
      .select()
      .from(recipeSaleResolutions)
      .where(eq(recipeSaleResolutions.productId, id)),
    getDb()
      .select()
      .from(moduleResourceVersions)
      .where(eq(moduleResourceVersions.resourceId, id)),
  ]);
}
describe.skipIf(!modulesIntegrationEnabled)(
  "0242 catalog merchant composition integration",
  () => {
    beforeAll(async () => {
      world = await seedModuleWorld("catalog-composition");
    }, 120000);
    afterAll(async () => {
      if (!world) return;
      await dropModuleWorld(world);
      expect(
        await getDb()
          .select()
          .from(businesses)
          .where(eq(businesses.id, world.businessId)),
      ).toEqual([]);
      expect(
        await getDb()
          .select()
          .from(users)
          .where(inArray(users.id, world.users)),
      ).toEqual([]);
      expect(
        await getDb()
          .select()
          .from(sessions)
          .where(inArray(sessions.userId, world.users)),
      ).toEqual([]);
    }, 120000);
    it("merchant invokes real active provider on an incompatible published basis even with unchanged unit mode", async () => {
      await enableModules(world, ["stock", "recipes"]);
      const p = await create();
      const item = await newItem(world, randomUUID());
      const recipe = await createRecipe(world.businessId, {
        name: randomUUID(),
        lines: [{ itemId: item.id, quantity: "1.000" }],
      });
      await saveComposition(world.businessId, p.id, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
        expectedRevisionId: null,
      });
      const [original] = await getDb()
        .select()
        .from(compositionRevisions)
        .where(eq(compositionRevisions.productId, p.id));
      const [published] = await getDb()
        .select()
        .from(recipeSaleResolutions)
        .where(eq(recipeSaleResolutions.productId, p.id));
      // Captured incompatible base uses real referenced revisions; no product barrier is removed.
      const [revision] = await getDb()
        .insert(compositionRevisions)
        .values({
          ...original,
          id: randomUUID(),
          basisQuantity: "2",
          basisUnit: "kg",
        })
        .returning();
      const [resolution] = await getDb()
        .insert(recipeSaleResolutions)
        .values({
          ...published,
          id: randomUUID(),
          compositionRevisionId: revision.id,
          basisQuantity: "2",
          basisUnit: "kg",
        })
        .returning();
      await getDb()
        .update(productCompositions)
        .set({ revisionId: revision.id, resolutionId: resolution.id })
        .where(eq(productCompositions.productId, p.id));
      await getDb()
        .update(moduleResourceVersions)
        .set({ versionId: resolution.id })
        .where(
          and(
            eq(moduleResourceVersions.resourceId, p.id),
            eq(moduleResourceVersions.slot, "composition"),
          ),
        );
      const before = await snapshot(p.id);
      expect(
        (
          await response(
            await put(p.id, {
              ...body,
              name: "Rejected",
              expectedSalesRevision: "1",
              availableAllLocations: false,
              locationIds: [world.locationId],
            }),
            409,
          )
        ).code,
      ).toBe("measurement_basis_required");
      expect(await snapshot(p.id)).toEqual(before);
    }, 60000);
    it("publication helper acquires business-config before provider mutex", async () => {
      const p = await create();
      const configuration = (method: string, value?: unknown) =>
        businessHttp(
          new Request("http://localhost:3001/api/business/sales-units", {
            method,
            headers: {
              cookie: world.cookie,
              "content-type": "application/json",
            },
            ...(value === undefined ? {} : { body: JSON.stringify(value) }),
          }),
          ["sales-units"],
        );
      const initial = await (await configuration("GET")).json();
      // Hold config on one connection; helper must not acquire the provider lock while waiting.
      let release!: () => void;
      let acquired!: () => void;
      const held = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const blocker = withDbTransaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${"business-config/" + world.businessId},0))`,
        );
        acquired();
        await gate;
      });
      await held;
      let helperStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        helperStarted = resolve;
      });
      const publication = withDbTransaction(async (tx) => {
        helperStarted();
        await lockRecipes(tx, world.businessId);
      });
      const catalog = put(p.id, {
        ...body,
        name: "Serialized",
        expectedSalesRevision: "1",
      });
      const config = configuration("PUT", {
        salesMassUnits: ["kg", "lb"],
        revision: initial.revision,
      });
      try {
        await started;
        // Wait for PostgreSQL to observe the waiting helper, not a scheduling timeout.
        let waiting = false;
        for (let i = 0; i < 40 && !waiting; i++) {
          const result = await getDb().execute(
            sql`select count(*)::int as waiting from pg_locks where locktype = 'advisory' and not granted and ((classid::bigint << 32) | objid::bigint) = hashtextextended(${"business-config/" + world.businessId},0)`,
          );
          waiting = result.rows[0]?.waiting === 3;
        }
        expect(waiting).toBe(true);
        expect(await (await configuration("GET")).json()).toEqual(initial);
        expect(
          (
            await getDb().select().from(products).where(eq(products.id, p.id))
          )[0].name,
        ).toBe(body.name);
        await withDbTransaction(async (tx) => {
          const result = await tx.execute(
            sql`select pg_try_advisory_xact_lock(hashtextextended(${"recipes-r1/" + world.businessId},0)) as acquired`,
          );
          expect(result.rows[0]?.acquired).toBe(true);
        });
      } finally {
        release();
        await blocker;
        await publication;
        await response(await catalog, 200);
        await response(await config, 200);
      }
    }, 60000);
  },
);
