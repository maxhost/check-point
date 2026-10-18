import { withDbTransaction } from "@mi-pasaporte/db";
import {
  compositionRevisions,
  independentRecipeRevisions,
  locations,
  productCompositions,
  products,
  recipeSaleResolutions,
  stockItemLocations,
} from "@mi-pasaporte/db/schema";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { and, eq, inArray, sql } from "drizzle-orm";
import { fromDb } from "../../decimal";
import { ModuleError } from "../../errors";
import { consumptionMinorUnits } from "../../stock/consumption-money";
import type { RecipeCostListDTO } from "./contracts";
import { compareName } from "./model/common";
import {
  compositionBasis,
  assertCompositionCapture,
} from "./model/publication";
import { projectRecipeCostIngredients, recipeCostMoney } from "./measured-cost";

/** Current, single-unit costs. Never initializes Stock pairs or captures a sale. */
export async function listRecipeCosts(
  business: { id: string; currencyCode: string },
  rawLocationId: string | null,
): Promise<RecipeCostListDTO> {
  if (!rawLocationId)
    throw new ModuleError(422, "location_required", "Elige un local.");
  if (!isUuid(rawLocationId))
    throw new ModuleError(404, "location_not_found", "Ese local no existe.");
  const locationId = rawLocationId.toLowerCase();
  const minorUnits = consumptionMinorUnits(business.currencyCode);
  return withDbTransaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );
    const [location] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.businessId, business.id),
          eq(locations.id, locationId),
        ),
      );
    if (!location)
      throw new ModuleError(404, "location_not_found", "Ese local no existe.");

    const rows = await tx
      .select({
        productId: products.id,
        productName: products.name,
        price: products.unitPrice,
        soldByWeight: products.soldByWeight,
        pricingUnit: products.pricingUnit,
        composition: compositionRevisions,
        resolution: recipeSaleResolutions,
      })
      .from(productCompositions)
      .innerJoin(
        products,
        and(
          eq(products.businessId, business.id),
          eq(products.id, productCompositions.productId),
        ),
      )
      .innerJoin(
        compositionRevisions,
        and(
          eq(compositionRevisions.businessId, business.id),
          eq(compositionRevisions.id, productCompositions.revisionId),
        ),
      )
      .innerJoin(
        recipeSaleResolutions,
        and(
          eq(recipeSaleResolutions.businessId, business.id),
          eq(recipeSaleResolutions.id, productCompositions.resolutionId),
        ),
      )
      .where(eq(productCompositions.businessId, business.id));
    for (const row of rows) {
      if (row.composition.productId !== row.productId)
        throw new Error("Current product composition is inconsistent");
      assertCompositionCapture(row.composition, row.resolution);
    }
    const configured = rows.filter((row) => row.resolution.components.length);
    const revisionIds = [
      ...new Set(
        configured.flatMap((r) =>
          r.resolution.components.map((c) => c.recipeRevisionId),
        ),
      ),
    ];
    const revisions = revisionIds.length
      ? await tx
          .select()
          .from(independentRecipeRevisions)
          .where(
            and(
              eq(independentRecipeRevisions.businessId, business.id),
              inArray(independentRecipeRevisions.id, revisionIds),
            ),
          )
      : [];
    const expanded = configured.map((row) => ({
      ...row,
      expanded: projectRecipeCostIngredients(
        row.resolution.components,
        revisions,
        compositionBasis(row.resolution),
        row,
      ),
    }));
    const itemIds = [
      ...new Set(
        expanded.flatMap((r) =>
          (r.expanded?.ingredients ?? []).map((i) => i.itemId),
        ),
      ),
    ];
    const averages = itemIds.length
      ? await tx
          .select({
            itemId: stockItemLocations.itemId,
            cost: stockItemLocations.weightedAverageUnitCost,
          })
          .from(stockItemLocations)
          .where(
            and(
              eq(stockItemLocations.businessId, business.id),
              eq(stockItemLocations.locationId, locationId),
              inArray(stockItemLocations.itemId, itemIds),
            ),
          )
      : [];
    const costs = new Map(averages.map((row) => [row.itemId, row.cost]));
    const recipes = expanded.map((row) => {
      let exactCost = 0n;
      let roundedToZero = false;
      const missingCosts: { itemId: string; itemName: string }[] = [];
      for (const ingredient of row.expanded?.ingredients ?? []) {
        const quantity = fromDb(ingredient.quantity, 3);
        if (quantity === 0n) {
          roundedToZero = true;
          continue;
        }
        const average = costs.get(ingredient.itemId);
        if (average === null || average === undefined)
          missingCosts.push({
            itemId: ingredient.itemId,
            itemName: ingredient.itemName,
          });
        else exactCost += quantity * fromDb(average, 6);
      }
      missingCosts.sort((a, b) =>
        compareName(
          { id: a.itemId, name: a.itemName },
          { id: b.itemId, name: b.itemName },
        ),
      );
      const costStatus = !row.expanded
        ? ("incompatible_basis" as const)
        : roundedToZero
          ? ("rounded_to_zero" as const)
          : missingCosts.length
            ? ("missing_costs" as const)
            : ("complete" as const);
      const money = recipeCostMoney(
        exactCost,
        row.price,
        business.currencyCode,
        costStatus === "complete",
      );
      return {
        productId: row.productId,
        productName: row.productName,
        isCombo: row.composition.isCombo,
        compositionRevisionId: row.composition.id,
        resolutionId: row.resolution.id,
        ingredientCount: row.resolution.components.reduce(
          (sum, component) =>
            sum +
            revisions.find((r) => r.id === component.recipeRevisionId)!.lines
              .length,
          0,
        ),
        recipeCount: row.resolution.components.length,
        ...compositionBasis(row.resolution),
        pricingUnit: row.pricingUnit as "unit" | "kg" | "lb" | "g",
        costStatus,
        ...money,
        missingCosts,
      };
    });
    recipes.sort((a, b) =>
      compareName(
        { id: a.productId, name: a.productName },
        { id: b.productId, name: b.productName },
      ),
    );
    return {
      locationId,
      currencyCode: business.currencyCode,
      minorUnits,
      recipes,
    };
  });
}
