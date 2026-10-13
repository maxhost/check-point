import { formatDecimal, fromDb, roundDiv } from "../decimal";

/**
 * Spec 0210 §Recetas — EL CALCULO de costo y margen, puro. Todo en enteros escalados: una cantidad
 * (escala 3) por un costo por unidad (escala 6) da escala 9, y se redondea a 2 UNA vez, sobre la
 * suma (no se suman lineas ya redondeadas).
 *
 * - `cost`: Σ quantity × last_unit_cost a 2 decimales; `null` sin lineas. Las lineas cuyo insumo no
 *   tiene costo no suman, y dejan `costComplete = false`.
 * - `margin` = `unitPrice − cost` (null si alguno es null).
 * - `marginPct` = `margin / unitPrice × 100` a 1 decimal (null si `unitPrice` es null o 0).
 */

export type CostLineInput = {
  /** `recipes.line.quantity` como lo devuelve el driver. */
  quantity: string;
  /** `stock.item.last_unit_cost` como lo devuelve el driver; null = sin compras. */
  unitCost: string | null;
};

export type CostSummary = {
  unitPrice: string | null;
  cost: string | null;
  costComplete: boolean;
  margin: string | null;
  marginPct: string | null;
  lineCount: number;
};

/** `quantity × unitCost` a 2 decimales, o null si el insumo no tiene costo. */
export function lineCostOf(line: CostLineInput): string | null {
  if (line.unitCost === null) return null;
  const exact = fromDb(line.quantity, 3) * fromDb(line.unitCost, 6);
  return formatDecimal(roundDiv(exact, 10n ** 7n), 2);
}

export function summarizeCost(
  unitPrice: string | null,
  lines: readonly CostLineInput[],
): CostSummary {
  const lineCount = lines.length;
  let exact = 0n;
  let complete = lineCount > 0;
  for (const line of lines) {
    if (line.unitCost === null) {
      complete = false;
      continue;
    }
    exact += fromDb(line.quantity, 3) * fromDb(line.unitCost, 6);
  }
  const cost = lineCount === 0 ? null : roundDiv(exact, 10n ** 7n);
  const price = unitPrice === null ? null : fromDb(unitPrice, 2);
  const margin = price === null || cost === null ? null : price - cost;
  const marginPct =
    margin === null || price === null || price === 0n
      ? null
      : roundDiv(margin * 1000n, price);
  return {
    unitPrice: price === null ? null : formatDecimal(price, 2),
    cost: cost === null ? null : formatDecimal(cost, 2),
    costComplete: complete,
    margin: margin === null ? null : formatDecimal(margin, 2),
    marginPct: marginPct === null ? null : formatDecimal(marginPct, 1),
    lineCount,
  };
}
