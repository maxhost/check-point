import { isUuid, pgErrorCode } from "@mi-pasaporte/domain/server/counter/core";
import { LocationError } from "../../../server/locations";

/**
 * Spec 0182 §Gestion — LA ENTRADA de las rutas de mesas (validacion del cuerpo y errores). Separado
 * de `manage.ts` por el limite del hook `file-size` (spec 0220).
 */

const MAX_NAME = 60;
export const MAX_SORT_ORDER = 9999;

export function invalid(message: string): LocationError {
  return new LocationError(422, "invalid_input", message);
}

function nameTaken(): LocationError {
  return new LocationError(
    409,
    "table_name_taken",
    "Ya hay una mesa activa con ese nombre en este local.",
  );
}

export function unknownTable(): LocationError {
  return new LocationError(404, "unknown_table", "Esa mesa no existe.");
}

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("El cuerpo no es válido.");
  }
  return value as Record<string, unknown>;
}

export function parseName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length === 0 || name.length > MAX_NAME) {
    throw invalid(
      `El nombre de la mesa tiene que tener entre 1 y ${MAX_NAME} caracteres.`,
    );
  }
  return name;
}

export function parseSeats(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  if (!Number.isInteger(raw) || (raw as number) < 1 || (raw as number) > 99) {
    throw invalid("Las plazas tienen que ser un número entre 1 y 99.");
  }
  return raw as number;
}

export function parseSortOrder(raw: unknown): number {
  if (!Number.isInteger(raw) || (raw as number) < 0) {
    throw invalid("El orden no es válido.");
  }
  if ((raw as number) > MAX_SORT_ORDER) throw invalid("El orden no es válido.");
  return raw as number;
}

export function parseTableId(raw: unknown): string {
  if (!isUuid(raw)) throw unknownTable();
  return (raw as string).trim();
}

/** El nombre repetido lo decide el unico parcial de la base (`23505`), tambien en la carrera. */
export async function translatingNameTaken<T>(
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (pgErrorCode(error) === "23505") throw nameTaken();
    throw error;
  }
}
