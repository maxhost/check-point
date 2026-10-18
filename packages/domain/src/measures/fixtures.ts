import { CONVERSION_VERSION, type LineMeasure } from "./types";
export const massMeasure = (
  quantityUnit: "kg" | "lb" | "g",
  priceUnit = quantityUnit,
): LineMeasure => ({
  kind: "mass",
  quantityUnit,
  priceUnit,
  conversionVersion: CONVERSION_VERSION,
});
/** Synthetic exact contracts; these do not seed a database or authorize a write. */
export const MEASURE_FIXTURES = [
  { quantity: "2", unitPrice: "4", measure: massMeasure("lb"), gross: "8.00" },
  {
    quantity: "250",
    unitPrice: "0.01",
    measure: massMeasure("g"),
    gross: "2.50",
  },
  {
    quantity: "0.25",
    unitPrice: "10",
    measure: massMeasure("kg"),
    gross: "2.50",
  },
  {
    quantity: "250",
    unitPrice: "10",
    measure: massMeasure("g", "kg"),
    gross: "2.50",
  },
] as const;
export const INVALID_DECIMAL_FIXTURES: readonly unknown[] = [
  "NaN",
  "Infinity",
  "1e3",
  "-1",
  "+1",
  "1,5",
  " 1",
  "1 ",
  ".5",
  "1.",
  "1.0000000000",
  "1000000000",
  "999999999.9999999991",
  "",
  null,
  undefined,
  1,
];
