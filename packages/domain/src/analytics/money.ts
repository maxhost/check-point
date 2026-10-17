/** Analytics money remains an integer at every observable boundary. */
export class AnalyticsAmountError extends RangeError {
  readonly code = "amount_out_of_range";
  constructor() {
    super("El monto supera el rango de cálculo.");
  }
}
export function safeInteger(value: number | bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new AnalyticsAmountError();
  return number;
}
export function sumIntegers(values: readonly number[]): number {
  return safeInteger(
    values.reduce((total, value) => total + BigInt(safeInteger(value)), 0n),
  );
}
export function moneyRatio(
  numerator: bigint,
  denominator: bigint,
  rounding: "nearest" | "ceil" = "nearest",
): number {
  if (denominator <= 0n) throw new AnalyticsAmountError();
  const quotient =
    rounding === "ceil"
      ? numerator / denominator +
        (numerator > 0n && numerator % denominator !== 0n ? 1n : 0n)
      : numerator < 0n
        ? -((-numerator * 2n + denominator) / (2n * denominator))
        : (numerator * 2n + denominator) / (2n * denominator);
  return safeInteger(quotient);
}
export function roundedMoney(value: number): number {
  return safeInteger(Math.round(value));
}
