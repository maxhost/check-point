import { randomUUID } from "node:crypto";
import { readLibraryRecipe, updateRecipe } from "./recipes/server/library";
import * as eventPublisher from "../server/module-events/publish";
import {
  locations,
  moduleResourceVersions,
  independentRecipeRevisions,
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
  stockPos,
  productId,
  flourId,
  route,
  put,
  setupStockLocalWorld,
  cleanupStockLocalWorld,
} from "./stock-local-integration-support";
beforeAll(() => setupStockLocalWorld({ posContract: 2 }), 180_000);
afterAll(cleanupStockLocalWorld, 180_000);
afterEach(() => vi.restoreAllMocks());
describe.skipIf(!modulesIntegrationEnabled)(
  "0227 atomic recipe and local contracts",
  () => {
    it("recipe revision, current lines and pointer rollback together when publication fails", async () => {
      const atomicProduct = await seedProduct(world, "Receta atómica", "10.00");
      const created = await put("250.000", atomicProduct);
      expect(created.status).toBe(200);
      const { recipe } = await created.json();
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
          .from(independentRecipeRevisions)
          .where(
            and(
              eq(independentRecipeRevisions.businessId, world.businessId),
              eq(independentRecipeRevisions.recipeId, recipe.id),
            ),
          );
      const beforePointer = await pointers();
      const beforeRevisions = await revisions();
      const publication = vi
        .spyOn(eventPublisher, "setResourceVersion")
        .mockRejectedValueOnce(new Error("Resource pointer write unavailable"));
      await expect(
        updateRecipe(world.businessId, recipe.id, {
          name: recipe.name,
          expectedRevisionId: recipe.revisionId,
          lines: [
            {
              newItem: { name: "Sal que debe revertirse" },
              quantity: "1.000",
              unit: "g",
            },
          ],
        }),
      ).rejects.toThrow("Resource pointer write unavailable");
      publication.mockRestore();
      expect(await pointers()).toEqual(beforePointer);
      expect(await revisions()).toEqual(beforeRevisions);
      const read = await readLibraryRecipe(world.businessId, recipe.id);
      expect(read.lines).toMatchObject([
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
      const absent = await stockPos().create({
        locationId: null,
        createRequestId: randomUUID(),
        saleType: "pickup",
        orderLabel: "Mesa válida",
        tableId: null,
        note: null,
        items: [
          {
            productId,
            quantity: "1",
            quantityUnit: "unit",
            catalogRevision: "1",
          },
        ],
      });
      expect(absent.status).toBe(422);
      expect((await absent.json()).code).toBe("location_required");
      const foreign = await getDb()
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.businessId, other.businessId));
      expect(
        (
          await stockPos().create({
            createRequestId: randomUUID(),
            saleType: "pickup",
            orderLabel: "Mesa válida",
            tableId: null,
            note: null,
            locationId: foreign[0].id,
            items: [
              {
                productId,
                quantity: "1",
                quantityUnit: "unit",
                catalogRevision: "1",
              },
            ],
          })
        ).status,
      ).toBe(404);
      const chosen = await stockPos().create({
        createRequestId: randomUUID(),
        saleType: "pickup",
        orderLabel: "Mesa válida",
        tableId: null,
        note: null,
        locationId: second.id,
        items: [
          {
            productId,
            quantity: "1",
            quantityUnit: "unit",
            catalogRevision: "1",
          },
        ],
      });
      expect(chosen.status).toBe(201);
      expect((await chosen.json()).location.id).toBe(second.id);
    }, 30_000);
  },
);
