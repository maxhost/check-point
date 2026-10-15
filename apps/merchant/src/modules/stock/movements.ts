import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  stockItems,
  stockMovements,
  stockItemLocations,
} from "@mi-pasaporte/db/schema";
import { isUuid, pgErrorCode } from "@mi-pasaporte/domain/server/counter/core";
import { formatDecimal, fromDb, parseDecimal } from "../decimal";
import { resolveLocation, lockItemLocation } from "./local";
import { captureCountCut, validateCountCut } from "./count";
import { retryModuleEvents } from "../../server/module-events";
import { ModuleError } from "../errors";
import {
  type ItemDTO,
  type ItemRow,
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
  parsePurchaseCost,
  parsePurchaseQuantity,
  weightedAverageCostOf,
} from "./numbers";

/**
 * Spec 0210 §Stock — COMPRAS Y AJUSTES. Cada escritura bloquea la fila del insumo (`FOR UPDATE`):
 * dos ajustes simultaneos no calculan el delta sobre el mismo saldo, y el recalculo de
 * `last_unit_cost` no se pisa entre dos compras.
 */

export type MovementDTO = {
  id: string;
  kind: "purchase" | "adjustment" | "consumption";
  locationId: string | null;
  sourceOrderId: string | null;
  sourceLineId: string | null;
  productId: string | null;
  quantity: string;
  totalCost: string | null;
  countedQuantity: string | null;
  /** Agrupa las lineas de una misma entrada (`POST /entries`); null en compras y ajustes sueltos. */
  entryId: string | null;
  note: string | null;
  occurredAt: string;
  createdAt: string;
};

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_NOTE = 200;
export const DEFAULT_MOVEMENTS_LIMIT = 50;
export const MAX_MOVEMENTS_LIMIT = 200;

export const movementColumns = {
  id: stockMovements.id,
  locationId: stockMovements.locationId,
  sourceOrderId: stockMovements.sourceOrderId,
  sourceLineId: stockMovements.sourceLineId,
  productId: stockMovements.productId,
  kind: stockMovements.kind,
  quantity: stockMovements.quantity,
  totalCost: stockMovements.totalCost,
  countedQuantity: stockMovements.countedQuantity,
  entryId: stockMovements.entryId,
  note: stockMovements.note,
  occurredAt: stockMovements.occurredAt,
  createdAt: stockMovements.createdAt,
};

export function toMovementDTO(row: {
  id: string;
  locationId: string | null;
  sourceOrderId: string | null;
  sourceLineId: string | null;
  productId: string | null;
  kind: string;
  quantity: string;
  totalCost: string | null;
  countedQuantity: string | null;
  entryId: string | null;
  note: string | null;
  occurredAt: Date;
  createdAt: Date;
}): MovementDTO {
  const fmt = (value: string | null, scale: number) =>
    value === null ? null : formatDecimal(fromDb(value, scale), scale);
  return {
    id: row.id,
    kind: row.kind as MovementDTO["kind"],
    locationId: row.locationId,
    sourceOrderId: row.sourceOrderId,
    sourceLineId: row.sourceLineId,
    productId: row.productId,
    quantity: formatDecimal(fromDb(row.quantity, 3), 3),
    totalCost: fmt(row.totalCost, 2),
    countedQuantity: fmt(row.countedQuantity, 3),
    entryId: row.entryId,
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

export function archived(): ModuleError {
  return new ModuleError(
    409,
    "item_archived",
    "El insumo está archivado. Reactívalo para registrar movimientos.",
  );
}

/**
 * Inserta UNA compra de un insumo YA BLOQUEADO y pondera sobre el saldo anterior. La
 * usan la compra suelta y cada linea de una entrada (`entries.ts`): un solo camino de escritura.
 *
 * El promedio sigue registro serial bajo el lock del par; el último costo conserva su
 * orden por fecha. Una compra sin precio conserva ambos, incluso null.
 */
export async function applyPurchase(
  tx: DbTransaction,
  args: {
    businessId: string;
    locationId: string;
    userId: string;
    item: ItemRow;
    quantity: bigint;
    cost: { totalCost: bigint; unitCost: bigint } | null;
    occurredAt: Date;
    note: string | null;
    entryId: string | null;
  },
): Promise<{ movement: MovementDTO; item: ItemRow }> {
  const { item, cost } = args;
  if (item.status === "archived") throw archived();
  const pair = await lockItemLocation(
    tx,
    args.businessId,
    item.id,
    args.locationId,
  );
  const previousQuantity = fromDb(
    await onHandOf(tx, item.id, args.locationId),
    QUANTITY.scale,
  );
  const nextAverage = weightedAverageCostOf(
    previousQuantity,
    pair.weightedAverageUnitCost === null
      ? null
      : fromDb(pair.weightedAverageUnitCost, UNIT_COST_SCALE),
    args.quantity,
    cost?.totalCost ?? null,
  );
  const weightedAverageUnitCost =
    nextAverage === null ? null : formatDecimal(nextAverage, UNIT_COST_SCALE);
  const [movement] = await tx
    .insert(stockMovements)
    .values({
      businessId: args.businessId,
      locationId: args.locationId,
      itemId: item.id,
      kind: "purchase",
      quantity: formatDecimal(args.quantity, QUANTITY.scale),
      totalCost: cost ? formatDecimal(cost.totalCost, TOTAL_COST.scale) : null,
      entryId: args.entryId,
      note: args.note,
      occurredAt: args.occurredAt,
      createdByUserId: args.userId,
    })
    .returning(movementColumns);
  // Deterministic tie-breakers; a purchase without price never changes cost.
  let lastUnitCost = pair.lastUnitCost;
  if (cost) {
    const [latest] = await tx
      .select({
        quantity: stockMovements.quantity,
        totalCost: stockMovements.totalCost,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.businessId, args.businessId),
          eq(stockMovements.locationId, args.locationId),
          eq(stockMovements.itemId, item.id),
          eq(stockMovements.kind, "purchase"),
          isNotNull(stockMovements.totalCost),
        ),
      )
      .orderBy(
        desc(stockMovements.occurredAt),
        desc(stockMovements.createdAt),
        desc(stockMovements.id),
      )
      .limit(1);
    lastUnitCost = formatDecimal(
      parsePurchaseCost(latest.totalCost, fromDb(latest.quantity, 3))!.unitCost,
      UNIT_COST_SCALE,
    );
  }
  await tx
    .update(stockItemLocations)
    .set({ lastUnitCost, weightedAverageUnitCost, updatedAt: new Date() })
    .where(
      and(
        eq(stockItemLocations.businessId, args.businessId),
        eq(stockItemLocations.locationId, args.locationId),
        eq(stockItemLocations.itemId, item.id),
      ),
    );
  return {
    movement: toMovementDTO(movement),
    item: { ...item, lastUnitCost, weightedAverageUnitCost },
  };
}

/** One bounded durable attempt before purchase locks; failure never rejects the purchase. */
export async function attemptPurchaseConsumption(
  businessId: string,
  locationId: string,
): Promise<void> {
  await retryModuleEvents({
    businessId,
    locationId,
    budgetMs: 2000,
    force: true,
  }).catch(() => {});
}

/** `POST /api/modules/stock/items/:itemId/purchases` — `{ quantity, totalCost?, occurredAt?, note? }`. */
export async function recordPurchase(
  businessId: string,
  userId: string,
  rawItemId: unknown,
  body: Record<string, unknown>,
): Promise<{ movement: MovementDTO; item: ItemDTO }> {
  const location = await resolveLocation(businessId, body.locationId, {
    purchase: true,
  });
  const quantity = parsePurchaseQuantity(body.quantity);
  const cost = parsePurchaseCost(body.totalCost, quantity);
  const occurredAt = parseOccurredAt(body.occurredAt, new Date());
  const note = parseNote(body.note);
  await attemptPurchaseConsumption(businessId, location.id);
  return withDbTransaction(async (tx) => {
    const locked = await lockItem(tx, businessId, rawItemId);
    const { movement, item } = await applyPurchase(tx, {
      businessId,
      locationId: location.id,
      userId,
      item: locked,
      quantity,
      cost,
      occurredAt,
      note,
      entryId: null,
    });
    return {
      movement,
      item: toItemDTO(
        item,
        await onHandOf(tx, item.id, location.id),
        location.id,
      ),
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
  const location = await resolveLocation(businessId, body.locationId);
  const counted = parseDecimal(body.countedQuantity, COUNTED);
  if (counted < 0n) {
    throw new ModuleError(
      422,
      "invalid_quantity",
      "La cantidad contada no puede ser negativa.",
    );
  }
  const note = parseNote(body.note);
  const cut = await captureCountCut(businessId, location.id);
  await retryModuleEvents({
    businessId,
    locationId: location.id,
    eventIds: cut,
    budgetMs: 2000,
    force: true,
  }).catch(() => {
    throw new ModuleError(
      409,
      "consumption_pending",
      "No pudimos aplicar los consumos pendientes. Intenta el conteo otra vez.",
    );
  });
  try {
    return await withDbTransaction(async (tx) => {
      await tx.execute(sql`set transaction isolation level serializable`);
      await validateCountCut(tx, businessId, location.id, cut);
      // El lock ANTES de leer el saldo: un segundo ajuste espera aca y lee el saldo ya ajustado.
      const item = await lockItem(tx, businessId, rawItemId);
      if (item.status === "archived") throw archived();
      const pair = await lockItemLocation(tx, businessId, item.id, location.id);
      const onHand = fromDb(
        await onHandOf(tx, item.id, location.id),
        QUANTITY.scale,
      );
      const [movement] = await tx
        .insert(stockMovements)
        .values({
          businessId,
          locationId: location.id,
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
        item: toItemDTO(
          {
            ...item,
            lastUnitCost: pair.lastUnitCost,
            weightedAverageUnitCost: pair.weightedAverageUnitCost,
          },
          formatDecimal(counted, QUANTITY.scale),
          location.id,
        ),
      };
    });
  } catch (error) {
    if (pgErrorCode(error) === "40001")
      throw new ModuleError(
        409,
        "count_changed",
        "Cambió el stock mientras contabas. Actualiza e intenta otra vez.",
      );
    throw error;
  }
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
  rawLocationId?: unknown,
): Promise<MovementDTO[]> {
  const location = await resolveLocation(businessId, rawLocationId);
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
        eq(stockMovements.locationId, location.id),
      ),
    )
    .orderBy(desc(stockMovements.occurredAt), desc(stockMovements.createdAt))
    .limit(parseLimit(rawLimit));
  return rows.map(toMovementDTO);
}
