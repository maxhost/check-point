import { and, asc, eq, sql } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "@mi-pasaporte/db";
import { stockItems, stockMovements } from "@mi-pasaporte/db/schema";
import { isUuid, pgErrorCode } from "@mi-pasaporte/domain/server/counter/core";
import { formatDecimal, fromDb } from "../decimal";
import { ModuleError, invalidBody } from "../errors";
import { QUANTITY, UNIT_COST_SCALE } from "./numbers";

/**
 * Spec 0210 §Stock — LOS INSUMOS de un negocio. Todo filtra por el negocio de la sesion: un insumo
 * ajeno o inexistente es 404 `item_not_found` (nunca 403). Un insumo no se borra: se archiva. La
 * unidad es inmutable. `onHand` es la suma de sus movimientos.
 */

export type StockUnit = "g" | "ml" | "unit";
export type ItemDTO = {
  id: string;
  name: string;
  unit: StockUnit;
  status: "active" | "archived";
  onHand: string;
  lastUnitCost: string | null;
  updatedAt: string;
};

const UNITS: readonly string[] = ["g", "ml", "unit"];
const MAX_NAME = 80;

export const itemColumns = {
  id: stockItems.id,
  name: stockItems.name,
  unit: stockItems.unit,
  status: stockItems.status,
  lastUnitCost: stockItems.lastUnitCost,
  updatedAt: stockItems.updatedAt,
};

export type ItemRow = {
  id: string;
  name: string;
  unit: string;
  status: string;
  lastUnitCost: string | null;
  updatedAt: Date;
};

export function toItemDTO(row: ItemRow, onHand: string | null): ItemDTO {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit as StockUnit,
    status: row.status === "archived" ? "archived" : "active",
    onHand: formatDecimal(
      fromDb(onHand ?? "0", QUANTITY.scale),
      QUANTITY.scale,
    ),
    lastUnitCost:
      row.lastUnitCost === null
        ? null
        : formatDecimal(
            fromDb(row.lastUnitCost, UNIT_COST_SCALE),
            UNIT_COST_SCALE,
          ),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function itemNotFound(): ModuleError {
  return new ModuleError(404, "item_not_found", "Ese insumo no existe.");
}

function nameTaken(): ModuleError {
  return new ModuleError(
    409,
    "item_name_taken",
    "Ya hay un insumo activo con ese nombre.",
  );
}

function parseName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length === 0 || name.length > MAX_NAME) {
    throw new ModuleError(
      422,
      "invalid_name",
      `El nombre del insumo tiene que tener entre 1 y ${MAX_NAME} caracteres.`,
    );
  }
  return name;
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

/** `onHand` de un insumo (la suma de sus movimientos), como string de la base. */
export async function onHandOf(
  db: DbTransaction | ReturnType<typeof getDb>,
  itemId: string,
): Promise<string> {
  const [row] = await db
    .select({
      onHand: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)::text`,
    })
    .from(stockMovements)
    .where(eq(stockMovements.itemId, itemId));
  return row.onHand;
}

/** El insumo del negocio, bloqueado `FOR UPDATE` para el resto de la transaccion. */
export async function lockItem(
  tx: DbTransaction,
  businessId: string,
  rawItemId: unknown,
): Promise<ItemRow> {
  if (!isUuid(rawItemId)) throw itemNotFound();
  const [row] = await tx
    .select(itemColumns)
    .from(stockItems)
    .where(
      and(
        eq(stockItems.id, (rawItemId as string).trim()),
        eq(stockItems.businessId, businessId),
      ),
    )
    .for("update")
    .limit(1);
  if (!row) throw itemNotFound();
  return row;
}

/** `GET /api/modules/stock/items?status=active|archived|all` — orden `lower(name)`. */
export async function listItems(
  businessId: string,
  rawStatus: string | null,
): Promise<ItemDTO[]> {
  const status = rawStatus ?? "active";
  if (status !== "active" && status !== "archived" && status !== "all") {
    throw new ModuleError(422, "invalid_status", "El estado no es válido.");
  }
  const db = getDb();
  const totals = db
    .select({
      itemId: stockMovements.itemId,
      onHand: sql<string>`sum(${stockMovements.quantity})::text`.as("on_hand"),
    })
    .from(stockMovements)
    .where(eq(stockMovements.businessId, businessId))
    .groupBy(stockMovements.itemId)
    .as("totals");
  const rows = await db
    .select({ ...itemColumns, onHand: totals.onHand })
    .from(stockItems)
    .leftJoin(totals, eq(totals.itemId, stockItems.id))
    .where(
      and(
        eq(stockItems.businessId, businessId),
        status === "all" ? undefined : eq(stockItems.status, status),
      ),
    )
    .orderBy(asc(sql`lower(${stockItems.name})`), asc(stockItems.id));
  return rows.map((row) => toItemDTO(row, row.onHand));
}

/** `POST /api/modules/stock/items` — `{ name, unit }`. */
export async function createItem(
  businessId: string,
  body: Record<string, unknown>,
): Promise<ItemDTO> {
  const name = parseName(body.name);
  if (typeof body.unit !== "string" || !UNITS.includes(body.unit)) {
    throw new ModuleError(
      422,
      "invalid_unit",
      "La unidad tiene que ser g, ml o unit.",
    );
  }
  const unit = body.unit;
  return translatingNameTaken(async () => {
    const [row] = await getDb()
      .insert(stockItems)
      .values({ businessId, name, unit })
      .returning(itemColumns);
    return toItemDTO(row, "0");
  });
}

/** `PATCH /api/modules/stock/items/:itemId` — `{ name?, status? }`; `unit` → 422. */
export async function updateItem(
  businessId: string,
  rawItemId: unknown,
  body: Record<string, unknown>,
): Promise<ItemDTO> {
  if (body.unit !== undefined) {
    throw new ModuleError(
      422,
      "unit_immutable",
      "La unidad de un insumo no se puede cambiar.",
    );
  }
  const changes: { name?: string; status?: string } = {};
  if (body.name !== undefined) changes.name = parseName(body.name);
  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "archived") {
      throw new ModuleError(422, "invalid_status", "El estado no es válido.");
    }
    changes.status = body.status;
  }
  if (Object.keys(changes).length === 0) {
    throw invalidBody("No hay nada que cambiar.");
  }
  return translatingNameTaken(() =>
    withDbTransaction(async (tx) => {
      const item = await lockItem(tx, businessId, rawItemId);
      const [row] = await tx
        .update(stockItems)
        .set({ ...changes, updatedAt: new Date() })
        .where(eq(stockItems.id, item.id))
        .returning(itemColumns);
      return toItemDTO(row, await onHandOf(tx, item.id));
    }),
  );
}
