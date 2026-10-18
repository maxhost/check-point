import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  compositionRevisions,
  independentRecipeRevisions,
  moduleResourceVersions,
  productCompositions,
  recipeSaleResolutions,
  stockItems,
  stockItemLocations,
} from "@mi-pasaporte/db/schema";
import { eq } from "drizzle-orm";
import {
  callModuleRoute,
  dropModuleWorld,
  enableModules,
  moduleStaff,
  modulesIntegrationEnabled,
  seedModuleWorld,
  seedProduct,
  type ModuleWorld,
} from "../../modules-integration-support";
import { createRecipe } from "./library";
import type {
  CompositionPreviewDTO,
  ProductCompositionDTO,
  RecipeCostListDTO,
} from "./contracts";
let world: ModuleWorld | undefined;
let foreign: ModuleWorld | undefined;
afterAll(async () => {
  await dropModuleWorld(world);
  await dropModuleWorld(foreign);
}, 240_000);

describe.skipIf(!modulesIntegrationEnabled)(
  "0242 explicit composition basis",
  () => {
    it("publishes immutable bases, preserves legacy callers and compares one tariff unit through real guarded routes", async () => {
      world = await seedModuleWorld("0242 composition basis");
      foreign = await seedModuleWorld("0242 foreign basis");
      const owner = world;
      await enableModules(owner, ["recipes", "stock"]);
      await enableModules(foreign, ["recipes", "stock"]);
      const [item] = await getDb()
        .insert(stockItems)
        .values({
          businessId: owner.businessId,
          name: "Harina base",
          unit: "g",
        })
        .returning();
      await getDb().insert(stockItemLocations).values({
        businessId: owner.businessId,
        locationId: owner.locationId,
        itemId: item.id,
        weightedAverageUnitCost: "0.200000",
        weightedAverageInitializedAt: new Date(),
      });
      const recipe = await createRecipe(owner.businessId, {
        name: "Masa",
        lines: [{ itemId: item.id, quantity: "100.000" }],
      });
      const productId = await seedProduct(owner, "Producto base", "15.00");
      const secondId = await seedProduct(
        owner,
        "Segundo producto base",
        "15.00",
      );
      const foreignId = await seedProduct(foreign, "Producto ajeno", "5.00");
      const path = `/api/modules/recipes/products/${productId}/composition`;
      const call = (
        method: "GET" | "PUT" | "POST",
        url: string,
        body?: unknown,
        cookie = owner.cookie,
      ) => callModuleRoute(method, url, cookie, body);
      const read = async () => {
        const response = await call("GET", path);
        expect(response.status).toBe(200);
        return (await response.json()).composition as ProductCompositionDTO;
      };
      const body = (
        expectedRevisionId: string | null,
        extra: Record<string, unknown> = {},
      ) => ({
        expectedRevisionId,
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
        ...extra,
      });
      const snapshot = async () =>
        Promise.all([
          getDb()
            .select()
            .from(compositionRevisions)
            .where(eq(compositionRevisions.businessId, owner.businessId)),
          getDb()
            .select()
            .from(recipeSaleResolutions)
            .where(eq(recipeSaleResolutions.businessId, owner.businessId)),
          getDb()
            .select()
            .from(productCompositions)
            .where(eq(productCompositions.businessId, owner.businessId)),
          getDb()
            .select()
            .from(moduleResourceVersions)
            .where(eq(moduleResourceVersions.businessId, owner.businessId)),
        ]);
      expect(await read()).toMatchObject({
        revisionId: null,
        basisQuantity: "1",
        basisUnit: "unit",
        conversionVersion: "mass-si-1",
      });
      const forbidden = await moduleStaff(owner, ["stock"]);
      const recipesOnly = await moduleStaff(owner, ["recipes"]);
      expect((await call("PUT", path, body(null), forbidden)).status).toBe(403);
      expect(
        (
          await call(
            "PUT",
            `/api/modules/recipes/products/${foreignId}/composition`,
            body(null),
          )
        ).status,
      ).toBe(404);
      const beforeInvalid = await snapshot();
      for (const invalid of [
        { basisQuantity: "2" },
        { basisUnit: "unit" },
        { basisQuantity: null, basisUnit: "kg" },
        { basisQuantity: "0", basisUnit: "kg" },
        { basisQuantity: "-1", basisUnit: "kg" },
        { basisQuantity: "1.5", basisUnit: "unit" },
        { basisQuantity: "1", basisUnit: "l" },
        { basisQuantity: "1e3", basisUnit: "g" },
        { basisQuantity: "1.0000000001", basisUnit: "g" },
        { basisQuantity: "1000000000", basisUnit: "kg" },
        { basisQuantity: "1", basisUnit: "kg", conversionVersion: null },
      ])
        expect((await call("PUT", path, body(null, invalid))).status).toBe(422);
      expect(await snapshot()).toEqual(beforeInvalid);
      expect(
        (
          await call(
            "PUT",
            path,
            body(null, { basisQuantity: "2", basisUnit: "unit" }),
            recipesOnly,
          )
        ).status,
      ).toBe(200);
      const first = await read();
      expect(first).toMatchObject({ basisQuantity: "2", basisUnit: "unit" });
      const firstRows = await snapshot();
      const previewResponse = await call(
        "POST",
        `${path}/preview`,
        body(first.revisionId, { basisQuantity: "10", basisUnit: "unit" }),
      );
      expect(previewResponse.status).toBe(200);
      const preview = (await previewResponse.json())
        .preview as CompositionPreviewDTO;
      expect(preview).toMatchObject({
        basisQuantity: "10",
        basisUnit: "unit",
        resolutionId: null,
        ingredients: [{ quantity: "100.000", exactQuantity: "100.000000" }],
      });
      expect(await snapshot()).toEqual(firstRows);
      const costs = async () => {
        const response = await call(
          "GET",
          `/api/modules/recipes/costs?locationId=${owner.locationId}`,
        );
        expect(response.status).toBe(200);
        return (await response.json()) as RecipeCostListDTO;
      };
      expect(
        (await costs()).recipes.find((r) => r.productId === productId),
      ).toMatchObject({
        recipeCost: "10.00",
        price: "15.00",
        profit: "5.00",
        basisQuantity: "2",
        pricingUnit: "unit",
        costStatus: "complete",
      });
      expect(
        (
          await call(
            "PUT",
            path,
            body(null, { basisQuantity: "10", basisUnit: "unit" }),
          )
        ).status,
      ).toBe(409);
      expect(await snapshot()).toEqual(firstRows);
      expect((await call("PUT", path, body(first.revisionId))).status).toBe(
        200,
      );
      const preserved = await read();
      expect(preserved).toMatchObject({
        basisQuantity: "2",
        basisUnit: "unit",
      });
      expect(
        (
          await call(
            "PUT",
            path,
            body(preserved.revisionId, {
              basisQuantity: "10",
              basisUnit: "unit",
            }),
          )
        ).status,
      ).toBe(200);
      expect(
        (await costs()).recipes.find((r) => r.productId === productId),
      ).toMatchObject({
        recipeCost: "2.00",
        profit: "13.00",
        basisQuantity: "10",
      });
      const ten = await read();
      const secondPath = `/api/modules/recipes/products/${secondId}/composition`;
      expect((await call("PUT", secondPath, body(null))).status).toBe(200);
      expect(
        (await costs()).recipes.find((r) => r.productId === secondId),
      ).toMatchObject({
        recipeCost: "20.00",
        profit: "-5.00",
        basisQuantity: "1",
        basisUnit: "unit",
      });
      // Prepare mass while product remains unit: no impossible mass-product fixture or barrier removal.
      expect(
        (
          await call(
            "PUT",
            path,
            body(ten.revisionId, { basisQuantity: "1", basisUnit: "lb" }),
          )
        ).status,
      ).toBe(200);
      const mass = await read();
      expect(mass).toMatchObject({ basisQuantity: "1", basisUnit: "lb" });
      expect(
        (await costs()).recipes.find((r) => r.productId === productId),
      ).toMatchObject({
        recipeCost: null,
        profit: null,
        marginPercent: null,
        costStatus: "incompatible_basis",
        basisUnit: "lb",
        pricingUnit: "unit",
      });
      expect((await call("PUT", path, body(mass.revisionId))).status).toBe(200);
      const massPreserved = await read();
      expect(massPreserved.basisUnit).toBe("lb");
      const beforeFanout = await snapshot();
      const recipeResponse = await call(
        "PUT",
        `/api/modules/recipes/library/${recipe.id}`,
        {
          expectedRevisionId: recipe.revisionId,
          name: recipe.name,
          lines: [{ itemId: item.id, quantity: "200.000" }],
        },
      );
      expect(recipeResponse.status).toBe(200);
      const afterFanout = await snapshot();
      expect(afterFanout[0]).toEqual(beforeFanout[0]);
      for (const old of beforeFanout[1])
        expect(afterFanout[1].find((r) => r.id === old.id)).toEqual(old);
      const fanned = await read();
      expect(fanned).toMatchObject({
        revisionId: massPreserved.revisionId,
        basisQuantity: "1",
        basisUnit: "lb",
      });
      expect(fanned.resolutionId).not.toBe(massPreserved.resolutionId);
      expect(fanned.recipes[0].recipeRevisionId).not.toBe(recipe.revisionId);
      const resolution = afterFanout[1].find(
        (r) => r.id === fanned.resolutionId,
      )!;
      expect(resolution).toMatchObject({
        basisQuantity: "1.000000000",
        basisUnit: "lb",
        conversionVersion: "mass-si-1",
      });
      expect(
        afterFanout[3].find(
          (r) => r.resourceId === productId && r.slot === "composition",
        )?.versionId,
      ).toBe(fanned.resolutionId);
      const historyResponse = await call("GET", `${path}/revisions`);
      expect(historyResponse.status).toBe(200);
      const history = (await historyResponse.json()) as {
        revisions: { id: string; basisQuantity: string; basisUnit: string }[];
      };
      expect(
        history.revisions.find((r) => r.id === first.revisionId),
      ).toMatchObject({ basisQuantity: "2", basisUnit: "unit" });
      const previousRecipe = await getDb()
        .select()
        .from(independentRecipeRevisions)
        .where(eq(independentRecipeRevisions.id, recipe.revisionId));
      expect(previousRecipe[0].lines[0].quantity).toBe("100.000");
      // Tiny has physical provenance but no ledger amount, even with a known average.
      expect(
        (
          await call(
            "PUT",
            secondPath,
            body(
              (await (await call("GET", secondPath)).json()).composition
                .revisionId,
              {
                basisQuantity: "999999999",
                basisUnit: "unit",
              },
            ),
          )
        ).status,
      ).toBe(200);
      expect(
        (await costs()).recipes.find((r) => r.productId === secondId),
      ).toMatchObject({
        recipeCost: null,
        profit: null,
        costStatus: "rounded_to_zero",
      });
    }, 240_000);
  },
);
