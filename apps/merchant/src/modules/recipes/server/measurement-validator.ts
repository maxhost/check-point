import type { DbTransaction } from "@mi-pasaporte/db";
import {
  compositionRevisions,
  independentRecipeRevisions,
  moduleResourceVersions,
  productCompositions,
  recipeRevisions,
  recipeSaleResolutions,
} from "@mi-pasaporte/db/schema";
import type { ResourceMeasurementValidator } from "@mi-pasaporte/domain/resource-measurement";
import { and, eq, inArray } from "drizzle-orm";
import { expandMeasuredComposition } from "./model/expand-measured";

const incompatible = {
  code: "measurement_basis_required" as const,
  message:
    "Define una base de composición compatible antes de cambiar la medida del producto.",
};
const invalid = () =>
  new Error("Inconsistent published composition measurement");

/** Reads only the currently published immutable capture, never the editable recipe. */
export const validateProductMeasurementChange: ResourceMeasurementValidator<
  DbTransaction
> = async ({ tx, businessId, resourceType, resourceId, newMeasure }) => {
  if (resourceType !== "product") return null;
  const slots = await tx
    .select()
    .from(moduleResourceVersions)
    .where(
      and(
        eq(moduleResourceVersions.businessId, businessId),
        eq(moduleResourceVersions.resourceType, resourceType),
        eq(moduleResourceVersions.resourceId, resourceId),
        eq(moduleResourceVersions.providerId, "recipes"),
        inArray(moduleResourceVersions.slot, ["recipe", "composition"]),
      ),
    );
  const [current] = await tx
    .select()
    .from(productCompositions)
    .where(
      and(
        eq(productCompositions.businessId, businessId),
        eq(productCompositions.productId, resourceId),
      ),
    );
  if (!slots.length && !current) return null;
  if (slots.length !== 1) throw invalid();
  const slot = slots[0];
  if (slot.slot === "recipe") {
    if (current) throw invalid();
    const [revision] = await tx
      .select()
      .from(recipeRevisions)
      .where(
        and(
          eq(recipeRevisions.businessId, businessId),
          eq(recipeRevisions.productId, resourceId),
          eq(recipeRevisions.id, slot.versionId),
        ),
      );
    if (!revision) throw invalid();
    return newMeasure.kind === "unit" ? null : incompatible;
  }
  if (!current || current.resolutionId !== slot.versionId) throw invalid();
  const [resolution] = await tx
    .select()
    .from(recipeSaleResolutions)
    .where(
      and(
        eq(recipeSaleResolutions.businessId, businessId),
        eq(recipeSaleResolutions.productId, resourceId),
        eq(recipeSaleResolutions.id, current.resolutionId),
      ),
    );
  const [revision] = await tx
    .select()
    .from(compositionRevisions)
    .where(
      and(
        eq(compositionRevisions.businessId, businessId),
        eq(compositionRevisions.productId, resourceId),
        eq(compositionRevisions.id, current.revisionId),
      ),
    );
  if (
    !resolution ||
    !revision ||
    resolution.compositionRevisionId !== revision.id ||
    resolution.basisQuantity !== revision.basisQuantity ||
    resolution.basisUnit !== revision.basisUnit ||
    resolution.conversionVersion !== revision.conversionVersion
  )
    throw invalid();
  const declaredRecipes = new Map(
    revision.recipes.map((recipe) => [recipe.recipeId, recipe.quantity]),
  );
  const resolvedIds = new Set(
    resolution.components.map((component) => component.recipeId),
  );
  if (
    declaredRecipes.size !== revision.recipes.length ||
    resolvedIds.size !== resolution.components.length ||
    resolution.components.length !== declaredRecipes.size ||
    resolution.components.some(
      (component) =>
        declaredRecipes.get(component.recipeId) !== component.quantity,
    )
  )
    throw invalid();
  const basisUnit = resolution.basisUnit;
  if (
    (basisUnit !== "unit" &&
      basisUnit !== "kg" &&
      basisUnit !== "lb" &&
      basisUnit !== "g") ||
    resolution.conversionVersion !== "mass-si-1"
  )
    throw invalid();
  const ids = resolution.components.map(
    (component) => component.recipeRevisionId,
  );
  const revisions = ids.length
    ? await tx
        .select()
        .from(independentRecipeRevisions)
        .where(
          and(
            eq(independentRecipeRevisions.businessId, businessId),
            inArray(independentRecipeRevisions.id, ids),
          ),
        )
    : [];
  // Reuse captured-data validation with a sale compatible with the captured basis.
  // It checks positive basis, component/revision identity and ingredient snapshots.
  expandMeasuredComposition(
    resolution.components,
    revisions,
    {
      quantity: resolution.basisQuantity,
      measure:
        basisUnit === "unit"
          ? {
              kind: "unit",
              quantityUnit: "unit",
              priceUnit: "unit",
              conversionVersion: "mass-si-1",
            }
          : {
              kind: "mass",
              quantityUnit: basisUnit,
              priceUnit: basisUnit,
              conversionVersion: "mass-si-1",
            },
    },
    {
      basisQuantity: resolution.basisQuantity,
      basisUnit,
      conversionVersion: "mass-si-1",
    },
  );
  return (basisUnit === "unit") === (newMeasure.kind === "unit")
    ? null
    : incompatible;
};
