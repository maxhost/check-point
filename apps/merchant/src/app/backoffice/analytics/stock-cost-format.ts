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

/** Compare validated nonnegative contract decimals without approximating either value. */
export function compareStockCosts(left: string, right: string): number {
  const [leftWhole, leftFraction = ""] = left.split(".");
  const [rightWhole, rightFraction = ""] = right.split(".");
  const leftInteger = leftWhole.replace(/^0+/, "") || "0";
  const rightInteger = rightWhole.replace(/^0+/, "") || "0";
  if (leftInteger.length !== rightInteger.length)
    return leftInteger.length < rightInteger.length ? -1 : 1;
  if (leftInteger !== rightInteger) return leftInteger < rightInteger ? -1 : 1;
  const precision = Math.max(leftFraction.length, rightFraction.length);
  const leftDecimal = leftFraction.padEnd(precision, "0");
  const rightDecimal = rightFraction.padEnd(precision, "0");
  return leftDecimal === rightDecimal ? 0 : leftDecimal < rightDecimal ? -1 : 1;
}
