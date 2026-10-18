import { captureQuantity } from "@mi-pasaporte/domain/measures";
import type { CapturedCompositionBasis } from "./expand-measured";
import { type DbTransaction } from "@mi-pasaporte/db";
import {
  compositionRevisions,
  independentRecipeRevisions,
  productCompositions,
  recipeSaleResolutions,
  recipeEntities,
  moduleResourceVersions,
  type RecipeComponent,
} from "@mi-pasaporte/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { setResourceVersion } from "../../../../server/module-events";
import { activeRecipe, notFound } from "./common";
import { expandComposition } from "./expand";

export async function resolveComponents(
  tx: DbTransaction,
  businessId: string,
  components: RecipeComponent[],
) {
  const ids = components.map((c) => c.recipeId);
  const recipes = ids.length
    ? await tx
        .select()
        .from(recipeEntities)
        .where(
          and(
            eq(recipeEntities.businessId, businessId),
            inArray(recipeEntities.id, ids),
          ),
        )
    : [];
  if (recipes.length !== ids.length) throw notFound("recipe");
  const byId = new Map(recipes.map((r) => [r.id, r]));
  return components.map((c) => {
    const recipe = byId.get(c.recipeId)!;
    activeRecipe(recipe.status);
    return { ...c, recipeRevisionId: recipe.revisionId };
  });
}
export async function publishResolution(
  tx: DbTransaction,
  businessId: string,
  revision: typeof compositionRevisions.$inferSelect,
) {
  const components = await resolveComponents(tx, businessId, revision.recipes);
  expandComposition(
    components,
    await revisionIngredients(
      tx,
      businessId,
      components.map((c) => c.recipeRevisionId),
    ),
  );
  const [resolution] = await tx
    .insert(recipeSaleResolutions)
    .values({
      businessId,
      productId: revision.productId,
      compositionRevisionId: revision.id,
      components,
      ...compositionBasis(revision),
    })
    .returning();
  await tx
    .delete(moduleResourceVersions)
    .where(
      and(
        eq(moduleResourceVersions.businessId, businessId),
        eq(moduleResourceVersions.resourceType, "product"),
        eq(moduleResourceVersions.resourceId, revision.productId),
        eq(moduleResourceVersions.providerId, "recipes"),
        eq(moduleResourceVersions.slot, "recipe"),
      ),
    );
  await tx
    .insert(productCompositions)
    .values({
      businessId,
      productId: revision.productId,
      revisionId: revision.id,
      resolutionId: resolution.id,
    })
    .onConflictDoUpdate({
      target: productCompositions.productId,
      set: { revisionId: revision.id, resolutionId: resolution.id },
    });
  await setResourceVersion(tx, {
    businessId,
    resourceType: "product",
    resourceId: revision.productId,
    providerId: "recipes",
    slot: "composition",
    versionId: resolution.id,
  });
  return resolution;
}
export async function fanoutRecipe(
  tx: DbTransaction,
  businessId: string,
  recipeId: string,
) {
  const current = await tx
    .select({ revision: compositionRevisions })
    .from(productCompositions)
    .innerJoin(
      compositionRevisions,
      and(
        eq(productCompositions.revisionId, compositionRevisions.id),
        eq(productCompositions.businessId, compositionRevisions.businessId),
      ),
    )
    .where(eq(productCompositions.businessId, businessId));
  for (const { revision } of current
    .filter((r) => r.revision.recipes.some((c) => c.recipeId === recipeId))
    .sort((a, b) => a.revision.productId.localeCompare(b.revision.productId)))
    await publishResolution(tx, businessId, revision);
}
export async function revisionIngredients(
  tx: DbTransaction,
  businessId: string,
  ids: string[],
) {
  return ids.length
    ? tx
        .select()
        .from(independentRecipeRevisions)
        .where(
          and(
            eq(independentRecipeRevisions.businessId, businessId),
            inArray(independentRecipeRevisions.id, ids),
          ),
        )
    : [];
}

export function compositionBasis(row: {
  basisQuantity: string;
  basisUnit: string;
  conversionVersion: string;
}): CapturedCompositionBasis {
  if (
    (row.basisUnit !== "unit" &&
      row.basisUnit !== "kg" &&
      row.basisUnit !== "lb" &&
      row.basisUnit !== "g") ||
    row.conversionVersion !== "mass-si-1"
  )
    throw new Error("Invalid captured composition basis");
  const capture = captureQuantity(row.basisQuantity, row.basisUnit);
  return {
    basisQuantity: capture.quantity,
    basisUnit: capture.quantityUnit,
    conversionVersion: "mass-si-1",
  };
}
export function assertCompositionCapture(
  revision: typeof compositionRevisions.$inferSelect,
  resolution: typeof recipeSaleResolutions.$inferSelect,
) {
  const a = compositionBasis(revision),
    b = compositionBasis(resolution);
  if (
    revision.productId !== resolution.productId ||
    resolution.compositionRevisionId !== revision.id ||
    a.basisQuantity !== b.basisQuantity ||
    a.basisUnit !== b.basisUnit ||
    a.conversionVersion !== b.conversionVersion ||
    revision.recipes.length !== resolution.components.length ||
    revision.recipes.some((c, i) => {
      const r = resolution.components[i];
      return (
        c.recipeId !== r.recipeId ||
        c.quantity !== r.quantity ||
        c.position !== r.position
      );
    })
  )
    throw new Error("Inconsistent published composition capture");
}
