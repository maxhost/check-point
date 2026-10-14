import * as eventPublisher from "../server/module-events/publish";
import {
  locations,
  moduleResourceVersions,
  recipeRevisions,
  stockItems,
} from "@mi-pasaporte/db/schema";
import { moduleStaff, seedProduct } from "./modules-integration-support";
import { other } from "./stock-local-integration-support";
import { and, eq } from "drizzle-orm";
import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { modulesIntegrationEnabled } from "./modules-integration-support";
import {
  world,
  localId,
  productId,
  flourId,
  route,
  put,
  setupStockLocalWorld,
  cleanupStockLocalWorld,
} from "./stock-local-integration-support";
beforeAll(setupStockLocalWorld, 180_000);
afterAll(cleanupStockLocalWorld, 180_000);
afterEach(() => vi.restoreAllMocks());
describe.skipIf(!modulesIntegrationEnabled)(
  "0227 atomic recipe and local contracts",
  () => {
    it("recipe revision, current lines and pointer rollback together when publication fails", async () => {
      const atomicProduct = await seedProduct(world, "Receta atómica", "10.00");
      expect((await put("250.000", atomicProduct)).status).toBe(200);
      const pointers = () =>
        getDb()
          .select()
          .from(moduleResourceVersions)
          .where(
            and(
              eq(moduleResourceVersions.businessId, world.businessId),
              eq(moduleResourceVersions.resourceId, atomicProduct),
              eq(moduleResourceVersions.providerId, "recipes"),
            ),
          );
      const revisions = () =>
        getDb()
          .select()
          .from(recipeRevisions)
          .where(
            and(
              eq(recipeRevisions.businessId, world.businessId),
              eq(recipeRevisions.productId, atomicProduct),
            ),
          );
      const beforePointer = await pointers();
      const beforeRevisions = await revisions();
      const publication = vi
        .spyOn(eventPublisher, "setResourceVersion")
        .mockRejectedValueOnce(new Error("Resource pointer write unavailable"));
      const failed = await route("PUT", `recipes/${atomicProduct}`, {
        locationId: localId,
        lines: [
          {
            newItem: { name: "Sal que debe revertirse" },
            quantity: "1.000",
            unit: "g",
          },
        ],
      });
      expect(failed.status).toBe(503);
      publication.mockRestore();
      expect(await pointers()).toEqual(beforePointer);
      expect(await revisions()).toEqual(beforeRevisions);
      const read = await route(
        "GET",
        `recipes/${atomicProduct}?locationId=${localId}`,
      );
      expect(read.status).toBe(200);
      expect((await read.json()).recipe.lines).toMatchObject([
        { itemId: flourId, quantity: "250.000" },
      ]);
      expect(
        await getDb()
          .select({ id: stockItems.id })
          .from(stockItems)
          .where(
            and(
              eq(stockItems.businessId, world.businessId),
              eq(stockItems.name, "Sal que debe revertirse"),
            ),
          ),
      ).toEqual([]);
    }, 30_000);
    it("recipe permission reads local contracts without locations permission; multiple active requires selection and rejects foreign", async () => {
      const staff = await moduleStaff(world, ["recipes"]);
      expect(
        (await route("GET", "recipes/locations", undefined, staff)).status,
      ).toBe(200);
      const [second] = await getDb()
        .insert(locations)
        .values({
          businessId: world.businessId,
          name: "Segundo",
          countryCode: "EC",
          addressLabel: "Centro",
          addressSnapshot: {},
        })
        .returning({ id: locations.id });
      const absent = await route("POST", "pos/orders", {
        tableLabel: "Mesa válida",
        items: [{ productId, quantity: 1 }],
      });
      expect(absent.status).toBe(422);
      expect((await absent.json()).code).toBe("location_required");
      const foreign = await getDb()
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.businessId, other.businessId));
      expect(
        (
          await route("POST", "pos/orders", {
            tableLabel: "Mesa válida",
            locationId: foreign[0].id,
            items: [{ productId, quantity: 1 }],
          })
        ).status,
      ).toBe(404);
      const chosen = await route("POST", "pos/orders", {
        tableLabel: "Mesa válida",
        locationId: second.id,
        items: [{ productId, quantity: 1 }],
      });
      expect(chosen.status).toBe(201);
      expect((await chosen.json()).location.id).toBe(second.id);
    }, 30_000);
  },
);
