import { isSupportedCurrency } from "@mi-pasaporte/domain/lib/currencies";
import { formatDecimal, fromDb, roundDiv } from "../decimal";

/** Product policy: COP is integer by owner decision, independently of ISO/Intl. */
export function consumptionMinorUnits(currencyCode: string): 0 | 2 {
  if (!isSupportedCurrency(currencyCode))
    throw new Error("Unsupported consumption currency");
  return ["COP", "CLP", "JPY", "PYG"].includes(currencyCode) ? 0 : 2;
}

/** Absolute quantity3 × unit cost6 × factor6, without intermediate rounding. */
export function consumptionAmount(
  quantity: string,
  unitCost: string,
  factor: string,
): bigint {
  const q = fromDb(quantity, 3);
  return (q < 0n ? -q : q) * fromDb(unitCost, 6) * fromDb(factor, 6);
}

export function formatConsumptionAmount(
  amount: bigint,
  minorUnits: number,
): string {
  if (minorUnits !== 0 && minorUnits !== 2)
    throw new Error("Invalid consumption scale");
  return formatDecimal(
    roundDiv(amount, 10n ** BigInt(15 - minorUnits)),
    minorUnits,
  );
}
