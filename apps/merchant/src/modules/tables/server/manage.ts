import { and, asc, eq, sql } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "@mi-pasaporte/db";
import { diningTables, locations, posOrders } from "@mi-pasaporte/db/schema";
import { lockModuleEnabled } from "../../guard";
import {
  MAX_SORT_ORDER,
  asObject,
  invalid,
  parseName,
  parseSeats,
  parseSortOrder,
  parseTableId,
  translatingNameTaken,
  unknownTable,
} from "./input";
import { LocationError, parseLocationId } from "../../../server/locations";

/**
 * Spec 0182 §Gestion — LAS MESAS DE UN LOCAL, bajo el permiso `locations` (ADR 0131). Todo filtra
 * por negocio: un local ajeno es 404 `unknown_location`, una mesa ajena o de otro local es 404
 * `unknown_table`. Una mesa nunca se borra: se archiva.
 *
 * Spec 0220 / ADR 0141 §6: modulo Mesas (`requires: ["pos"]`), sobre `pos.dining_table`, que es dato
 * del POS; de ahi importa la tabla y la ocupacion (`pos.pos_order`).
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
/** El id de este modulo, para releerlo bajo el lock del toggle. */
const TABLES_MODULE = "tables";

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

/** `GET /api/modules/tables/locations/:locationId` — activas y archivadas, por `sort_order` y nombre. */
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

/** `POST /api/modules/tables/locations/:locationId` — `{ name, seats? }`; va al final del orden. */
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

/** `PATCH /api/modules/tables/locations/:locationId/:tableId` — `{ name?, seats?, sortOrder? }`. */
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
 * `POST /api/modules/tables/locations/:locationId/:tableId/status` — archiva o reactiva. Archivar
 * con una orden del POS abierta en la mesa → 409: el `FOR UPDATE` de la mesa espera al `FOR SHARE`
 * que toma la apertura de una orden (`modules/pos/server/tables.ts`), asi que no hay carrera.
 * Reactivar toma antes el lock compartido del toggle y relee Mesas (ADR 0141 §4, spec 0220).
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
      if (status === "active") {
        await lockModuleEnabled(tx, business.id, TABLES_MODULE);
      }
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
