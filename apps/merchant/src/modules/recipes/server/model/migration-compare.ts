import type { DbTransaction } from "@mi-pasaporte/db";
import {
  independentRecipeRevisions,
  productCompositions,
  recipeSaleResolutions,
} from "@mi-pasaporte/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { expandComposition } from "./expand";

type LegacyQuantity = {
  businessId: string;
  productId: string;
  itemId: string;
  quantity: string;
  unit: string;
};
/** Only newly migrated products are compared: a replay must preserve subsequent merchant edits. */
export async function verifyMigratedR1(
  tx: DbTransaction,
  productIds: string[],
  legacy: LegacyQuantity[],
) {
  if (!productIds.length) return 0;
  const resolutions = await tx
    .select({ resolution: recipeSaleResolutions })
    .from(productCompositions)
    .innerJoin(
      recipeSaleResolutions,
      and(
        eq(recipeSaleResolutions.businessId, productCompositions.businessId),
        eq(recipeSaleResolutions.id, productCompositions.resolutionId),
      ),
    )
    .where(inArray(productCompositions.productId, productIds));
  const ids = resolutions.flatMap((r) =>
    r.resolution.components.map((c) => c.recipeRevisionId),
  );
  const revisions = ids.length
    ? await tx
        .select()
        .from(independentRecipeRevisions)
        .where(inArray(independentRecipeRevisions.id, ids))
    : [];
  for (const productId of productIds) {
    const resolution = resolutions.find(
      (r) => r.resolution.productId === productId,
    )?.resolution;
    if (!resolution) throw new Error("R1 migrated resolution unavailable");
    const expected = legacy
      .filter(
        (r) =>
          r.productId === productId && r.businessId === resolution.businessId,
      )
      .map(({ itemId, quantity, unit }) => ({ itemId, quantity, unit }))
      .sort((a, b) => a.itemId.localeCompare(b.itemId));
    const actual = expandComposition(
      resolution.components,
      revisions.filter((r) => r.businessId === resolution.businessId),
    )
      .ingredients.map(({ itemId, quantity, unit }) => ({
        itemId,
        quantity,
        unit,
      }))
      .sort((a, b) => a.itemId.localeCompare(b.itemId));
    if (JSON.stringify(expected) !== JSON.stringify(actual))
      throw new Error("R1 migration changes consumption quantities");
  }
  return productIds.length;
}
