import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { locations } from "@mi-pasaporte/db/schema";
import {
  CounterError,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import { PosError, VERSION_CONFLICT } from "./errors";
import { readPosOrder } from "./read";

/**
 * Spec 0169 — LA ENTRADA de crear y editar una orden del POS (local, nota, version) y el cuerpo
 * del `version_conflict`. Separado de `orders.ts` por el limite del hook `file-size` (spec 0220).
 */

/** Orden nueva: local activo obligatorio. Sin selección, solo un activo se resuelve automáticamente. */
export async function parseLocation(
  businessId: string,
  raw: unknown,
): Promise<string> {
  const id =
    raw === undefined || raw === null || raw === ""
      ? null
      : parseUuid(raw, "locationId");
  const rows = await getDb()
    .select({ id: locations.id, status: locations.status })
    .from(locations)
    .where(
      and(
        eq(locations.businessId, businessId),
        id ? eq(locations.id, id) : eq(locations.status, "active"),
      ),
    )
    .orderBy(asc(locations.createdAt), asc(locations.id));
  if (id) {
    if (!rows[0])
      throw new CounterError(404, "location_not_found", "Ese local no existe.");
    if (rows[0].status !== "active")
      throw new CounterError(
        409,
        "location_archived",
        "Ese local está archivado. Elige un local activo.",
      );
    return id;
  }
  if (rows.length === 1) return rows[0].id;
  throw new CounterError(
    422,
    "location_required",
    "Elige un local activo para la orden.",
  );
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
