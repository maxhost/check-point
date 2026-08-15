/**
 * Formats an amount in the business currency for the wizard's live examples and the
 * value metric (spec 0036). Mirrors the catalog `formatMoney`; falls back to the raw
 * code on an unknown ISO 4217 currency so the UI never throws.
 */
export function formatMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

/**
 * Spend a customer must reach to redeem a reward of `pointsCost` points (Puntos).
 * Pure UI mirror of the server `spendToRedeem` in `loyalty-program/accrual.ts`.
 */
export function spendToRedeem(
  pointsCost: number,
  blockAmount: string,
  grant: number,
): number {
  const block = Number(blockAmount);
  if (!Number.isFinite(block) || block <= 0 || grant <= 0) return 0;
  return (pointsCost * block) / grant;
}
