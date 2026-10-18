import type { DbTransaction } from "@mi-pasaporte/db";
import {
  independentRecipeRevisions,
  recipeSaleResolutions,
  recipeRevisions,
} from "@mi-pasaporte/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { SaleClosedEvent } from "../../../../server/module-events/types";
import type { ExpectedCostLine } from "../../../stock/server/consumption-cost";
import { expandRecipes } from "../consumption-snapshot";
import { expandComposition } from "./expand";

export async function capturedConsumption(
  tx: DbTransaction,
  businessId: string,
  event: SaleClosedEvent,
) {
  const refs = event.lines.flatMap((l) =>
    l.resourceVersions.filter(
      (r) =>
        r.providerId === "recipes" &&
        (r.slot === "recipe" || r.slot === "composition"),
    ),
  );
  const legacyIds = refs
      .filter((r) => r.slot === "recipe")
      .map((r) => r.versionId),
    resolutionIds = refs
      .filter((r) => r.slot === "composition")
      .map((r) => r.versionId);
  const legacy = legacyIds.length
    ? await tx
        .select()
        .from(recipeRevisions)
        .where(
          and(
            eq(recipeRevisions.businessId, businessId),
            inArray(recipeRevisions.id, legacyIds),
          ),
        )
    : [];
  const resolutions = resolutionIds.length
    ? await tx
        .select()
        .from(recipeSaleResolutions)
        .where(
          and(
            eq(recipeSaleResolutions.businessId, businessId),
            inArray(recipeSaleResolutions.id, resolutionIds),
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
  const byResolution = new Map(resolutions.map((r) => [r.id, r]));
  const movements: {
    sourceLineId: string;
    productId: string;
    itemId: string;
    quantity: string;
  }[] = [];
  const sources: CapturedSource[] = [];
  const expectedLines: ExpectedCostLine[] = [];
  for (const line of event.lines) {
    const selected = line.resourceVersions.filter(
      (r) =>
        r.providerId === "recipes" &&
        (r.slot === "recipe" || r.slot === "composition"),
    );
    if (selected.length > 1)
      throw new Error("Conflicting captured recipe slots");
    const ref = selected[0];
    const expected: ExpectedCostLine = {
      sourceLineId: line.sourceLineId,
      productId: line.productId,
      recipe: "absent",
      consumptions: [],
    };
    if (line.productId && ref) {
      if (ref.slot === "recipe") {
        const expanded = expandRecipes({ ...event, lines: [line] }, legacy);
        movements.push(...expanded);
        expected.consumptions = expanded.map(({ itemId, quantity }) => ({
          itemId,
          quantity,
        }));
        expected.recipe = expanded.length ? "present" : "absent";
      } else {
        const resolution = byResolution.get(ref.versionId);
        if (!resolution || resolution.productId !== line.productId)
          throw new Error("Captured composition resolution unavailable");
        const expanded = expandComposition(
          resolution.components,
          revisions,
          line.quantity,
        );
        expected.recipe = expanded.sources.length ? "present" : "absent";
        expected.incompleteRecipe = resolution.components.some(
          (component) =>
            revisions.find(
              (revision) => revision.id === component.recipeRevisionId,
            )?.lines.length === 0,
        );
        expected.roundingOmissions = expanded.ingredients.some(
          (i) => i.quantity === "0.000",
        );
        for (const ingredient of expanded.ingredients.filter(
          (i) => i.quantity !== "0.000",
        )) {
          const consumption = {
            sourceLineId: line.sourceLineId,
            productId: line.productId,
            itemId: ingredient.itemId,
            quantity: ingredient.quantity,
          };
          movements.push(consumption);
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
          });
      }
    }
    expectedLines.push(expected);
  }
  return { movements, sources, expectedLines };
}
type CapturedSourceFields = {
  sourceLineId: string;
  productId: string;
  resolutionId: string;
  compositionRevisionId: string;
  recipeId: string;
  recipeRevisionId: string;
  itemId: string;
  recipeQuantity: string;
  exactQuantity: string;
  allocatedQuantity: string;
};

export type CapturedSource = CapturedSourceFields &
  (
    | {
        quantityVersion?: 1;
        recipeQuantityNumerator?: null;
        recipeQuantityDenominator?: null;
        exactQuantityNumerator?: null;
        exactQuantityDenominator?: null;
      }
    | {
        quantityVersion: 2;
        recipeQuantityNumerator: string;
        recipeQuantityDenominator: string;
        exactQuantityNumerator: string;
        exactQuantityDenominator: string;
      }
  );
