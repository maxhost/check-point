import {
  CounterError,
  assertLocationInBusiness,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import { PosError, VERSION_CONFLICT } from "./errors";
import { readPosOrder } from "./read";

/**
 * Spec 0169 — LA ENTRADA de crear y editar una orden del POS (local, nota, version) y el cuerpo
 * del `version_conflict`. Separado de `orders.ts` por el limite del hook `file-size` (spec 0220).
 */

/** `locationId` del cuerpo: ausente/null/"" → sin local; un uuid → tiene que ser un local ACTIVO
 * del negocio (`assertLocationInBusiness`, el error de hoy). */
export async function parseLocation(
  businessId: string,
  raw: unknown,
): Promise<string | null> {
  if (raw === undefined || raw === null || raw === "") return null;
  return assertLocationInBusiness(businessId, parseUuid(raw, "locationId"));
}

/** `version_conflict` viaja con la orden ACTUAL en el cuerpo, releida despues del rollback. */
export async function withCurrentOrder(
  businessId: string,
  id: string,
  error: unknown,
): Promise<never> {
  if (error instanceof CounterError && error.code === VERSION_CONFLICT) {
    const order = await readPosOrder(businessId, id);
    throw new PosError(error.status, error.code, error.message, { order });
  }
  throw error;
}

const NOTE_MAX = 1000;

/** La nota de la orden (owner 2026-10-12). `undefined` → `undefined` (el `PUT` conserva la que
 * hay); `null` o solo espacios → `null` (sin nota); si no, el texto recortado, hasta 1000. */
export function parseNote(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") {
    throw new CounterError(422, "invalid_input", "La nota no es válida.");
  }
  const note = raw.trim();
  if (note.length > NOTE_MAX) {
    throw new CounterError(
      422,
      "invalid_input",
      `La nota no puede superar los ${NOTE_MAX} caracteres.`,
    );
  }
  return note === "" ? null : note;
}

export function parseVersion(raw: unknown): number {
  if (!Number.isInteger(raw) || (raw as number) < 1) {
    throw new CounterError(422, "invalid_input", "La versión no es válida.");
  }
  return raw as number;
}
