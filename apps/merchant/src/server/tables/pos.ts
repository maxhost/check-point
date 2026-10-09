import { and, asc, eq, ne } from "drizzle-orm";
import { type DbTransaction, getDb } from "@mi-pasaporte/db";
import { diningTables, posOrders } from "@mi-pasaporte/db/schema";
import {
  CounterError,
  assertLocationInBusiness,
  parseUuid,
  pgErrorCode,
} from "@mi-pasaporte/domain/server/counter/core";

/**
 * Spec 0182 §POS — LAS MESAS VISTAS DESDE EL POS (permiso `pos`). Con mesa, la orden toma el
 * local y el nombre de la mesa; la ocupacion la garantiza el unico parcial
 * `core_pos_order_open_table_unique` (una orden abierta por mesa, owner 2026-10-08).
 */

export type PosTableDTO = {
  id: string;
  name: string;
  seats: number | null;
  openOrderId: string | null;
};

export type ResolvedTable = { id: string; name: string; locationId: string };

const OPEN_TABLE_INDEX = "core_pos_order_open_table_unique";

function unknownTable(): CounterError {
  return new CounterError(422, "unknown_table", "La mesa no es válida.");
}

export function tableOccupied(): CounterError {
  return new CounterError(
    409,
    "table_occupied",
    "Esa mesa ya tiene una orden abierta.",
  );
}

/** `GET /api/pos/tables?locationId=` — las mesas ACTIVAS de un local activo, con la orden abierta
 * de cada una. */
export async function listPosTables(
  businessId: string,
  rawLocationId: unknown,
): Promise<PosTableDTO[]> {
  const locationId = await assertLocationInBusiness(
    businessId,
    parseUuid(rawLocationId, "locationId"),
  );
  const rows = await getDb()
    .select({
      id: diningTables.id,
      name: diningTables.name,
      seats: diningTables.seats,
      openOrderId: posOrders.id,
    })
    .from(diningTables)
    .leftJoin(
      posOrders,
      and(
        eq(posOrders.diningTableId, diningTables.id),
        eq(posOrders.status, "open"),
      ),
    )
    .where(
      and(
        eq(diningTables.locationId, locationId),
        eq(diningTables.businessId, businessId),
        eq(diningTables.status, "active"),
      ),
    )
    .orderBy(asc(diningTables.sortOrder), asc(diningTables.name));
  return rows;
}

/** Una mesa ACTIVA del negocio, o 422 `unknown_table`. Lectura previa a la transaccion: decide
 * el local y el nombre; `lockTableForOrder` la revalida bajo lock. */
export async function resolveTable(
  businessId: string,
  tableId: string,
): Promise<ResolvedTable> {
  const [row] = await getDb()
    .select({
      id: diningTables.id,
      name: diningTables.name,
      locationId: diningTables.locationId,
    })
    .from(diningTables)
    .where(
      and(
        eq(diningTables.id, tableId),
        eq(diningTables.businessId, businessId),
        eq(diningTables.status, "active"),
      ),
    )
    .limit(1);
  if (!row) throw unknownTable();
  return row;
}

/** El `tableId` del cuerpo: ausente/null/"" → sin mesa; un uuid → una mesa activa del negocio. */
export async function parseTable(
  businessId: string,
  raw: unknown,
): Promise<ResolvedTable | null> {
  if (raw === undefined || raw === null || raw === "") return null;
  return resolveTable(businessId, parseUuid(raw, "tableId"));
}

/** Con mesa, el local de la orden ES el de la mesa: un `locationId` distinto es 422. El local
 * pasa por la misma validacion que sin mesa (activo y del negocio). */
export async function locationOfTable(
  businessId: string,
  table: ResolvedTable,
  rawLocationId: unknown,
): Promise<string> {
  if (
    rawLocationId !== undefined &&
    rawLocationId !== null &&
    rawLocationId !== "" &&
    parseUuid(rawLocationId, "locationId") !== table.locationId
  ) {
    throw new CounterError(
      422,
      "table_location_mismatch",
      "La mesa no pertenece a ese local.",
    );
  }
  return assertLocationInBusiness(businessId, table.locationId);
}

/**
 * Dentro de la transaccion que abre o mueve la orden: `FOR SHARE` de la mesa (archivarla espera,
 * `manage.ts`), sigue activa, y ninguna OTRA orden abierta la ocupa. La carrera entre dos
 * aperturas la cierra el unico parcial: ver {@link translatingOccupied}.
 */
export async function lockTableForOrder(
  tx: DbTransaction,
  businessId: string,
  tableId: string,
  currentOrderId: string | null,
): Promise<void> {
  const [row] = await tx
    .select({ status: diningTables.status })
    .from(diningTables)
    .where(
      and(
        eq(diningTables.id, tableId),
        eq(diningTables.businessId, businessId),
      ),
    )
    .for("share")
    .limit(1);
  if (!row || row.status !== "active") throw unknownTable();
  const [other] = await tx
    .select({ id: posOrders.id })
    .from(posOrders)
    .where(
      and(
        eq(posOrders.diningTableId, tableId),
        eq(posOrders.status, "open"),
        currentOrderId ? ne(posOrders.id, currentOrderId) : undefined,
      ),
    )
    .limit(1);
  if (other) throw tableOccupied();
}

function constraintOf(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const name = (current as { constraint?: string }).constraint;
    if (typeof name === "string") return name;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/** El `23505` del unico de mesa abierta → 409 `table_occupied`; cualquier otro error sigue. */
export async function translatingOccupied<T>(
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (
      pgErrorCode(error) === "23505" &&
      constraintOf(error) === OPEN_TABLE_INDEX
    ) {
      throw tableOccupied();
    }
    throw error;
  }
}
