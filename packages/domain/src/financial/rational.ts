import { FinancialError, type ExactAmount } from "./types";
import { isSupportedCurrency } from "../lib/currencies";
export type Rational = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint =>
  b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b);
export function rational(n: bigint, d = 1n): Rational {
  if (d <= 0n) throw new FinancialError("invalid_financial_input");
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export const add = (a: Rational, b: Rational) =>
  rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const subtract = (a: Rational, b: Rational) =>
  rational(a.n * b.d - b.n * a.d, a.d * b.d);
export const multiply = (a: Rational, b: Rational) =>
  rational(a.n * b.n, a.d * b.d);
export const divide = (a: Rational, b: Rational) =>
  rational(a.n * b.d, a.d * b.n);
export const exact = (v: Rational): ExactAmount => ({
  numerator: String(v.n),
  denominator: String(v.d),
  scale: 2,
});
export function fromExact(v: ExactAmount): Rational {
  if (
    v.scale !== 2 ||
    !/^-?\d+$/.test(v.numerator) ||
    !/^\d+$/.test(v.denominator)
  )
    throw new FinancialError("invalid_financial_input");
  return rational(BigInt(v.numerator), BigInt(v.denominator));
}
/** Money input keeps the precision already admitted by the product, never a floating point. */
export function originalMoney(value: string): Rational {
  if (typeof value !== "string" || !/^\d{1,16}(?:\.\d{1,2})?$/.test(value))
    throw new FinancialError("invalid_financial_input");
  const [whole, part = ""] = value.split(".");
  return rational(BigInt(whole) * 100n + BigInt(part.padEnd(2, "0")));
}
export function halfUp(n: bigint, d: bigint): bigint {
  return n < 0n ? -halfUp(-n, d) : (n * 2n + d) / (2n * d);
}
export function minorUnitForCurrency(code: string): 0 | 2 {
  if (!isSupportedCurrency(code))
    throw new FinancialError("invalid_financial_input");
  return ["COP", "CLP", "JPY", "PYG"].includes(code) ? 0 : 2;
}
export function toMinor(v: Rational, minorUnit: 0 | 2) {
  return halfUp(v.n, v.d * (minorUnit === 0 ? 100n : 1n));
}
export function formatMinor(v: bigint, minorUnit: 0 | 2): string {
  const sign = v < 0n ? "-" : "",
    a = v < 0n ? -v : v;
  return minorUnit === 0
    ? `${sign}${a}`
    : `${sign}${a / 100n}.${String(a % 100n).padStart(2, "0")}`;
}
export const minorRational = (v: bigint, minorUnit: 0 | 2) =>
  rational(v * (minorUnit === 0 ? 100n : 1n));
export function normalizeMoney(value: string, minorUnit: 0 | 2) {
  return formatMinor(toMinor(originalMoney(value), minorUnit), minorUnit);
}
export function allocateCumulative(
  total: bigint,
  weights: readonly ExactAmount[],
): bigint[] {
  const values = weights.map(fromExact);
  if (total < 0n || values.some((v) => v.n < 0n))
    throw new FinancialError("invalid_financial_input");
  const sum = values.reduce(add, rational(0n));
  if (sum.n === 0n) {
    if (total !== 0n) throw new FinancialError("invalid_financial_input");
    return values.map(() => 0n);
  }
  let prefix = rational(0n),
    previous = 0n;
  return values.map((v, i) => {
    prefix = add(prefix, v);
    const ratio = divide(prefix, sum),
      c = i === values.length - 1 ? total : halfUp(total * ratio.n, ratio.d),
      part = c - previous;
    previous = c;
    return part;
  });
}
