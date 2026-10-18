/** API decimals use a dot, no exponent; parsers return a canonical representation. */
export type Decimal = string;
export type MassUnit = "kg" | "lb" | "g";
export type MeasureUnit = "unit" | MassUnit;
export const CONVERSION_VERSION = "mass-si-1" as const;
export type LineMeasure =
  | {
      kind: "unit";
      quantityUnit: "unit";
      priceUnit: "unit";
      conversionVersion: typeof CONVERSION_VERSION;
    }
  | {
      kind: "mass";
      quantityUnit: MassUnit;
      priceUnit: MassUnit;
      conversionVersion: typeof CONVERSION_VERSION;
    };
/** Physical ratios have no monetary scale. Denominator is positive, pair reduced. */
export type ExactRatio = Readonly<{
  numerator: string;
  denominator: string;
}>;
export type QuantityCapture = Readonly<{
  quantity: Decimal;
  quantityUnit: MeasureUnit;
}>;
export type MeasureErrorCode =
  | "invalid_measure"
  | "invalid_quantity"
  | "invalid_price"
  | "invalid_unit"
  | "amount_out_of_range";
export class MeasureError extends Error {
  readonly status = 422;
  constructor(
    readonly code: MeasureErrorCode,
    readonly field: string,
  ) {
    super(code);
    this.name = "MeasureError";
  }
}

export type { FinancialInputV2 } from "../financial/types";
