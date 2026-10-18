import type { DbTransaction } from "@mi-pasaporte/db";
import {
  independentRecipeRevisions,
  recipeSaleResolutions,
} from "@mi-pasaporte/db/schema";
import { trustedUnitSnapshotQuantity } from "@mi-pasaporte/domain/measures";
import { and, eq, inArray } from "drizzle-orm";
import type { MeasuredSaleClosedEvent } from "../../../../server/module-events/types";
import type { ExpectedCostLine } from "../../../stock/server/consumption-cost";
import { capturedConsumption, type CapturedSource } from "./captured";
import { expandMeasuredComposition } from "./expand-measured";

/** Explicit dormant API: no V4 producer or subscription is enabled here. */
export async function capturedMeasuredConsumption(
  tx: DbTransaction,
  businessId: string,
  event: MeasuredSaleClosedEvent,
) {
  if (event.eventVersion !== 4)
    return capturedConsumption(tx, businessId, event);
  const selected = event.lines.map((line) => {
    const refs = line.resourceVersions.filter(
      (r) =>
        r.providerId === "recipes" &&
        (r.slot === "recipe" || r.slot === "composition"),
    );
    if (refs.length > 1) throw new Error("Conflicting captured recipe slots");
    if (refs.length && !line.productId)
      throw new Error("Captured recipe product unavailable");
    if (refs[0]?.slot === "recipe" && line.measure.kind !== "unit")
      throw new Error("Legacy captured recipe requires unit measure");
    return refs[0];
  });
  const ids = selected
    .filter((r) => r?.slot === "composition")
    .map((r) => r!.versionId);
  const resolutions = ids.length
    ? await tx
        .select()
        .from(recipeSaleResolutions)
        .where(
          and(
            eq(recipeSaleResolutions.businessId, businessId),
            inArray(recipeSaleResolutions.id, ids),
          ),
        )
    : [];
  const revisionIds = [
    ...new Set(
      resolutions.flatMap((r) => r.components.map((c) => c.recipeRevisionId)),
    ),
  ];
  const revisions = revisionIds.length
    ? await tx
        .select()
        .from(independentRecipeRevisions)
        .where(
          and(
            eq(independentRecipeRevisions.businessId, businessId),
            inArray(independentRecipeRevisions.id, revisionIds),
          ),
        )
    : [];
  const movements: Awaited<
    ReturnType<typeof capturedConsumption>
  >["movements"] = [];
  const sources: CapturedSource[] = [];
  const expectedLines: ExpectedCostLine[] = [];
  for (const [index, line] of event.lines.entries()) {
    const ref = selected[index];
    if (ref?.slot === "recipe") {
      const quantity = Number(trustedUnitSnapshotQuantity(line.quantity));
      const legacy = await capturedConsumption(tx, businessId, {
        ...event,
        eventVersion: 1,
        lines: [{ ...line, quantity }],
      });
      movements.push(...legacy.movements);
      expectedLines.push(...legacy.expectedLines);
      continue;
    }
    const expected: ExpectedCostLine = {
      sourceLineId: line.sourceLineId,
      productId: line.productId,
      recipe: "absent",
      consumptions: [],
    };
    if (ref && line.productId) {
      const resolution = resolutions.find((r) => r.id === ref.versionId);
      if (!resolution || resolution.productId !== line.productId)
        throw new Error("Captured composition resolution unavailable");
      const { basisUnit, conversionVersion } = resolution;
      if (
        (basisUnit !== "unit" &&
          basisUnit !== "g" &&
          basisUnit !== "kg" &&
          basisUnit !== "lb") ||
        conversionVersion !== "mass-si-1"
      )
        throw new Error("Invalid captured composition basis");
      const expanded = expandMeasuredComposition(
        resolution.components,
        revisions,
        {
          quantity: line.quantity,
          measure: line.measure,
          quantitySource:
            line.measure.kind === "unit" ? "trusted-unit-snapshot" : "capture",
        },
        {
          basisQuantity: resolution.basisQuantity,
          basisUnit,
          conversionVersion,
        },
      );
      expected.recipe = expanded.sources.length ? "present" : "absent";
      expected.incompleteRecipe = resolution.components.some(
        (c) =>
          revisions.find((r) => r.id === c.recipeRevisionId)?.lines.length ===
          0,
      );
      expected.roundingOmissions = expanded.ingredients.some(
        (i) => i.quantity === "0.000",
      );
      for (const ingredient of expanded.ingredients.filter(
        (i) => i.quantity !== "0.000",
      )) {
        movements.push({
          sourceLineId: line.sourceLineId,
          productId: line.productId,
          itemId: ingredient.itemId,
          quantity: ingredient.quantity,
        });
        expected.consumptions.push({
          itemId: ingredient.itemId,
          quantity: ingredient.quantity,
        });
      }
      for (const s of expanded.sources)
        sources.push({
          sourceLineId: line.sourceLineId,
          productId: line.productId,
          resolutionId: resolution.id,
          compositionRevisionId: resolution.compositionRevisionId,
          recipeId: s.recipeId,
          recipeRevisionId: s.recipeRevisionId,
          itemId: s.itemId,
          recipeQuantity: s.recipeQuantity,
          exactQuantity: s.exactQuantity,
          allocatedQuantity: s.allocatedQuantity,
          quantityVersion: 2,
          recipeQuantityNumerator: s.recipeQuantityRatio.numerator,
          recipeQuantityDenominator: s.recipeQuantityRatio.denominator,
          exactQuantityNumerator: s.exactQuantityRatio.numerator,
          exactQuantityDenominator: s.exactQuantityRatio.denominator,
        });
    }
    expectedLines.push(expected);
  }
  return { movements, sources, expectedLines };
}
