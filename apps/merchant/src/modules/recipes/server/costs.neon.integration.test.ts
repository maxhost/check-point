import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  businessModules,
  businesses,
  compositionRevisions,
  independentRecipeRevisions,
  locations,
  productCompositions,
  products,
  recipeSaleResolutions,
  stockItemLocations,
  stockItems,
  stockMovements,
} from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
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
import { previewComposition, saveComposition } from "./compositions";
import type { RecipeCostListDTO } from "./contracts";

let world: ModuleWorld | undefined;
let other: ModuleWorld | undefined;
afterAll(async () => {
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}, 240_000);

describe.skipIf(!modulesIntegrationEnabled)("0234 current recipe costs", () => {
  it("reads exact local costs and margins through one guarded route without changing persisted data", async () => {
    world = await seedModuleWorld("0234 costs");
    other = await seedModuleWorld("0234 foreign");
    const owner = world;
    const foreign = other;
    await enableModules(owner, ["stock", "recipes"]);
    await enableModules(foreign, ["stock", "recipes"]);
    const [second] = await getDb()
      .insert(locations)
      .values({
        businessId: owner.businessId,
        name: "Segundo",
        addressLabel: "Quito",
        countryCode: "EC",
        addressSnapshot: {},
      })
      .returning();
    async function item(name: string) {
      const [row] = await getDb()
        .insert(stockItems)
        .values({ businessId: owner.businessId, name, unit: "g" })
        .returning();
      return row;
    }
    const normal = await item("Harina"),
      half = await item("Mitad"),
      shared = await item("Compartido"),
      missing = await item("Sin promedio"),
      absent = await item("Sin par"),
      free = await item("Costo cero");
    await getDb()
      .insert(stockItemLocations)
      .values([
        {
          businessId: owner.businessId,
          itemId: normal.id,
          locationId: owner.locationId,
          weightedAverageUnitCost: "0.104900",
          weightedAverageInitializedAt: new Date(),
          lastUnitCost: "9.000000",
        },
        {
          businessId: owner.businessId,
          itemId: normal.id,
          locationId: second.id,
          weightedAverageUnitCost: "0.204900",
          weightedAverageInitializedAt: new Date(),
        },
        {
          businessId: owner.businessId,
          itemId: half.id,
          locationId: owner.locationId,
          weightedAverageUnitCost: "0.105000",
          weightedAverageInitializedAt: new Date(),
        },
        {
          businessId: owner.businessId,
          itemId: shared.id,
          locationId: owner.locationId,
          weightedAverageUnitCost: "1000.000000",
          weightedAverageInitializedAt: new Date(),
        },
        {
          businessId: owner.businessId,
          itemId: missing.id,
          locationId: owner.locationId,
          weightedAverageUnitCost: null,
          lastUnitCost: "7.000000",
        },
        {
          businessId: owner.businessId,
          itemId: missing.id,
          locationId: second.id,
          weightedAverageUnitCost: "4.000000",
          weightedAverageInitializedAt: new Date(),
        },
        {
          businessId: owner.businessId,
          itemId: free.id,
          locationId: owner.locationId,
          weightedAverageUnitCost: "0.000000",
          weightedAverageInitializedAt: new Date(),
        },
      ]);
    async function recipe(
      name: string,
      lines: { itemId: string; quantity: string }[],
    ) {
      return createRecipe(owner.businessId, { name, lines });
    }
    const basic = await recipe("Base", [
      { itemId: normal.id, quantity: "1.000" },
    ]);
    const halfRecipe = await recipe("Mitad receta", [
      { itemId: half.id, quantity: "1.000" },
    ]);
    const a = await recipe("Combo A", [
      { itemId: shared.id, quantity: "0.001" },
    ]);
    const b = await recipe("Combo B", [
      { itemId: shared.id, quantity: "0.001" },
    ]);
    const unknown = await recipe("Faltantes", [
      { itemId: missing.id, quantity: "1.000" },
      { itemId: absent.id, quantity: "1.000" },
    ]);
    const roundedZero = await recipe("Micro", [
      { itemId: absent.id, quantity: "0.001" },
    ]);
    const zero = await recipe("Gratis", [
      { itemId: free.id, quantity: "1.000" },
    ]);
    const empty = await recipe("Vacía", []);
    async function configured(
      name: string,
      price: string | null,
      recipeId: string,
      quantity = "1.000",
    ) {
      const productId = await seedProduct(owner, name, price);
      await saveComposition(owner.businessId, productId, {
        isCombo: false,
        recipes: [{ recipeId, quantity }],
        expectedRevisionId: null,
      });
      return productId;
    }
    const normalId = await configured("Normal", "0.21", basic.id);
    const halfId = await configured("Mitad", "0.21", halfRecipe.id);
    const missingId = await configured("Faltantes", "5.00", unknown.id);
    const noPriceId = await configured("Sin precio", null, basic.id);
    const zeroPriceId = await configured("Precio cero", "0.00", basic.id);
    const lossId = await configured("Pérdida", "0.05", basic.id);
    const freeId = await configured("Gratis", "1.00", zero.id);
    const roundedZeroId = await configured(
      "Micro",
      "1.00",
      roundedZero.id,
      "0.100",
    );
    const emptyId = await configured("Vacía", "1.00", empty.id);
    const detachedId = await seedProduct(owner, "Sin composición", "2.00");
    await saveComposition(owner.businessId, detachedId, {
      isCombo: false,
      recipes: [],
      expectedRevisionId: null,
    });
    const comboId = await seedProduct(owner, "Combo", "2.00");
    const comboBody = {
      isCombo: true,
      recipes: [
        { recipeId: a.id, quantity: "0.400" },
        { recipeId: b.id, quantity: "0.100" },
      ],
      expectedRevisionId: null,
    };
    const preview = await previewComposition(
      owner.businessId,
      comboId,
      comboBody,
    );
    expect(preview.ingredients).toMatchObject([
      { itemId: shared.id, exactQuantity: "0.000500", quantity: "0.001" },
    ]);
    await saveComposition(owner.businessId, comboId, comboBody);
    await getDb()
      .update(products)
      .set({ unitCost: "99.00" })
      .where(eq(products.businessId, owner.businessId));

    // A separate business exercises a zero-decimal currency and a negative margin.
    await getDb()
      .update(businesses)
      .set({ currencyCode: "COP" })
      .where(eq(businesses.id, foreign.businessId));
    const [foreignItem] = await getDb()
      .insert(stockItems)
      .values({
        businessId: foreign.businessId,
        name: "Secreto ajeno",
        unit: "g",
      })
      .returning();
    await getDb().insert(stockItemLocations).values({
      businessId: foreign.businessId,
      itemId: foreignItem.id,
      locationId: foreign.locationId,
      weightedAverageUnitCost: "10.500000",
      weightedAverageInitializedAt: new Date(),
    });
    const foreignRecipe = await createRecipe(foreign.businessId, {
      name: "Secreta",
      lines: [{ itemId: foreignItem.id, quantity: "1.000" }],
    });
    const foreignProduct = await seedProduct(
      foreign,
      "Producto secreto",
      "10.00",
    );
    await saveComposition(foreign.businessId, foreignProduct, {
      isCombo: false,
      recipes: [{ recipeId: foreignRecipe.id, quantity: "1.000" }],
      expectedRevisionId: null,
    });
    const recipesOnly = await moduleStaff(owner, ["recipes"]);
    const forbidden = await moduleStaff(owner, ["stock"]);
    const call = (suffix: string, cookie = owner.cookie) =>
      callModuleRoute("GET", `/api/modules/recipes${suffix}`, cookie);
    const read = async (locationId: string, cookie = owner.cookie) => {
      const response = await call(`/costs?locationId=${locationId}`, cookie);
      expect(response.status).toBe(200);
      return (await response.json()) as RecipeCostListDTO;
    };
    // Snapshot every persisted surface that a mistaken cost GET might initialize/write.
    async function snapshot() {
      return Promise.all([
        getDb()
          .select()
          .from(stockItemLocations)
          .where(eq(stockItemLocations.businessId, owner.businessId))
          .orderBy(stockItemLocations.itemId, stockItemLocations.locationId),
        getDb()
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.businessId, owner.businessId))
          .orderBy(stockMovements.id),
        getDb()
          .select()
          .from(products)
          .where(eq(products.businessId, owner.businessId))
          .orderBy(products.id),
        getDb()
          .select()
          .from(productCompositions)
          .where(eq(productCompositions.businessId, owner.businessId))
          .orderBy(productCompositions.productId),
        getDb()
          .select()
          .from(compositionRevisions)
          .where(eq(compositionRevisions.businessId, owner.businessId))
          .orderBy(compositionRevisions.id),
        getDb()
          .select()
          .from(recipeSaleResolutions)
          .where(eq(recipeSaleResolutions.businessId, owner.businessId))
          .orderBy(recipeSaleResolutions.id),
        getDb()
          .select()
          .from(independentRecipeRevisions)
          .where(eq(independentRecipeRevisions.businessId, owner.businessId))
          .orderBy(independentRecipeRevisions.id),
      ]);
    }
    const before = await snapshot();
    const list = await read(owner.locationId, recipesOnly);
    expect(list).toMatchObject({
      locationId: owner.locationId,
      currencyCode: "USD",
      minorUnits: 2,
    });
    const byId = new Map(list.recipes.map((row) => [row.productId, row]));
    expect(byId.size).toBe(10);
    expect(byId.has(detachedId)).toBe(false);
    expect(byId.has(foreignProduct)).toBe(false);
    expect(JSON.stringify(list)).not.toContain("Secreto");
    expect(byId.get(normalId)).toMatchObject({
      recipeCost: "0.10",
      price: "0.21",
      profit: "0.11",
      marginPercent: "50.0",
      ingredientCount: 1,
      recipeCount: 1,
      missingCosts: [],
    });
    expect(byId.get(halfId)).toMatchObject({
      recipeCost: "0.11",
      profit: "0.10",
      marginPercent: "50.0",
    });
    expect(byId.get(comboId)).toMatchObject({
      isCombo: true,
      recipeCount: 2,
      recipeCost: "1.00",
      price: "2.00",
      profit: "1.00",
      marginPercent: "50.0",
    });
    expect(byId.get(missingId)).toMatchObject({
      recipeCost: null,
      price: "5.00",
      profit: null,
      marginPercent: null,
      missingCosts: [
        { itemId: absent.id, itemName: absent.name },
        { itemId: missing.id, itemName: missing.name },
      ],
    });
    expect(byId.get(noPriceId)).toMatchObject({
      recipeCost: "0.10",
      price: null,
      profit: null,
      marginPercent: null,
    });
    expect(byId.get(zeroPriceId)).toMatchObject({
      recipeCost: "0.10",
      price: "0.00",
      profit: "-0.10",
      marginPercent: null,
    });
    expect(byId.get(lossId)).toMatchObject({
      recipeCost: "0.10",
      profit: "-0.05",
      marginPercent: "-109.8",
    });
    // 0242 / ADR0148: positive physical provenance rounded to zero has no ledger.
    // Absence of that movement cannot certify a complete zero cost.
    expect(byId.get(roundedZeroId)).toMatchObject({
      recipeCost: null,
      profit: null,
      marginPercent: null,
      missingCosts: [],
      costStatus: "rounded_to_zero",
    });
    for (const id of [freeId, emptyId])
      expect(byId.get(id)).toMatchObject({
        recipeCost: "0.00",
        profit: "1.00",
        marginPercent: "100.0",
        missingCosts: [],
      });
    const secondList = await read(second.id);
    expect(
      secondList.recipes.find((row) => row.productId === normalId),
    ).toMatchObject({
      recipeCost: "0.20",
      price: "0.21",
      profit: "0.01",
      marginPercent: "2.4",
    });
    const cop = await read(foreign.locationId, foreign.cookie);
    expect(cop).toMatchObject({
      currencyCode: "COP",
      minorUnits: 0,
      recipes: [
        {
          productId: foreignProduct,
          recipeCost: "11",
          price: "10",
          profit: "-1",
          marginPercent: "-5.0",
        },
      ],
    });
    for (const row of [
      ...list.recipes,
      ...secondList.recipes,
      ...cop.recipes,
    ]) {
      if (
        row.recipeCost !== null &&
        row.profit !== null &&
        row.price !== null
      ) {
        const units = (value: string) => BigInt(value.replace(".", ""));
        expect(units(row.recipeCost) + units(row.profit)).toBe(
          units(row.price),
        );
      }
    }
    expect(await snapshot()).toEqual(before);
    for (const suffix of [
      "/costs?locationId=no-uuid",
      `/costs?locationId=${foreign.locationId}`,
    ]) {
      const response = await call(suffix);
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        code: "location_not_found",
      });
    }
    const noLocation = await call("/costs");
    expect(noLocation.status).toBe(422);
    expect(await noLocation.json()).toMatchObject({
      code: "location_required",
    });
    expect(
      (await call(`/costs?locationId=${owner.locationId}`, forbidden)).status,
    ).toBe(403);
    expect((await call("", owner.cookie)).status).toBe(404);
    await getDb()
      .update(businessModules)
      .set({ enabled: false })
      .where(
        and(
          eq(businessModules.businessId, owner.businessId),
          eq(businessModules.moduleId, "recipes"),
        ),
      );
    const disabled = await call(`/costs?locationId=${owner.locationId}`);
    expect(disabled.status).toBe(403);
    expect(await disabled.json()).toMatchObject({ code: "module_disabled" });
  }, 240_000);
});
