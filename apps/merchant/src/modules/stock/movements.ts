import { and, desc, eq, max } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { stockItems, stockMovements } from "@mi-pasaporte/db/schema";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { formatDecimal, fromDb, parseDecimal } from "../decimal";
import { ModuleError } from "../errors";
import {
  type ItemDTO,
  itemColumns,
  itemNotFound,
  lockItem,
  onHandOf,
  toItemDTO,
} from "./items";
import {
  COUNTED,
  QUANTITY,
  TOTAL_COST,
  UNIT_COST_SCALE,
  unitCostOf,
} from "./numbers";

/**
 * Spec 0210 §Stock — COMPRAS Y AJUSTES. Cada escritura bloquea la fila del insumo (`FOR UPDATE`):
 * dos ajustes simultaneos no calculan el delta sobre el mismo saldo, y el recalculo de
 * `last_unit_cost` no se pisa entre dos compras.
 */

export type MovementDTO = {
  id: string;
  kind: "purchase" | "adjustment";
  quantity: string;
  totalCost: string | null;
  countedQuantity: string | null;
  note: string | null;
  occurredAt: string;
  createdAt: string;
};

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_NOTE = 200;
export const DEFAULT_MOVEMENTS_LIMIT = 50;
export const MAX_MOVEMENTS_LIMIT = 200;

const movementColumns = {
  id: stockMovements.id,
  kind: stockMovements.kind,
  quantity: stockMovements.quantity,
  totalCost: stockMovements.totalCost,
  countedQuantity: stockMovements.countedQuantity,
  note: stockMovements.note,
  occurredAt: stockMovements.occurredAt,
  createdAt: stockMovements.createdAt,
};

function toMovementDTO(row: {
  id: string;
  kind: string;
  quantity: string;
  totalCost: string | null;
  countedQuantity: string | null;
  note: string | null;
  occurredAt: Date;
  createdAt: Date;
}): MovementDTO {
  const fmt = (value: string | null, scale: number) =>
    value === null ? null : formatDecimal(fromDb(value, scale), scale);
  return {
    id: row.id,
    kind: row.kind === "adjustment" ? "adjustment" : "purchase",
    quantity: formatDecimal(fromDb(row.quantity, 3), 3),
    totalCost: fmt(row.totalCost, 2),
    countedQuantity: fmt(row.countedQuantity, 3),
    note: row.note,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function parseNote(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const note = typeof raw === "string" ? raw.trim() : null;
  if (note === null || note.length > MAX_NOTE) {
    throw new ModuleError(
      422,
      "invalid_note",
      `La nota tiene que tener hasta ${MAX_NOTE} caracteres.`,
    );
  }
  return note.length === 0 ? null : note;
}

/** `occurredAt` opcional (ISO); a futuro mas alla de 5 minutos → 422 `invalid_date`. */
export function parseOccurredAt(raw: unknown, now: Date): Date {
  if (raw === undefined || raw === null) return now;
  const time = typeof raw === "string" ? Date.parse(raw) : Number.NaN;
  if (!Number.isFinite(time) || time > now.getTime() + FUTURE_TOLERANCE_MS) {
    throw new ModuleError(422, "invalid_date", "La fecha no es válida.");
  }
  return new Date(time);
}

function archived(): ModuleError {
  return new ModuleError(
    409,
    "item_archived",
    "El insumo está archivado. Reactívalo para registrar movimientos.",
  );
}

/** `POST /api/modules/stock/items/:itemId/purchases` — `{ quantity, totalCost, occurredAt?, note? }`. */
export async function recordPurchase(
  businessId: string,
  userId: string,
  rawItemId: unknown,
  body: Record<string, unknown>,
): Promise<{ movement: MovementDTO; item: ItemDTO }> {
  const quantity = parseDecimal(body.quantity, QUANTITY);
  if (quantity <= 0n) {
    throw new ModuleError(
      422,
      "invalid_quantity",
      "La cantidad tiene que ser mayor que cero.",
    );
  }
  const totalCost = parseDecimal(body.totalCost, TOTAL_COST);
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
  const occurredAt = parseOccurredAt(body.occurredAt, new Date());
  const note = parseNote(body.note);
  return withDbTransaction(async (tx) => {
    const item = await lockItem(tx, businessId, rawItemId);
    if (item.status === "archived") throw archived();
    // El costo vigente es el de la compra MAS RECIENTE por `occurred_at`: una compra cargada con
    // fecha vieja no lo pisa. Se lee bajo el lock del insumo, antes de insertar la nueva.
    const [latest] = await tx
      .select({ at: max(stockMovements.occurredAt) })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.itemId, item.id),
          eq(stockMovements.kind, "purchase"),
        ),
      );
    const [movement] = await tx
      .insert(stockMovements)
      .values({
        businessId,
        itemId: item.id,
        kind: "purchase",
        quantity: formatDecimal(quantity, QUANTITY.scale),
        totalCost: formatDecimal(totalCost, TOTAL_COST.scale),
        note,
        occurredAt,
        createdByUserId: userId,
      })
      .returning(movementColumns);
    let row = item;
    const latestAt = latest?.at ? new Date(latest.at) : null;
    if (latestAt === null || occurredAt.getTime() >= latestAt.getTime()) {
      [row] = await tx
        .update(stockItems)
        .set({
          lastUnitCost: formatDecimal(unitCost, UNIT_COST_SCALE),
          updatedAt: new Date(),
        })
        .where(eq(stockItems.id, item.id))
        .returning(itemColumns);
    }
    return {
      movement: toMovementDTO(movement),
      item: toItemDTO(row, await onHandOf(tx, item.id)),
    };
  });
}

/** `POST /api/modules/stock/items/:itemId/adjustments` — `{ countedQuantity, note? }`. */
export async function recordAdjustment(
  businessId: string,
  userId: string,
  rawItemId: unknown,
  body: Record<string, unknown>,
): Promise<{ movement: MovementDTO; item: ItemDTO }> {
  const counted = parseDecimal(body.countedQuantity, COUNTED);
  if (counted < 0n) {
    throw new ModuleError(
      422,
      "invalid_quantity",
      "La cantidad contada no puede ser negativa.",
    );
  }
  const note = parseNote(body.note);
  return withDbTransaction(async (tx) => {
    // El lock ANTES de leer el saldo: un segundo ajuste espera aca y lee el saldo ya ajustado.
    const item = await lockItem(tx, businessId, rawItemId);
    if (item.status === "archived") throw archived();
    const onHand = fromDb(await onHandOf(tx, item.id), QUANTITY.scale);
    const [movement] = await tx
      .insert(stockMovements)
      .values({
        businessId,
        itemId: item.id,
        kind: "adjustment",
        quantity: formatDecimal(counted - onHand, QUANTITY.scale),
        countedQuantity: formatDecimal(counted, COUNTED.scale),
        note,
        createdByUserId: userId,
      })
      .returning(movementColumns);
    return {
      movement: toMovementDTO(movement),
      item: toItemDTO(item, formatDecimal(counted, QUANTITY.scale)),
    };
  });
}

/** `limit` del query: default 50, tope 200; lo que no es un entero positivo vuelve al default. */
export function parseLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_MOVEMENTS_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_MOVEMENTS_LIMIT;
  return Math.min(n, MAX_MOVEMENTS_LIMIT);
}

/** `GET /api/modules/stock/items/:itemId/movements?limit=50` — del mas reciente al mas viejo. */
export async function listMovements(
  businessId: string,
  rawItemId: unknown,
  rawLimit: string | null,
): Promise<MovementDTO[]> {
  if (!isUuid(rawItemId)) throw itemNotFound();
  const db = getDb();
  const [item] = await db
    .select({ id: stockItems.id })
    .from(stockItems)
    .where(
      and(
        eq(stockItems.id, (rawItemId as string).trim()),
        eq(stockItems.businessId, businessId),
      ),
    )
    .limit(1);
  if (!item) throw itemNotFound();
  const rows = await db
    .select(movementColumns)
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.itemId, item.id),
        eq(stockMovements.businessId, businessId),
      ),
    )
    .orderBy(desc(stockMovements.occurredAt), desc(stockMovements.createdAt))
    .limit(parseLimit(rawLimit));
  return rows.map(toMovementDTO);
}
