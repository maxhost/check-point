import { multiply, rational, exact, formatMinor } from "../financial/rational";
import type { ExactAmount } from "../financial/types";
import { decimalRational, parsePrice } from "./decimal";
import { assertMoneyRange, exactLineGross, parseMeasure } from "./mass";
import { MeasureError, type Decimal } from "./types";

/** Trusted persisted unit snapshots only. Never use this parser for HTTP/catalog input.
 * Legacy SQL quantity was positive int32; widening storage must preserve those rows.
 */
export function trustedUnitSnapshotQuantity(value: unknown): Decimal {
  const raw =
    typeof value === "number" && Number.isSafeInteger(value)
      ? String(value)
      : value;
  if (typeof raw !== "string" || !/^\d{1,10}(?:\.0{1,9})?$/.test(raw))
    throw new MeasureError("invalid_quantity", "quantity");
  const integer = BigInt(raw.split(".")[0]);
  if (integer < 1n || integer > 2147483647n)
    throw new MeasureError("invalid_quantity", "quantity");
  return String(integer);
}

/** Trusted persisted unit tariff: legacy numeric(12,2), including zero padding after
 * numeric(24,9) expansion. This is not permission for a new ten-digit input tariff.
 */
export function trustedUnitSnapshotPrice(value: unknown): Decimal {
  // New snapshots may retain nine-place tariffs within the new bound.
  try {
    return parsePrice(value);
  } catch (error) {
    if (!(error instanceof MeasureError)) throw error;
  }
  if (typeof value !== "string" || !/^\d{1,10}(?:\.\d{1,9})?$/.test(value))
    throw new MeasureError("invalid_price", "price");
  const [whole, part = ""] = value.split(".");
  if (/[^0]/.test(part.slice(2)))
    throw new MeasureError("invalid_price", "price");
  const cents = BigInt(whole) * 100n + BigInt(part.slice(0, 2).padEnd(2, "0"));
  if (cents > 999999999999n) throw new MeasureError("invalid_price", "price");
  const fraction = part.slice(0, 2).replace(/0+$/, "");
  return `${BigInt(whole)}${fraction ? `.${fraction}` : ""}`;
}

/** Explicit historical-unit path. Measured snapshots retain the strict new bounds. */
export function exactSnapshotLineGross(
  quantity: unknown,
  unitPrice: unknown,
  rawMeasure: unknown,
): ExactAmount {
  const measure = parseMeasure(rawMeasure);
  if (measure.kind === "mass")
    return exactLineGross(quantity, unitPrice, measure);
  const count = BigInt(trustedUnitSnapshotQuantity(quantity));
  const price = decimalRational(trustedUnitSnapshotPrice(unitPrice));
  const cents = multiply(price, rational(count * 100n));
  assertMoneyRange(cents);
  return exact(cents);
}

/** Exact v1 projection of trusted DB unit data, separate from the measured snapshot parser. */
export function trustedUnitQuantityNumber(value: unknown): number {
  return Number(trustedUnitSnapshotQuantity(value));
}

export function trustedUnitLegacyPrice(value: unknown): string {
  const raw =
    typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof raw !== "string" || !/^\d{1,10}(?:\.\d{1,9})?$/.test(raw))
    throw new MeasureError("invalid_price", "price");
  const [whole, fraction = ""] = raw.split(".");
  if (/[^0]/.test(fraction.slice(2)))
    throw new MeasureError("invalid_price", "price");
  const cents =
    BigInt(whole) * 100n + BigInt(fraction.slice(0, 2).padEnd(2, "0"));
  assertMoneyRange(rational(cents));
  return formatMinor(cents, 2);
}

export function trustedUnitLineCents(
  quantity: unknown,
  price: unknown,
): bigint {
  const count = BigInt(trustedUnitSnapshotQuantity(quantity));
  const cents = BigInt(trustedUnitLegacyPrice(price).replace(".", "")) * count;
  assertMoneyRange(rational(cents));
  return cents;
}
