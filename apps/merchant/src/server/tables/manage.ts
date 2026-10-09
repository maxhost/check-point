import { and, asc, eq, sql } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "@mi-pasaporte/db";
import { diningTables, locations, posOrders } from "@mi-pasaporte/db/schema";
import { isUuid, pgErrorCode } from "@mi-pasaporte/domain/server/counter/core";
import { LocationError, parseLocationId } from "../locations";

/**
 * Spec 0182 §Gestion — LAS MESAS DE UN LOCAL, bajo el permiso `locations` (ADR 0131). Todo filtra
 * por negocio: un local ajeno es 404 `unknown_location`, una mesa ajena o de otro local es 404
 * `unknown_table`. Una mesa nunca se borra: se archiva.
 */

export type DiningTableDTO = {
  id: string;
  locationId: string;
  name: string;
  seats: number | null;
  sortOrder: number;
  status: "active" | "archived";
};

export const MAX_TABLES_PER_LOCATION = 200;
const MAX_NAME = 60;
const MAX_SORT_ORDER = 9999;

const columns = {
  id: diningTables.id,
  locationId: diningTables.locationId,
  name: diningTables.name,
  seats: diningTables.seats,
  sortOrder: diningTables.sortOrder,
  status: diningTables.status,
};

function toDTO(row: {
  id: string;
  locationId: string;
  name: string;
  seats: number | null;
  sortOrder: number;
  status: string;
}): DiningTableDTO {
  return { ...row, status: row.status === "archived" ? "archived" : "active" };
}

function invalid(message: string): LocationError {
  return new LocationError(422, "invalid_input", message);
}

function nameTaken(): LocationError {
  return new LocationError(
    409,
    "table_name_taken",
    "Ya hay una mesa activa con ese nombre en este local.",
  );
}

function unknownTable(): LocationError {
  return new LocationError(404, "unknown_table", "Esa mesa no existe.");
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("El cuerpo no es válido.");
  }
  return value as Record<string, unknown>;
}

function parseName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length === 0 || name.length > MAX_NAME) {
    throw invalid(
      `El nombre de la mesa tiene que tener entre 1 y ${MAX_NAME} caracteres.`,
    );
  }
  return name;
}

function parseSeats(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  if (!Number.isInteger(raw) || (raw as number) < 1 || (raw as number) > 99) {
    throw invalid("Las plazas tienen que ser un número entre 1 y 99.");
  }
  return raw as number;
}

function parseSortOrder(raw: unknown): number {
  if (!Number.isInteger(raw) || (raw as number) < 0) {
    throw invalid("El orden no es válido.");
  }
  if ((raw as number) > MAX_SORT_ORDER) throw invalid("El orden no es válido.");
  return raw as number;
}

function parseTableId(raw: unknown): string {
  if (!isUuid(raw)) throw unknownTable();
  return (raw as string).trim();
}

/** El nombre repetido lo decide el unico parcial de la base (`23505`), tambien en la carrera. */
async function translatingNameTaken<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (pgErrorCode(error) === "23505") throw nameTaken();
    throw error;
  }
}

/** El local del negocio, con `FOR UPDATE` dentro de una transaccion (serializa el alta: tope y
 * `sort_order`). Ajeno o inexistente → 404. */
async function ownLocation(
  db: DbTransaction | ReturnType<typeof getDb>,
  businessId: string,
  rawLocationId: unknown,
  lock: boolean,
): Promise<string> {
  const locationId = parseLocationId(rawLocationId);
  const query = db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(eq(locations.id, locationId), eq(locations.businessId, businessId)),
    )
    .limit(1);
  const [row] = lock ? await query.for("update") : await query;
  if (!row) {
    throw new LocationError(404, "unknown_location", "Ese local no existe.");
  }
  return row.id;
}

/** `GET /api/locations/:locationId/tables` — activas y archivadas, por `sort_order` y nombre. */
export async function listTables(
  business: { id: string },
  rawLocationId: unknown,
): Promise<DiningTableDTO[]> {
  const db = getDb();
  const locationId = await ownLocation(db, business.id, rawLocationId, false);
  const rows = await db
    .select(columns)
    .from(diningTables)
    .where(eq(diningTables.locationId, locationId))
    .orderBy(asc(diningTables.sortOrder), asc(diningTables.name));
  return rows.map(toDTO);
}

/** `POST /api/locations/:locationId/tables` — `{ name, seats? }`; va al final del orden. */
export async function createTable(
  business: { id: string },
  rawLocationId: unknown,
  rawBody: unknown,
): Promise<DiningTableDTO> {
  const body = asObject(rawBody);
  const name = parseName(body.name);
  const seats = parseSeats(body.seats);
  return translatingNameTaken(() =>
    withDbTransaction(async (tx) => {
      const locationId = await ownLocation(
        tx,
        business.id,
        rawLocationId,
        true,
      );
      const [stats] = await tx
        .select({
          total: sql<number>`count(*)::int`,
          last: sql<number>`coalesce(max(${diningTables.sortOrder}), -1)::int`,
        })
        .from(diningTables)
        .where(eq(diningTables.locationId, locationId));
      if (stats.total >= MAX_TABLES_PER_LOCATION) {
        throw new LocationError(
          422,
          "too_many_tables",
          `Un local puede tener hasta ${MAX_TABLES_PER_LOCATION} mesas.`,
        );
      }
      const [row] = await tx
        .insert(diningTables)
        .values({
          businessId: business.id,
          locationId,
          name,
          seats,
          sortOrder: Math.min(stats.last + 1, MAX_SORT_ORDER),
        })
        .returning(columns);
      return toDTO(row);
    }),
  );
}

/** La mesa del local y del negocio, bloqueada para el resto de la transaccion. */
async function lockTable(
  tx: DbTransaction,
  businessId: string,
  rawLocationId: unknown,
  rawTableId: unknown,
) {
  const locationId = await ownLocation(tx, businessId, rawLocationId, false);
  const tableId = parseTableId(rawTableId);
  const [row] = await tx
    .select(columns)
    .from(diningTables)
    .where(
      and(
        eq(diningTables.id, tableId),
        eq(diningTables.locationId, locationId),
        eq(diningTables.businessId, businessId),
      ),
    )
    .for("update")
    .limit(1);
  if (!row) throw unknownTable();
  return row;
}

/** `PATCH /api/locations/:locationId/tables/:tableId` — `{ name?, seats?, sortOrder? }`. */
export async function updateTable(
  business: { id: string },
  rawLocationId: unknown,
  rawTableId: unknown,
  rawBody: unknown,
): Promise<DiningTableDTO> {
  const body = asObject(rawBody);
  const changes: {
    name?: string;
    seats?: number | null;
    sortOrder?: number;
  } = {};
  if (body.name !== undefined) changes.name = parseName(body.name);
  if (body.seats !== undefined) changes.seats = parseSeats(body.seats);
  if (body.sortOrder !== undefined) {
    changes.sortOrder = parseSortOrder(body.sortOrder);
  }
  if (Object.keys(changes).length === 0) {
    throw invalid("No hay nada que cambiar.");
  }
  return translatingNameTaken(() =>
    withDbTransaction(async (tx) => {
      const table = await lockTable(tx, business.id, rawLocationId, rawTableId);
      const [row] = await tx
        .update(diningTables)
        .set({ ...changes, updatedAt: new Date() })
        .where(eq(diningTables.id, table.id))
        .returning(columns);
      return toDTO(row);
    }),
  );
}

/**
 * `POST /api/locations/:locationId/tables/:tableId/status` — archiva o reactiva. Archivar con
 * una orden del POS abierta en la mesa → 409: el `FOR UPDATE` de la mesa espera al `FOR SHARE`
 * que toma la apertura de una orden (`server/tables/pos.ts`), asi que no hay carrera.
 */
export async function setTableStatus(
  business: { id: string },
  rawLocationId: unknown,
  rawTableId: unknown,
  rawBody: unknown,
): Promise<DiningTableDTO> {
  const status = asObject(rawBody).status;
  if (status !== "active" && status !== "archived") {
    throw invalid("El estado no es válido.");
  }
  return translatingNameTaken(() =>
    withDbTransaction(async (tx) => {
      const table = await lockTable(tx, business.id, rawLocationId, rawTableId);
      if (table.status === status) return toDTO(table);
      if (status === "archived") {
        const [open] = await tx
          .select({ id: posOrders.id })
          .from(posOrders)
          .where(
            and(
              eq(posOrders.diningTableId, table.id),
              eq(posOrders.status, "open"),
            ),
          )
          .limit(1);
        if (open) {
          throw new LocationError(
            409,
            "table_has_open_order",
            "La mesa tiene una orden abierta. Ciérrala o anúlala antes de archivarla.",
          );
        }
      }
      const [row] = await tx
        .update(diningTables)
        .set({ status, updatedAt: new Date() })
        .where(eq(diningTables.id, table.id))
        .returning(columns);
      return toDTO(row);
    }),
  );
}
