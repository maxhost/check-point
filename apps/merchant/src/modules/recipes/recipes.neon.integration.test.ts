import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  products,
  stockItems,
  independentRecipeRevisions,
  recipeSaleResolutions,
  moduleResourceVersions,
} from "@mi-pasaporte/db/schema";
import {
  seedModuleWorld,
  dropModuleWorld,
  enableModules,
  seedProduct,
  newItem,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "../modules-integration-support";
import {
  createRecipe,
  updateRecipe,
  readLibraryRecipe,
  archiveRecipe,
  listLibrary,
  listRecipeRevisions,
} from "./server/library";
import {
  saveComposition,
  readComposition,
  previewComposition,
  listCompositionRevisions,
} from "./server/compositions";
import { publishSaleClosed } from "../../server/module-events/publish";
import * as publisher from "../../server/module-events/publish";
let world: ModuleWorld, other: ModuleWorld;
beforeAll(async () => {
  world = await seedModuleWorld("R1 library");
  other = await seedModuleWorld("R1 foreign");
  await enableModules(world, ["stock", "recipes"]);
  await enableModules(other, ["stock", "recipes"]);
}, 120_000);
afterAll(async () => {
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}, 120_000);
const make = (name: string, itemId: string, quantity = "1.000") =>
  createRecipe(world.businessId, { name, lines: [{ itemId, quantity }] });
describe.skipIf(!modulesIntegrationEnabled)(
  "R1 independent recipe and composition domain",
  () => {
    it("creates without a product, converts quantities and never writes catalog cost", async () => {
      const item = await newItem(world, "Harina R1");
      const recipe = await createRecipe(world.businessId, {
        name: "Pizza independiente",
        lines: [{ itemId: item.id, quantity: "0.250", unit: "kg" }],
      });
      expect(recipe.lines).toEqual([
        {
          itemId: item.id,
          itemName: item.name,
          itemStatus: "active",
          unit: "g",
          quantity: "250.000",
        },
      ]);
      expect(await readLibraryRecipe(world.businessId, recipe.id)).toEqual(
        recipe,
      );
      expect(
        (
          await listLibrary(world.businessId, new URLSearchParams())
        ).recipes.map((r) => r.id),
      ).toContain(recipe.id);
      const productId = await seedProduct(world, "Media pizza", "3.00");
      const composition = await saveComposition(world.businessId, productId, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "0.500" }],
        expectedRevisionId: null,
      });
      expect(composition.recipes[0].quantity).toBe("0.500");
      const [product] = await getDb()
        .select()
        .from(products)
        .where(eq(products.id, productId));
      expect(product.unitCost).toBeNull();
    }, 30_000);
    it("active names are case insensitive, archival releases the name and history is immutable", async () => {
      const item = await newItem(world, "Sal R1");
      const original = await make("Sopa R1", item.id);
      await expect(make("sOPA r1", item.id)).rejects.toMatchObject({
        status: 409,
        code: "recipe_name_taken",
      });
      const updated = await updateRecipe(world.businessId, original.id, {
        name: "Sopa corregida",
        lines: [{ itemId: item.id, quantity: "2.000" }],
        expectedRevisionId: original.revisionId,
      });
      await getDb()
        .update(stockItems)
        .set({ name: "Sal renombrada" })
        .where(eq(stockItems.id, item.id));
      const history = await listRecipeRevisions(
        world.businessId,
        original.id,
        new URLSearchParams(),
      );
      expect(
        history.revisions.find((r) => r.id === original.revisionId),
      ).toMatchObject({
        name: "Sopa R1",
        lines: [{ itemName: "Sal R1", quantity: "1.000" }],
      });
      await expect(
        getDb()
          .update(independentRecipeRevisions)
          .set({ name: "Prohibido" })
          .where(eq(independentRecipeRevisions.id, original.revisionId)),
      ).rejects.toBeDefined();
      await archiveRecipe(world.businessId, updated.id, {
        expectedRevisionId: updated.revisionId,
      });
      expect((await make("Sopa corregida", item.id)).status).toBe("active");
    }, 30_000);
    it("blocks only current usage; old composition and sales do not block archival", async () => {
      const item = await newItem(world, "Ajo R1");
      const recipe = await make("Ajo preparado", item.id),
        productId = await seedProduct(world, "Almuerzo R1", "3.00");
      const first = await saveComposition(world.businessId, productId, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
        expectedRevisionId: null,
      });
      await expect(
        archiveRecipe(world.businessId, recipe.id, {
          expectedRevisionId: recipe.revisionId,
        }),
      ).rejects.toMatchObject({
        code: "recipe_in_use",
        extra: {
          products: [
            {
              productId,
              productName: "Almuerzo R1",
              compositionRevisionId: first.revisionId,
            },
          ],
        },
      });
      await saveComposition(world.businessId, productId, {
        isCombo: false,
        recipes: [],
        expectedRevisionId: first.revisionId,
      });
      expect(
        (
          await archiveRecipe(world.businessId, recipe.id, {
            expectedRevisionId: recipe.revisionId,
          })
        ).status,
      ).toBe("archived");
      expect(
        (
          await listCompositionRevisions(
            world.businessId,
            productId,
            new URLSearchParams(),
          )
        ).revisions,
      ).toHaveLength(2);
    }, 30_000);
    it("combo preview consolidates a shared ingredient and keeps each contribution", async () => {
      const item = await newItem(world, "Carne R1"),
        a = await make("Empanada carne R1", item.id, "100.000"),
        b = await make("Salsa R1", item.id, "50.000"),
        productId = await seedProduct(world, "Combo R1", "5.00");
      const body = {
        isCombo: true,
        recipes: [
          { recipeId: a.id, quantity: "12.000" },
          { recipeId: b.id, quantity: "0.500" },
        ],
        expectedRevisionId: null,
      };
      const preview = await previewComposition(
        world.businessId,
        productId,
        body,
      );
      expect(preview.ingredients).toMatchObject([
        { itemId: item.id, quantity: "1225.000" },
      ]);
      expect(
        preview.components.map((c) => c.ingredients[0].allocatedQuantity),
      ).toEqual(["1200.000", "25.000"]);
      await expect(
        saveComposition(world.businessId, productId, {
          ...body,
          isCombo: false,
        }),
      ).rejects.toMatchObject({ code: "combo_required" });
      await expect(
        saveComposition(world.businessId, productId, {
          ...body,
          recipes: [body.recipes[0], body.recipes[0]],
        }),
      ).rejects.toMatchObject({ code: "duplicate_recipe" });
    }, 30_000);
    it("fanout changes only recipe revisions, preserves old captured refs and is atomic on failure", async () => {
      const item = await newItem(world, "Arroz R1"),
        recipe = await make("Arroz R1 receta", item.id, "10.000"),
        productId = await seedProduct(world, "Menú arroz R1", "4.00");
      const composition = await saveComposition(world.businessId, productId, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
        expectedRevisionId: null,
      });
      let event;
      try {
        event = await withDbTransaction((tx) =>
          publishSaleClosed(tx, {
            businessId: world.businessId,
            sourceOrderId: randomUUID(),
            locationId: world.locationId,
            closedAt: new Date(),
            userId: world.ownerId,
            lines: [{ sourceLineId: randomUUID(), productId, quantity: 1 }],
          }),
        );
      } finally {
        // Publication is mandatory in AN-1; no switch to restore.
      }
      expect(event?.eventId).toBeTruthy();
      const changed = await updateRecipe(world.businessId, recipe.id, {
        name: recipe.name,
        lines: [{ itemId: item.id, quantity: "20.000" }],
        expectedRevisionId: recipe.revisionId,
      });
      const current = await readComposition(world.businessId, productId);
      expect(current.revisionId).toBe(composition.revisionId);
      expect(current.resolutionId).not.toBe(composition.resolutionId);
      expect(current.recipes[0].recipeRevisionId).toBe(changed.revisionId);
      const [old] = await getDb()
        .select()
        .from(recipeSaleResolutions)
        .where(eq(recipeSaleResolutions.id, composition.resolutionId!));
      expect(old.components[0].recipeRevisionId).toBe(recipe.revisionId);
      const failure = vi
        .spyOn(publisher, "setResourceVersion")
        .mockRejectedValueOnce(new Error("pointer unavailable"));
      try {
        await expect(
          updateRecipe(world.businessId, recipe.id, {
            name: "Must roll back",
            lines: [{ itemId: item.id, quantity: "99.000" }],
            expectedRevisionId: changed.revisionId,
          }),
        ).rejects.toThrow("pointer unavailable");
      } finally {
        failure.mockRestore();
      }
      expect(
        (await readLibraryRecipe(world.businessId, recipe.id)).revisionId,
      ).toBe(changed.revisionId);
    }, 30_000);
    it("recipe edit and composition creation serialize without losing the new ingredient revision", async () => {
      const item = await newItem(world, "Lenteja R1"),
        recipe = await make("Lentejas R1", item.id),
        productId = await seedProduct(world, "Lentejas plato", "3.00");
      const [changed] = await Promise.all([
        updateRecipe(world.businessId, recipe.id, {
          name: recipe.name,
          lines: [{ itemId: item.id, quantity: "7.000" }],
          expectedRevisionId: recipe.revisionId,
        }),
        saveComposition(world.businessId, productId, {
          isCombo: false,
          recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
          expectedRevisionId: null,
        }),
      ]);
      expect(
        (await readComposition(world.businessId, productId)).recipes[0]
          .recipeRevisionId,
      ).toBe(changed.revisionId);
      await getDb().delete(products).where(eq(products.id, productId));
      expect((await readLibraryRecipe(world.businessId, recipe.id)).id).toBe(
        recipe.id,
      );
    }, 30_000);
    it("rejects foreign recipes, products and ingredients without leaking usages", async () => {
      const item = await newItem(world, "Propio R1"),
        foreignItem = await newItem(other, "Ajeno R1"),
        recipe = await make("Propia R1", item.id),
        productId = await seedProduct(other, "Ajeno producto", "1.00");
      await expect(
        readLibraryRecipe(other.businessId, recipe.id),
      ).rejects.toMatchObject({ code: "recipe_not_found" });
      await expect(
        createRecipe(world.businessId, {
          name: "No",
          lines: [{ itemId: foreignItem.id, quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: "item_not_found" });
      await expect(
        saveComposition(other.businessId, productId, {
          isCombo: false,
          recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
          expectedRevisionId: null,
        }),
      ).rejects.toMatchObject({ code: "recipe_not_found" });
      await expect(
        readComposition(world.businessId, productId),
      ).rejects.toMatchObject({ code: "product_not_found" });
      const pointers = await getDb()
        .select()
        .from(moduleResourceVersions)
        .where(
          and(
            eq(moduleResourceVersions.businessId, other.businessId),
            eq(moduleResourceVersions.resourceId, productId),
          ),
        );
      expect(pointers).toEqual([]);
    }, 30_000);
  },
);
