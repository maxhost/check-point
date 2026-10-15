import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { isSupportedCurrency } from "@mi-pasaporte/domain/lib/currencies";
import { formatDecimal, parseDecimal } from "../decimal";
import { ModuleError } from "../errors";

export function minorUnitFor(currency: string): 0 | 2 {
  if (!isSupportedCurrency(currency))
    throw new ModuleError(
      422,
      "currency_not_supported",
      "La moneda del comercio no está disponible.",
    );
  return ["COP", "CLP", "JPY", "PYG"].includes(currency) ? 0 : 2;
}

export function parseAmount(value: unknown, minorUnit: number): bigint {
  try {
    if (typeof value !== "string") throw new Error("decimal text required");
    const cents = parseDecimal(value, {
      scale: 2,
      intDigits: 16,
      label: "El importe",
    });
    if (cents < 0n || (minorUnit === 0 && cents % 100n !== 0n))
      throw new Error("invalid granularity");
    return cents;
  } catch {
    throw new ModuleError(422, "invalid_amount", "El importe no es válido.");
  }
}

export const databaseAmount = (cents: bigint) => formatDecimal(cents, 2);
export const displayAmount = (cents: bigint, minorUnit: number) =>
  formatDecimal(minorUnit === 0 ? cents / 100n : cents, minorUnit);

export function equalAllocations(
  cents: bigint,
  minorUnit: number,
  locationIds: readonly string[],
) {
  const ids = [...new Set(locationIds)].sort();
  if (!ids.length || cents < 0n || (minorUnit === 0 && cents % 100n !== 0n))
    throw new ModuleError(
      422,
      "staff_locations_required",
      "Asigna locales al integrante.",
    );
  const multiplier = minorUnit === 0 ? 100n : 1n;
  const total = cents / multiplier;
  const count = BigInt(ids.length);
  return ids.map((locationId, index) => ({
    locationId,
    monthlyAmount: databaseAmount(
      (total / count + (index === 0 ? total % count : 0n)) * multiplier,
    ),
  }));
}

export function month(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value))
    throw new ModuleError(422, "invalid_month", "El mes no es válido.");
  return `${value}-01`;
}

export function interval(body: Record<string, unknown>) {
  const fromMonth = month(body.fromMonth);
  const untilMonth = body.untilMonth === null ? null : month(body.untilMonth);
  if (untilMonth !== null && untilMonth <= fromMonth)
    throw new ModuleError(422, "invalid_period", "La vigencia no es válida.");
  return { fromMonth, untilMonth };
}

export function identifier(
  value: unknown,
  kind: "cost" | "location" | "person",
) {
  if (!isUuid(value))
    throw new ModuleError(404, `${kind}_not_found`, "Ese registro no existe.");
  return value as string;
}

export function label(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 120)
    throw new ModuleError(
      422,
      "invalid_label",
      "Escribe un nombre de hasta 120 caracteres.",
    );
  return value.trim();
}

export function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new ModuleError(
      409,
      "revision_conflict",
      "Los datos cambiaron. Vuelve a cargarlos.",
    );
  return value;
}

export function rejectManual(body: Record<string, unknown>) {
  if (
    [
      "allocations",
      "allocation",
      "distribution",
      "currencyCode",
      "minorUnit",
    ].some((key) => key in body)
  )
    throw new ModuleError(
      422,
      "manual_allocation_not_supported",
      "El reparto se calcula automáticamente.",
    );
}
