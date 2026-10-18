import { rational, type Rational } from "../financial/rational";
import { MeasureError, type Decimal, type ExactRatio } from "./types";

const INPUT_SCALE = 9;
const MAX_INPUT_SCALED = 999_999_999_999_999_999n;
/** Validate scale before removing zeroes: extra input precision is never truncated. */
function parseInput(value: unknown, kind: "quantity" | "price"): Decimal {
  const fail = () => new MeasureError(`invalid_${kind}`, kind);
  if (typeof value !== "string" || value.length > 64) throw fail();
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw fail();
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > INPUT_SCALE) throw fail();
  const scaled = BigInt(whole) * 10n ** 9n + BigInt(fraction.padEnd(9, "0"));
  if (scaled > MAX_INPUT_SCALED) throw fail();
  if (kind === "quantity" && scaled === 0n) throw fail();
  const part = fraction.replace(/0+$/, "");
  return `${BigInt(whole)}${part ? `.${part}` : ""}`;
}
export const parseQuantity = (value: unknown): Decimal =>
  parseInput(value, "quantity");
export const parsePrice = (value: unknown): Decimal =>
  parseInput(value, "price");
export const parseNullablePrice = (value: unknown): Decimal | null =>
  value === null ? null : parsePrice(value);

/** For validated captures or exact derived decimal strings; no input-scale truncation. */
export function decimalRational(value: Decimal): Rational {
  if (!/^\d+(?:\.\d+)?$/.test(value))
    throw new MeasureError("invalid_quantity", "quantity");
  const [whole, part = ""] = value.split(".");
  return rational(BigInt(whole + part), 10n ** BigInt(part.length));
}
export function ratioOf(value: Rational): ExactRatio {
  const reduced = rational(value.n, value.d);
  return Object.freeze({
    numerator: String(reduced.n),
    denominator: String(reduced.d),
  });
}
export function fromRatio(value: ExactRatio): Rational {
  if (
    !value ||
    typeof value.numerator !== "string" ||
    typeof value.denominator !== "string" ||
    !/^-?\d+$/.test(value.numerator) ||
    !/^\d+$/.test(value.denominator) ||
    BigInt(value.denominator) <= 0n
  )
    throw new MeasureError("invalid_measure", "ratio");
  return rational(BigInt(value.numerator), BigInt(value.denominator));
}
/** Exact finite decimal, or null for a nonterminating rational. Never rounds. */
export function terminatingDecimal(value: Rational): Decimal | null {
  const reduced = rational(value.n, value.d);
  let d = reduced.d;
  let twos = 0;
  let fives = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    twos++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    fives++;
  }
  if (d !== 1n) return null;
  const scale = Math.max(twos, fives);
  const scaled = reduced.n * (10n ** BigInt(scale) / reduced.d);
  const negative = scaled < 0n;
  const digits = String(negative ? -scaled : scaled).padStart(scale + 1, "0");
  if (scale === 0) return `${negative ? "-" : ""}${digits}`;
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return `${negative ? "-" : ""}${digits.slice(0, -scale)}${fraction ? `.${fraction}` : ""}`;
}
