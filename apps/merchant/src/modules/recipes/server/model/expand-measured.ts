import type { ResolvedRecipeComponent } from "@mi-pasaporte/db/schema";
import {
  add,
  divide,
  multiply,
  rational,
  type Rational,
} from "@mi-pasaporte/domain/financial/rational";
import {
  CONVERSION_VERSION,
  MeasureError,
  captureQuantity,
  decimalRational,
  parseMeasure,
  quantityIn,
  ratioOf,
  trustedUnitSnapshotQuantity,
  type Decimal,
  type LineMeasure,
  type MeasureUnit,
} from "@mi-pasaporte/domain/measures";
import { formatDecimal, parseDecimal, roundDiv } from "../../../decimal";
import { ModuleError } from "../../../errors";
import type { IngredientRevision } from "./expand";

export type CapturedCompositionBasis = Readonly<{
  basisQuantity: Decimal;
  basisUnit: MeasureUnit;
  conversionVersion: typeof CONVERSION_VERSION;
}>;
export type MeasuredRecipeSale = Readonly<{
  quantity: Decimal;
  measure: LineMeasure;
  /** Persisted V4 unit snapshots only; never choose this path for HTTP input. */
  quantitySource?: "capture" | "trusted-unit-snapshot";
}>;

/** Captured recipe quantities are numeric(14,3), not product-input quantities. */
function snapshotQuantity(value: string): Rational {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,3})?$/.test(value))
    throw new Error("Invalid ingredient or component snapshot");
  const scaled = parseDecimal(value, {
    scale: 3,
    intDigits: 11,
    label: "Cantidad capturada",
  });
  if (scaled <= 0n) throw new Error("Invalid ingredient or component snapshot");
  return rational(scaled, 1000n);
}
const project = (value: Rational, scale: number) =>
  formatDecimal(roundDiv(value.n * 10n ** BigInt(scale), value.d), scale);

/** Pure expansion of ONE sold line. Captured basis/revisions are the only authority.
 * Compatibility projections can be zero; positive physical ratios remain authoritative.
 * This helper neither creates stock movements nor determines a cost.
 */
export function expandMeasuredComposition(
  components: readonly ResolvedRecipeComponent[],
  revisions: readonly IngredientRevision[],
  sale: MeasuredRecipeSale,
  basis: CapturedCompositionBasis,
) {
  const measure = parseMeasure(sale.measure);
  if (!basis || basis.conversionVersion !== CONVERSION_VERSION)
    throw new MeasureError("invalid_measure", "basis");
  const capturedBasis = captureQuantity(basis.basisQuantity, basis.basisUnit);
  let sold: Rational;
  if (sale.quantitySource === "trusted-unit-snapshot") {
    if (measure.kind !== "unit" || basis.basisUnit !== "unit")
      throw new MeasureError("invalid_measure", "quantitySource");
    sold = decimalRational(trustedUnitSnapshotQuantity(sale.quantity));
  } else {
    if (sale.quantitySource !== undefined && sale.quantitySource !== "capture")
      throw new MeasureError("invalid_measure", "quantitySource");
    sold = quantityIn(
      captureQuantity(sale.quantity, measure.quantityUnit),
      capturedBasis.quantityUnit,
    );
  }
  const factor = divide(sold, decimalRational(capturedBasis.quantity));
  const byRevision = new Map(
    revisions.map((revision) => [revision.id, revision]),
  );
  if (byRevision.size !== revisions.length)
    throw new Error("Duplicate captured independent recipe revision");
  const seenRecipes = new Set<string>();
  const sources = components.flatMap((component) => {
    if (seenRecipes.has(component.recipeId))
      throw new Error("Duplicate captured recipe component");
    seenRecipes.add(component.recipeId);
    const revision = byRevision.get(component.recipeRevisionId);
    if (!revision || revision.recipeId !== component.recipeId)
      throw new Error("Captured independent recipe revision unavailable");
    const recipeQuantity = multiply(
      snapshotQuantity(component.quantity),
      factor,
    );
    return revision.lines.map((ingredient) => ({
      ...ingredient,
      recipeId: component.recipeId,
      recipeRevisionId: component.recipeRevisionId,
      recipeName: revision.name,
      recipeQuantity,
      exact: multiply(snapshotQuantity(ingredient.quantity), recipeQuantity),
      allocated: 0n,
    }));
  });
  const byItem = new Map<string, typeof sources>();
  for (const source of sources) {
    const parts = byItem.get(source.itemId) ?? [];
    parts.push(source);
    byItem.set(source.itemId, parts);
  }
  const ingredients = [...byItem].map(([itemId, parts]) => {
    if (parts.some((part) => part.unit !== parts[0].unit))
      throw new Error("Inconsistent captured ingredient unit");
    const exact = parts.reduce(
      (sum, part) => add(sum, part.exact),
      rational(0n),
    );
    const quantity = roundDiv(exact.n * 1000n, exact.d);
    if (quantity >= 10n ** 14n)
      throw new ModuleError(
        422,
        "invalid_number",
        "La composición supera la cantidad máxima de un insumo.",
      );
    for (const part of parts)
      part.allocated = (part.exact.n * 1000n) / part.exact.d;
    let remainder =
      quantity - parts.reduce((sum, part) => sum + part.allocated, 0n);
    const ordered = [...parts].sort((a, b) => {
      const x = ((a.exact.n * 1000n) % a.exact.d) * b.exact.d;
      const y = ((b.exact.n * 1000n) % b.exact.d) * a.exact.d;
      return x > y
        ? -1
        : x < y
          ? 1
          : a.recipeId.localeCompare(b.recipeId) ||
            a.recipeRevisionId.localeCompare(b.recipeRevisionId);
    });
    for (const part of ordered)
      if (remainder > 0n) {
        part.allocated++;
        remainder--;
      }
    return {
      itemId,
      itemName: parts[0].itemName,
      unit: parts[0].unit,
      exactQuantityRatio: ratioOf(exact),
      exactQuantity: project(exact, 6),
      quantity: formatDecimal(quantity, 3),
      // Compare the rational, never the compatibility projection.
      roundingReason:
        exact.n * 1000n === quantity * exact.d
          ? null
          : quantity === 0n
            ? ("rounded_to_zero" as const)
            : ("precision_changed" as const),
    };
  });
  return {
    factor: ratioOf(factor),
    sources: sources.map((source) => ({
      itemId: source.itemId,
      itemName: source.itemName,
      unit: source.unit,
      recipeId: source.recipeId,
      recipeRevisionId: source.recipeRevisionId,
      recipeName: source.recipeName,
      recipeQuantityRatio: ratioOf(source.recipeQuantity),
      exactQuantityRatio: ratioOf(source.exact),
      recipeQuantity: project(source.recipeQuantity, 3),
      exactQuantity: project(source.exact, 6),
      allocatedQuantity: formatDecimal(source.allocated, 3),
    })),
    ingredients,
    rounding: ingredients
      .filter((ingredient) => ingredient.roundingReason !== null)
      .map((ingredient) => ({
        itemId: ingredient.itemId,
        exactQuantityRatio: ingredient.exactQuantityRatio,
        exactQuantity: ingredient.exactQuantity,
        quantity: ingredient.quantity,
        reason: ingredient.roundingReason!,
      })),
  };
}
