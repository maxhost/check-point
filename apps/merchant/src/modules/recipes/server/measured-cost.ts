import type { ResolvedRecipeComponent } from "@mi-pasaporte/db/schema";
import {
  CONVERSION_VERSION,
  UNIT_MEASURE,
  decimalRational,
  isMassUnit,
  normalizedGross,
  trustedUnitSnapshotPrice,
} from "@mi-pasaporte/domain/measures";
import { multiply, rational } from "@mi-pasaporte/domain/financial/rational";
import { formatDecimal, fromDb, roundDiv } from "../../decimal";
import { consumptionMinorUnits } from "../../stock/consumption-money";
import {
  expandMeasuredComposition,
  type CapturedCompositionBasis,
} from "./model/expand-measured";
import type { IngredientRevision } from "./model/expand";

/** Project physical ingredients first. Ledger rounding occurs once per ingredient. */
export function projectRecipeCostIngredients(
  components: readonly ResolvedRecipeComponent[],
  revisions: readonly IngredientRevision[],
  basis: CapturedCompositionBasis,
  product: { soldByWeight: boolean; pricingUnit: string },
) {
  if ((basis.basisUnit === "unit") === product.soldByWeight) return null;
  const unit = product.pricingUnit;
  if (product.soldByWeight ? !isMassUnit(unit) : unit !== "unit")
    throw new Error("Invalid product pricing unit");
  if (unit !== "unit" && !isMassUnit(unit))
    throw new Error("Invalid pricing unit");
  return expandMeasuredComposition(
    components,
    revisions,
    {
      quantity: "1",
      measure:
        unit === "unit"
          ? UNIT_MEASURE
          : {
              kind: "mass",
              quantityUnit: unit,
              priceUnit: unit,
              conversionVersion: CONVERSION_VERSION,
            },
    },
    basis,
  );
}

export function recipeCostMoney(
  exactCost: bigint,
  rawPrice: string | null,
  currencyCode: string,
  complete: boolean,
) {
  const minorUnits = consumptionMinorUnits(currencyCode);
  const roundedCost = roundDiv(exactCost, 10n ** BigInt(9 - minorUnits));
  const originalPrice =
    rawPrice === null
      ? null
      : decimalRational(trustedUnitSnapshotPrice(rawPrice));
  const price =
    originalPrice === null
      ? null
      : normalizedGross(multiply(originalPrice, rational(100n)), currencyCode);
  const priceMinor = price === null ? null : fromDb(price, minorUnits);
  // The margin uses originals; presentation normalization must not change the denominator.
  const price9 =
    originalPrice === null
      ? null
      : multiply(originalPrice, rational(10n ** 9n));
  return {
    recipeCost: complete ? formatDecimal(roundedCost, minorUnits) : null,
    price,
    profit:
      complete && priceMinor !== null
        ? formatDecimal(priceMinor - roundedCost, minorUnits)
        : null,
    marginPercent:
      complete && price9 !== null && price9.n > 0n
        ? formatDecimal(
            roundDiv((price9.n - exactCost * price9.d) * 1000n, price9.n),
            1,
          )
        : null,
  };
}
