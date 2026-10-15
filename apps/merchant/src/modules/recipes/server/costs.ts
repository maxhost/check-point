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
import { formatDecimal, fromDb, roundDiv } from "../../decimal";
import { ModuleError } from "../../errors";
import { consumptionMinorUnits } from "../../stock/consumption-money";
import type { RecipeCostListDTO } from "./contracts";
import { compareName } from "./model/common";
import { expandComposition } from "./model/expand";

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
    for (const row of rows)
      if (
        row.composition.productId !== row.productId ||
        row.resolution.productId !== row.productId ||
        row.resolution.compositionRevisionId !== row.composition.id
      )
        throw new Error("Current composition references are inconsistent");
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
      expanded: expandComposition(row.resolution.components, revisions),
    }));
    const itemIds = [
      ...new Set(
        expanded.flatMap((r) => r.expanded.ingredients.map((i) => i.itemId)),
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
      const missingCosts: { itemId: string; itemName: string }[] = [];
      for (const ingredient of row.expanded.ingredients) {
        const quantity = fromDb(ingredient.quantity, 3);
        if (quantity === 0n) continue;
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
      const roundedCost = roundDiv(exactCost, 10n ** BigInt(9 - minorUnits));
      const price2 = row.price === null ? null : fromDb(row.price, 2);
      const priceFactor = 10n ** BigInt(2 - minorUnits);
      if (price2 !== null && price2 % priceFactor !== 0n)
        throw new ModuleError(
          422,
          "invalid_number",
          "El precio del catálogo no coincide con la unidad mínima de tu moneda.",
        );
      const price = price2 === null ? null : price2 / priceFactor;
      const complete = missingCosts.length === 0;
      const price9 = price2 === null ? null : price2 * 10n ** 7n;
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
        recipeCost: complete ? formatDecimal(roundedCost, minorUnits) : null,
        price: price === null ? null : formatDecimal(price, minorUnits),
        profit:
          complete && price !== null
            ? formatDecimal(price - roundedCost, minorUnits)
            : null,
        marginPercent:
          complete && price9 !== null && price9 > 0n
            ? formatDecimal(roundDiv((price9 - exactCost) * 1000n, price9), 1)
            : null,
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
