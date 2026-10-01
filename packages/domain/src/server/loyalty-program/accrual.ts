import { type AccrualInput, LoyaltyError, type LoyaltyKind } from "./core";

/** numeric(12,2) range, mirroring the catalog money parser. */
const MAX_MONEY = 9_999_999_999.99;

/**
 * Validates and normalizes the accrual mechanics for a program (spec 0036). Pure:
 * no DB access, so it can run inside the synchronous `validateProgramInput`.
 *
 * Rules by kind: Puntos only accepts `per_amount`; Sellos accepts both modes. The
 * mechanics are required (a program of an enabled modality never saves without them).
 * `per_amount` requires a `blockAmount > 0`; `per_purchase` forbids one.
 */
export function validateAccrual(kind: LoyaltyKind, raw: unknown): AccrualInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LoyaltyError(422, "Define la mecánica de acumulación.");
  }
  const input = raw as Record<string, unknown>;
  const mode = input.mode;
  if (mode !== "per_amount" && mode !== "per_purchase") {
    throw new LoyaltyError(422, "El modo de acumulación no es válido.");
  }
  if (kind === "points" && mode !== "per_amount") {
    throw new LoyaltyError(
      422,
      "Los Puntos se acumulan siempre por monto de compra.",
    );
  }
  const grant = input.grant;
  if (!Number.isInteger(grant) || (grant as number) <= 0) {
    throw new LoyaltyError(
      422,
      "La cantidad otorgada debe ser un entero mayor que 0.",
    );
  }
  if (mode === "per_purchase") {
    if (
      input.blockAmount !== null &&
      input.blockAmount !== undefined &&
      input.blockAmount !== ""
    ) {
      throw new LoyaltyError(
        422,
        "El modo por compra no lleva monto por bloque.",
      );
    }
    return { mode, grant: grant as number, blockAmount: null };
  }
  const blockAmount = normalizeBlockAmount(input.blockAmount);
  return { mode, grant: grant as number, blockAmount };
}

/** Parses `blockAmount` into a positive `numeric(12,2)` string (Y > 0). */
function normalizeBlockAmount(value: unknown): string {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new LoyaltyError(
      422,
      "El monto por bloque debe ser un número mayor que 0.",
    );
  }
  if (amount > MAX_MONEY) {
    throw new LoyaltyError(422, "El monto por bloque es demasiado grande.");
  }
  return amount.toFixed(2);
}

/**
 * Units granted for a purchase of `total`, fixed here and executed by spec 0030.
 * `per_amount`: `floor(total / blockAmount) * grant` (whole blocks, no carry).
 * `per_purchase`: `grant` flat. Returns 0 for a non-positive total in per_amount.
 */
export function computeAccrual(accrual: AccrualInput, total: number): number {
  if (accrual.mode === "per_purchase") return accrual.grant;
  const block = Number(accrual.blockAmount);
  if (!Number.isFinite(block) || block <= 0 || total <= 0) return 0;
  return Math.floor(total / block) * accrual.grant;
}

/** Spend a customer must reach to redeem a reward of `pointsCost` points (Puntos). */
export function spendToRedeem(
  accrual: AccrualInput,
  pointsCost: number,
): number {
  const block = Number(accrual.blockAmount);
  if (!Number.isFinite(block) || block <= 0 || accrual.grant <= 0) return 0;
  return (pointsCost * block) / accrual.grant;
}
