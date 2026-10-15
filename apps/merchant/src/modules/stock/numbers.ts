import { type DecimalSpec, parseDecimal, roundDiv } from "../decimal";
import { ModuleError } from "../errors";

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

/** `quantity > 0` (escala 3) o 422 `invalid_quantity`. */
export function parsePurchaseQuantity(raw: unknown): bigint {
  const quantity = parseDecimal(raw, QUANTITY);
  if (quantity <= 0n) {
    throw new ModuleError(
      422,
      "invalid_quantity",
      "La cantidad tiene que ser mayor que cero.",
    );
  }
  return quantity;
}

/** `totalCost` OPCIONAL (ausente o null = compra sin precio); si viene, `≥ 0` y con costo por unidad
 * que entre en `numeric(14,6)`. Devuelve el total y el costo por unidad base, o null. */
export function parsePurchaseCost(
  raw: unknown,
  quantity: bigint,
): { totalCost: bigint; unitCost: bigint } | null {
  if (raw === undefined || raw === null) return null;
  const totalCost = parseDecimal(raw, TOTAL_COST);
  if (totalCost < 0n) {
    throw new ModuleError(
      422,
      "invalid_cost",
      "El costo no puede ser negativo.",
    );
  }
  const unitCost = unitCostOf(totalCost, quantity);
  if (unitCost === null) {
    throw new ModuleError(
      422,
      "invalid_cost",
      "El costo por unidad es demasiado alto.",
    );
  }
  return { totalCost, unitCost };
}

/** Spec 0228: cantidades3, costo6, importe2; nunca redondea el precio antes de ponderar. */
export function weightedAverageCostOf(
  previousQuantity: bigint,
  previousCost: bigint | null,
  quantity: bigint,
  totalCost: bigint | null,
): bigint | null {
  if (quantity <= 0n) throw new RangeError("quantity tiene que ser > 0");
  if (totalCost === null) return previousCost;
  if (totalCost < 0n || (previousCost !== null && previousCost < 0n))
    throw new RangeError("El costo no puede ser negativo");
  const result =
    previousQuantity <= 0n || previousCost === null
      ? roundDiv(totalCost * 10n ** 7n, quantity)
      : roundDiv(
          previousQuantity * previousCost + totalCost * 10n ** 7n,
          previousQuantity + quantity,
        );
  if (result >= UNIT_COST_LIMIT)
    throw new ModuleError(
      422,
      "invalid_cost",
      "El costo por unidad es demasiado alto.",
    );
  return result;
}
