import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  users,
  products,
  compositionRevisions,
  recipeSaleResolutions,
  productCompositions,
  moduleResourceVersions,
  recipeRevisions,
} from "@mi-pasaporte/db/schema";
import type { ResourceSaleMeasure } from "@mi-pasaporte/domain/resource-measurement";
import { and, eq } from "drizzle-orm";
import {
  seedModuleWorld,
  dropModuleWorld,
  enableModules,
  seedProduct,
  newItem,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "../../modules-integration-support";
import { createRecipe } from "./library";
import { saveComposition } from "./compositions";
import { validateProductMeasurementChange } from "./measurement-validator";
let world: ModuleWorld, other: ModuleWorld;
const unit: ResourceSaleMeasure = { kind: "unit", pricingUnit: "unit" };
const mass = (pricingUnit: "kg" | "lb" | "g"): ResourceSaleMeasure => ({
  kind: "mass",
  pricingUnit,
});
const validate = (
  productId: string,
  newMeasure: ResourceSaleMeasure,
  businessId = world.businessId,
  oldMeasure = unit,
) =>
  withDbTransaction((tx) =>
    validateProductMeasurementChange({
      tx,
      businessId,
      resourceType: "product",
      resourceId: productId,
      oldMeasure,
      newMeasure,
    }),
  );
async function snapshot(productId: string) {
  return {
    product: await getDb()
      .select()
      .from(products)
      .where(eq(products.id, productId)),
    current: await getDb()
      .select()
      .from(productCompositions)
      .where(eq(productCompositions.productId, productId)),
    slots: await getDb()
      .select()
      .from(moduleResourceVersions)
      .where(eq(moduleResourceVersions.resourceId, productId)),
    revisions: await getDb()
      .select()
      .from(compositionRevisions)
      .where(eq(compositionRevisions.productId, productId)),
    resolutions: await getDb()
      .select()
      .from(recipeSaleResolutions)
      .where(eq(recipeSaleResolutions.productId, productId)),
  };
}
async function fixture(
  basisUnit: "unit" | "kg" | "lb" | "g" = "unit",
  owner = world,
) {
  const item = await newItem(owner, randomUUID());
  const recipe = await createRecipe(owner.businessId, {
    name: randomUUID(),
    lines: [{ itemId: item.id, quantity: "1.000" }],
  });
  const productId = await seedProduct(owner, randomUUID(), "1.00");
  await saveComposition(owner.businessId, productId, {
    isCombo: false,
    recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
    expectedRevisionId: null,
  });
  if (basisUnit !== "unit") {
    const original = await snapshot(productId);
    const [revision] = await getDb()
      .insert(compositionRevisions)
      .values({
        ...original.revisions[0],
        id: randomUUID(),
        basisQuantity: "2",
        basisUnit,
      })
      .returning();
    const [resolution] = await getDb()
      .insert(recipeSaleResolutions)
      .values({
        ...original.resolutions[0],
        id: randomUUID(),
        compositionRevisionId: revision.id,
        basisQuantity: "2",
        basisUnit,
      })
      .returning();
    await getDb()
      .update(productCompositions)
      .set({ revisionId: revision.id, resolutionId: resolution.id })
      .where(eq(productCompositions.productId, productId));
    await getDb()
      .update(moduleResourceVersions)
      .set({ versionId: resolution.id })
      .where(
        and(
          eq(moduleResourceVersions.resourceId, productId),
          eq(moduleResourceVersions.slot, "composition"),
        ),
      );
  }
  return productId;
}
describe.runIf(modulesIntegrationEnabled)(
  "published composition measurement validation",
  () => {
    beforeAll(async () => {
      world = await seedModuleWorld("measurement-validator");
      other = await seedModuleWorld("measurement-validator-other");
      await enableModules(world, ["stock", "recipes"]);
      await enableModules(other, ["stock", "recipes"]);
    }, 120000);
    afterAll(async () => {
      for (const owner of [world, other])
        if (owner) {
          await dropModuleWorld(owner);
          expect(
            await getDb()
              .select({ id: businesses.id })
              .from(businesses)
              .where(eq(businesses.id, owner.businessId)),
          ).toEqual([]);
          expect(
            await getDb()
              .select({ id: users.id })
              .from(users)
              .where(eq(users.id, owner.ownerId)),
          ).toEqual([]);
        }
    }, 120000);
    it("unit rejects mass without writes, including unchanged incompatible requested measures", async () => {
      const productId = await fixture(),
        before = await snapshot(productId);
      expect(await validate(productId, unit)).toBeNull();
      expect(await validate(productId, mass("kg"))).toMatchObject({
        code: "measurement_basis_required",
      });
      expect(
        await validate(productId, mass("lb"), world.businessId, mass("lb")),
      ).toMatchObject({ code: "measurement_basis_required" });
      expect(await snapshot(productId)).toEqual(before);
    });
    it("each captured mass base accepts every mass tariff unit and rejects unit without rewriting its base", async () => {
      for (const basis of ["kg", "lb", "g"] as const) {
        const productId = await fixture(basis),
          before = await snapshot(productId);
        for (const price of ["kg", "lb", "g"] as const)
          expect(
            await validate(
              productId,
              mass(price),
              world.businessId,
              mass(basis),
            ),
          ).toBeNull();
        expect(await validate(productId, unit)).toMatchObject({
          code: "measurement_basis_required",
        });
        expect(await snapshot(productId)).toEqual(before);
      }
    }, 120000);
    it("accepts absence and never reads another tenant's publication as its own", async () => {
      const bare = await seedProduct(world, randomUUID(), "1.00");
      expect(await validate(bare, mass("g"))).toBeNull();
      const foreign = await fixture("unit", other),
        before = await snapshot(foreign);
      expect(await validate(foreign, mass("kg"))).toBeNull();
      expect(await snapshot(foreign)).toEqual(before);
    });
    it("legacy recipe slot means one unit and foreign/different-product references fail closed", async () => {
      const productId = await seedProduct(world, randomUUID(), "1.00");
      const [revision] = await getDb()
        .insert(recipeRevisions)
        .values({ businessId: world.businessId, productId, lines: [] })
        .returning();
      await getDb()
        .insert(moduleResourceVersions)
        .values({
          businessId: world.businessId,
          resourceType: "product",
          resourceId: productId,
          providerId: "recipes",
          slot: "recipe",
          versionId: revision.id,
        })
        .returning();
      expect(await validate(productId, unit)).toBeNull();
      expect(await validate(productId, mass("g"))).toMatchObject({
        code: "measurement_basis_required",
      });
      for (const owner of [world, other]) {
        const wrongProduct = await seedProduct(owner, randomUUID(), "1.00");
        const [wrong] = await getDb()
          .insert(recipeRevisions)
          .values({
            businessId: owner.businessId,
            productId: wrongProduct,
            lines: [],
          })
          .returning();
        await getDb()
          .update(moduleResourceVersions)
          .set({ versionId: wrong.id })
          .where(eq(moduleResourceVersions.resourceId, productId));
        const before = await snapshot(productId);
        await expect(validate(productId, unit)).rejects.toThrow(
          "Inconsistent published",
        );
        expect(await snapshot(productId)).toEqual(before);
      }
    });
    it("rejects inconsistent published pointer, basis and component references rather than treating them as absence", async () => {
      const productId = await fixture(),
        original = await snapshot(productId);
      const wrongProductResolution = (await snapshot(await fixture()))
        .resolutions[0];
      const foreignResolution = (await snapshot(await fixture("unit", other)))
        .resolutions[0];
      await getDb()
        .update(moduleResourceVersions)
        .set({ versionId: wrongProductResolution.id })
        .where(eq(moduleResourceVersions.resourceId, productId));
      await expect(validate(productId, unit)).rejects.toThrow(
        "Inconsistent published",
      );
      await getDb()
        .update(moduleResourceVersions)
        .set({ versionId: foreignResolution.id })
        .where(eq(moduleResourceVersions.resourceId, productId));
      await expect(validate(productId, unit)).rejects.toThrow(
        "Inconsistent published",
      );
      const [badBasis] = await getDb()
        .insert(recipeSaleResolutions)
        .values({
          ...original.resolutions[0],
          id: randomUUID(),
          basisUnit: "kg",
        })
        .returning();
      const [badComponent] = await getDb()
        .insert(recipeSaleResolutions)
        .values({
          ...original.resolutions[0],
          id: randomUUID(),
          components: original.resolutions[0].components.map((c) => ({
            ...c,
            recipeRevisionId: randomUUID(),
          })),
        })
        .returning();
      for (const resolution of [
        wrongProductResolution,
        badBasis,
        badComponent,
      ]) {
        await getDb()
          .update(productCompositions)
          .set({ resolutionId: resolution.id })
          .where(eq(productCompositions.productId, productId));
        await getDb()
          .update(moduleResourceVersions)
          .set({ versionId: resolution.id })
          .where(eq(moduleResourceVersions.resourceId, productId));
        const before = await snapshot(productId);
        await expect(validate(productId, unit)).rejects.toThrow();
        expect(await snapshot(productId)).toEqual(before);
      }
      await getDb()
        .delete(moduleResourceVersions)
        .where(eq(moduleResourceVersions.resourceId, productId));
      await expect(validate(productId, unit)).rejects.toThrow(
        "Inconsistent published",
      );
    });
  },
);
