import type { ExactAmount } from "@mi-pasaporte/domain/financial";
import {
  add,
  exact,
  formatMinor,
  fromExact,
  minorRational,
  multiply,
  originalMoney,
  rational,
  subtract,
  toMinor,
} from "@mi-pasaporte/domain/financial/rational";
export type ChargeShape = "none" | "percent" | "fixed" | "percent_and_fixed";
export const usesPercent = (shape: ChargeShape) =>
  shape === "percent" || shape === "percent_and_fixed";
export const usesFixed = (shape: ChargeShape) =>
  shape === "fixed" || shape === "percent_and_fixed";
export function parsePercent(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{1,3}(?:\.\d{1,6})?$/.test(value))
    throw new Error("invalid percent");
  const [whole, part = ""] = value.split("."),
    scaled = BigInt(whole) * 1000000n + BigInt(part.padEnd(6, "0"));
  if (scaled > 100000000n) throw new Error("invalid percent");
  return `${scaled / 1000000n}.${String(scaled % 1000000n).padStart(6, "0")}`;
}
export function calculatePaymentCommission(args: {
  amount: string;
  currencyCode: string;
  minorUnit: 0 | 2;
  chargeShape: ChargeShape;
  percent: string | null;
  originalFixed: ExactAmount | null;
  fixedCurrencyCode: string | null;
}) {
  const configured =
    (!usesPercent(args.chargeShape) || args.percent !== null) &&
    (!usesFixed(args.chargeShape) || args.originalFixed !== null);
  const fixed = args.originalFixed
    ? fromExact(args.originalFixed)
    : rational(0n);
  const reasons = configured ? [] : ["commission_unconfigured"];
  if (
    usesFixed(args.chargeShape) &&
    fixed.n !== 0n &&
    args.fixedCurrencyCode !== args.currencyCode
  )
    return {
      commission: null,
      originalCommission: null,
      normalizationAdjustment: null,
      configured,
      reasons: [...reasons, "commission_currency_mismatch"],
    };
  const percent = args.percent ? parsePercent(args.percent)! : "0.000000";
  const [whole, part] = percent.split("."),
    rate = rational(BigInt(whole) * 1000000n + BigInt(part), 100000000n);
  const original = add(
    usesPercent(args.chargeShape)
      ? multiply(originalMoney(args.amount), rate)
      : rational(0n),
    usesFixed(args.chargeShape) ? fixed : rational(0n),
  );
  const normalized = toMinor(original, args.minorUnit);
  return {
    commission: formatMinor(normalized, args.minorUnit),
    originalCommission: exact(original),
    normalizationAdjustment: exact(
      subtract(minorRational(normalized, args.minorUnit), original),
    ),
    configured,
    reasons,
  };
}
