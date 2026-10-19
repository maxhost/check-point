/** Presentation only: keep canonical decimal strings out of floating point math. */
export function measuredMoney(value: string, currencyCode: string): string {
  const formatter = new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: Math.max(2, value.split(".")[1]?.length ?? 0),
  });
  return (formatter.format as (decimal: string) => string)(value);
}
