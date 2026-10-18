import {
  add,
  rational,
  multiply,
  divide,
  halfUp,
  exact,
  toMinor,
  minorUnitForCurrency,
  formatMinor,
  type Rational,
} from "../financial/rational";
import type { ExactAmount } from "../financial/types";
import {
  decimalRational,
  parsePrice,
  parseQuantity,
  ratioOf,
  terminatingDecimal,
} from "./decimal";
import {
  CONVERSION_VERSION,
  MeasureError,
  type LineMeasure,
  type MassUnit,
  type MeasureUnit,
  type QuantityCapture,
  type ExactRatio,
  type Decimal,
} from "./types";

export const MASS_UNITS: readonly MassUnit[] = Object.freeze(["kg", "lb", "g"]);
export const UNIT_MEASURE: LineMeasure = Object.freeze({
  kind: "unit",
  quantityUnit: "unit",
  priceUnit: "unit",
  conversionVersion: CONVERSION_VERSION,
});
export function isMassUnit(value: unknown): value is MassUnit {
  return value === "kg" || value === "lb" || value === "g";
}
export function gramsFactor(unit: MassUnit): Rational {
  switch (unit) {
    case "g":
      return rational(1n);
    case "kg":
      return rational(1000n);
    case "lb":
      return rational(45359237n, 100000n);
    default:
      throw new MeasureError("invalid_unit", "unit");
  }
}
export function parseMeasure(value: unknown): LineMeasure {
  if (!value || typeof value !== "object")
    throw new MeasureError("invalid_measure", "measure");
  const v = value as Record<string, unknown>;
  if (v.conversionVersion !== CONVERSION_VERSION)
    throw new MeasureError("invalid_measure", "conversionVersion");
  if (v.kind === "unit" && v.quantityUnit === "unit" && v.priceUnit === "unit")
    return UNIT_MEASURE;
  if (
    v.kind === "mass" &&
    isMassUnit(v.quantityUnit) &&
    isMassUnit(v.priceUnit)
  )
    return Object.freeze({
      kind: "mass",
      quantityUnit: v.quantityUnit,
      priceUnit: v.priceUnit,
      conversionVersion: CONVERSION_VERSION,
    });
  throw new MeasureError("invalid_measure", "measure");
}
export function captureQuantity(
  quantity: unknown,
  quantityUnit: MeasureUnit,
): QuantityCapture {
  if (quantityUnit !== "unit" && !isMassUnit(quantityUnit))
    throw new MeasureError("invalid_unit", "quantityUnit");
  const parsed = parseQuantity(quantity);
  if (quantityUnit === "unit" && parsed.includes("."))
    throw new MeasureError("invalid_quantity", "quantity");
  return Object.freeze({ quantity: parsed, quantityUnit });
}
export function quantityIn(
  source: QuantityCapture,
  targetUnit: MeasureUnit,
): Rational {
  const capture = captureQuantity(source.quantity, source.quantityUnit);
  const value = decimalRational(capture.quantity);
  if (capture.quantityUnit === "unit" || targetUnit === "unit") {
    if (capture.quantityUnit !== targetUnit)
      throw new MeasureError("invalid_measure", "quantityUnit");
    return value;
  }
  return divide(
    multiply(value, gramsFactor(capture.quantityUnit)),
    gramsFactor(targetUnit),
  );
}
/** Selector changes only the view. Submit source; editing the number creates a new capture. */
export function presentQuantity(
  source: QuantityCapture,
  targetUnit: MeasureUnit,
  decimalPlaces = 9,
) {
  if (
    !Number.isSafeInteger(decimalPlaces) ||
    decimalPlaces < 0 ||
    decimalPlaces > 14
  )
    throw new MeasureError("invalid_quantity", "decimalPlaces");
  const frozenSource = captureQuantity(source.quantity, source.quantityUnit);
  const value = quantityIn(frozenSource, targetUnit);
  const finite = terminatingDecimal(value);
  const scale = 10n ** BigInt(decimalPlaces);
  const shown = halfUp(value.n * scale, value.d);
  const display =
    finite !== null && (finite.split(".")[1]?.length ?? 0) <= decimalPlaces
      ? finite
      : terminatingDecimal(rational(shown, scale))!;
  return Object.freeze({
    source: frozenSource,
    unit: targetUnit,
    display,
    approximate: finite !== display,
    exact: ratioOf(value),
  });
}
export function exactGrams(source: QuantityCapture): Decimal {
  if (source.quantityUnit === "unit")
    throw new MeasureError("invalid_unit", "quantityUnit");
  return terminatingDecimal(quantityIn(source, "g"))!;
}
export function totalPhysicalQuantities(
  sources: readonly QuantityCapture[],
): { unit: "unit" | "g"; quantity: Decimal }[] {
  let units = rational(0n),
    grams = rational(0n);
  let hasUnits = false,
    hasMass = false;
  for (const source of sources) {
    if (source.quantityUnit === "unit") {
      units = add(units, quantityIn(source, "unit"));
      hasUnits = true;
    } else {
      grams = add(grams, quantityIn(source, "g"));
      hasMass = true;
    }
  }
  return [
    ...(hasUnits
      ? [{ unit: "unit" as const, quantity: terminatingDecimal(units)! }]
      : []),
    ...(hasMass
      ? [{ unit: "g" as const, quantity: terminatingDecimal(grams)! }]
      : []),
  ];
}
/** Financial ExactAmount is rational cents, not physical units. */
export function exactLineGross(
  quantity: unknown,
  unitPrice: unknown,
  rawMeasure: unknown,
): ExactAmount {
  const measure = parseMeasure(rawMeasure);
  const capture = captureQuantity(quantity, measure.quantityUnit);
  const count = quantityIn(capture, measure.priceUnit);
  const cents = multiply(
    multiply(count, decimalRational(parsePrice(unitPrice))),
    rational(100n),
  );
  assertMoneyRange(cents);
  return exact(cents);
}
const MAX_MONEY_CENTS = 999_999_999_999n;
/** numeric(12,2) limit, including the original before currency normalization. */
export function assertMoneyRange(cents: Rational, currencyCode?: string): void {
  if (cents.n < 0n || cents.n > MAX_MONEY_CENTS * cents.d)
    throw new MeasureError("amount_out_of_range", "amount");
  if (currencyCode) {
    const minor = minorUnitForCurrency(currencyCode);
    const normalizedCents = toMinor(cents, minor) * (minor === 0 ? 100n : 1n);
    if (normalizedCents > MAX_MONEY_CENTS)
      throw new MeasureError("amount_out_of_range", "amount");
  }
}
/** Normalization for displaying one exact gross; settlement still owns line allocation. */
export function normalizedGross(cents: Rational, currencyCode: string): string {
  assertMoneyRange(cents, currencyCode);
  const minor = minorUnitForCurrency(currencyCode);
  return formatMinor(toMinor(cents, minor), minor);
}
export function quantityRatio(
  source: QuantityCapture,
  targetUnit: MeasureUnit,
): ExactRatio {
  return ratioOf(quantityIn(source, targetUnit));
}
/** Aggregate unrounded originals; normalize once, never sum rounded display lines. */
export function exactOrderGross(
  lines: readonly {
    quantity: unknown;
    unitPrice: unknown;
    measure: unknown;
  }[],
  currencyCode: string,
): ExactAmount {
  const cents = lines.reduce((sum, line) => {
    const value = exactLineGross(line.quantity, line.unitPrice, line.measure);
    return add(
      sum,
      rational(BigInt(value.numerator), BigInt(value.denominator)),
    );
  }, rational(0n));
  assertMoneyRange(cents, currencyCode);
  return exact(cents);
}
