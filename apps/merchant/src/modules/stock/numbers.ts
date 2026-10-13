import { type DecimalSpec, roundDiv } from "../decimal";

/** Spec 0210 — las escalas de las columnas de `stock` (y de `recipes.line.quantity`). */
export const QUANTITY: DecimalSpec = {
  scale: 3,
  intDigits: 11,
  label: "La cantidad",
};
export const COUNTED: DecimalSpec = {
  scale: 3,
  intDigits: 11,
  label: "La cantidad contada",
};
export const TOTAL_COST: DecimalSpec = {
  scale: 2,
  intDigits: 10,
  label: "El costo total",
};
export const UNIT_COST_SCALE = 6;
/** `numeric(14,6)`: el costo por unidad tiene que ser menor que 10^8. */
const UNIT_COST_LIMIT = 10n ** 14n;

/**
 * `last_unit_cost = totalCost / quantity` redondeado a 6 decimales. `totalCost` viene con escala 2 y
 * `quantity` con escala 3: `(T / 10^2) / (Q / 10^3) × 10^6 = T × 10^7 / Q`. Devuelve `null` si el
 * resultado no entra en la columna (lo convierte en 422 quien llama).
 */
export function unitCostOf(totalCost: bigint, quantity: bigint): bigint | null {
  if (quantity <= 0n) throw new RangeError("quantity tiene que ser > 0");
  const cost = roundDiv(totalCost * 10n ** 7n, quantity);
  return cost < UNIT_COST_LIMIT ? cost : null;
}
