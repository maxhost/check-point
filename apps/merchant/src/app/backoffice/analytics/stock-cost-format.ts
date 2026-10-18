/** Format exact minor-unit decimals without rounding costs smaller than a cent. */
export function formatStockCost(
  amountMinor: string,
  currencyCode: string,
  minorUnit: number,
  unit: string,
): string {
  if (
    !/^\d+(?:\.\d+)?$/.test(amountMinor) ||
    !Number.isInteger(minorUnit) ||
    minorUnit < 0 ||
    minorUnit > 20
  )
    return "Costo no disponible";
  const [whole, fraction = ""] = amountMinor.split(".");
  const digits = whole.padStart(minorUnit + 1, "0");
  const integer = minorUnit ? digits.slice(0, -minorUnit) : digits;
  const decimal = (
    (minorUnit ? digits.slice(-minorUnit) : "") + fraction
  ).replace(/0+$/, "");
  const formatter = new Intl.NumberFormat("es-EC");
  const separator =
    formatter.formatToParts(1.1).find((part) => part.type === "decimal")
      ?.value ?? ",";
  return `${formatter.format(BigInt(integer))}${decimal ? separator + decimal : ""} ${currencyCode}/${stockCostUnit(unit)}`;
}

export function stockCostGeometryValue(amountMinor: string): number | null {
  if (!/^\d+(?:\.\d+)?$/.test(amountMinor)) return null;
  const value = Number(amountMinor);
  // An underflow must not turn an actual positive cost into zero.
  return Number.isFinite(value) && (value > 0 || !/[1-9]/.test(amountMinor))
    ? value
    : null;
}

export function stockCostDate(date: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function stockCostUnit(unit: string): string {
  return unit === "unit" ? "unidad" : unit;
}
