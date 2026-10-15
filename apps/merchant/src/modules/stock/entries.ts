import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { stockItems, stockMovements } from "@mi-pasaporte/db/schema";
import { pgErrorCode } from "@mi-pasaporte/domain/server/counter/core";
import { ModuleError, invalidBody } from "../errors";
import {
  type ItemDTO,
  type ItemRow,
  type StockUnit,
  itemColumns,
  lockItem,
  onHandOf,
  toItemDTO,
} from "./items";
import {
  type MovementDTO,
  applyPurchase,
  attemptPurchaseConsumption,
  movementColumns,
  parseLimit,
  parseNote,
  parseOccurredAt,
  toMovementDTO,
} from "./movements";
import { resolveLocation, lockItemLocation } from "./local";
import { parsePurchaseCost, parsePurchaseQuantity } from "./numbers";

/**
 * Spec 0210 §Entradas — UNA ENTRADA, VARIAS COMPRAS. El dueño dice en una frase «hoy compre 1 kg de
 * harina por 25, un carton de 30 huevos por 4 y 2 kg de tomate por 7»: es UNA entrada que se guarda
 * como UN movimiento por linea (cada insumo con su stock y su costo), agrupados por `entry_id`. Es el
 * camino de escritura que va a usar el audio con IA (la IA arma el borrador, el dueño confirma, y la
 * pantalla manda esto) y el mismo que usa la carga a mano.
 *
 * Todo o nada: una linea invalida, un insumo ajeno o archivado, o un nombre nuevo ya tomado
 * cancelan la entrada entera. Los insumos existentes se bloquean `FOR UPDATE` en orden de id (dos
 * entradas con los mismos insumos no se cruzan en deadlock).
 */

const MAX_LINES = 30;
/** Unidad de la linea → unidad base del insumo y factor (kg → g × 1000). */
const LINE_UNITS: Record<string, { base: StockUnit; factor: bigint }> = {
  g: { base: "g", factor: 1n },
  kg: { base: "g", factor: 1000n },
  ml: { base: "ml", factor: 1n },
  l: { base: "ml", factor: 1000n },
  unit: { base: "unit", factor: 1n },
};
/** `numeric(14,3)`: la cantidad convertida tiene que ser menor que 10^11. */
const QUANTITY_LIMIT = 10n ** 14n;
const MAX_NAME = 80;

export type LogMovementDTO = MovementDTO & {
  itemId: string;
  itemName: string;
  unit: StockUnit;
};

type ParsedLine = {
  itemId: string | null;
  newName: string | null;
  base: StockUnit;
  quantity: bigint;
  cost: ReturnType<typeof parsePurchaseCost>;
};

function lineError(index: number, code: string, message: string) {
  return new ModuleError(422, code, `Línea ${index + 1}: ${message}`, {
    line: index,
  });
}

function parseLine(raw: unknown, index: number): ParsedLine {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw lineError(index, "invalid_line", "no es válida.");
  }
  const line = raw as Record<string, unknown>;
  const hasItem = line.itemId !== undefined && line.itemId !== null;
  const hasNew = line.newItem !== undefined && line.newItem !== null;
  if (hasItem === hasNew) {
    throw lineError(
      index,
      "invalid_line",
      "tiene que traer un insumo existente o uno nuevo, no los dos.",
    );
  }
  let newName: string | null = null;
  if (hasNew) {
    const name =
      typeof line.newItem === "object" &&
      typeof (line.newItem as Record<string, unknown>).name === "string"
        ? ((line.newItem as Record<string, unknown>).name as string).trim()
        : "";
    if (name.length === 0 || name.length > MAX_NAME) {
      throw lineError(
        index,
        "invalid_name",
        `el nombre del insumo tiene que tener entre 1 y ${MAX_NAME} caracteres.`,
      );
    }
    newName = name;
  }
  const unit =
    typeof line.unit === "string" ? LINE_UNITS[line.unit] : undefined;
  if (!unit) {
    throw lineError(
      index,
      "invalid_unit",
      "la unidad tiene que ser g, kg, ml, l o unit.",
    );
  }
  const quantity = parsePurchaseQuantity(line.quantity) * unit.factor;
  if (quantity >= QUANTITY_LIMIT) {
    throw lineError(index, "invalid_number", "la cantidad es demasiado alta.");
  }
  return {
    itemId: hasItem ? String(line.itemId) : null,
    newName,
    base: unit.base,
    quantity,
    cost: parsePurchaseCost(line.totalCost, quantity),
  };
}

/** `POST /api/modules/stock/entries` — `{ occurredAt?, note?, lines: [...] }` → `201`. */
export async function recordEntry(
  businessId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<{ entryId: string; movements: LogMovementDTO[]; items: ItemDTO[] }> {
  const location = await resolveLocation(businessId, body.locationId, {
    purchase: true,
  });
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    throw invalidBody("La entrada tiene que traer al menos una línea.");
  }
  if (body.lines.length > MAX_LINES) {
    throw new ModuleError(
      422,
      "too_many_lines",
      `Una entrada puede tener hasta ${MAX_LINES} líneas.`,
    );
  }
  const lines = body.lines.map(parseLine);
  const occurredAt = parseOccurredAt(body.occurredAt, new Date());
  const note = parseNote(body.note);
  const entryId = randomUUID();

  await attemptPurchaseConsumption(businessId, location.id);
  try {
    return await withDbTransaction(async (tx) => {
      const rows = new Map<string, ItemRow>();
      const existing = [
        ...new Set(lines.flatMap((l) => (l.itemId ? [l.itemId] : []))),
      ].sort();
      for (const id of existing) {
        const row = await lockItem(tx, businessId, id);
        rows.set(id, row);
      }
      for (const id of existing)
        await lockItemLocation(tx, businessId, id, location.id);
      // Un nombre nuevo repetido dentro de la misma entrada crea UN insumo (sin distinguir mayusculas).
      const created = new Map<string, string>();
      const movements: LogMovementDTO[] = [];
      for (const [index, line] of lines.entries()) {
        let itemId = line.itemId;
        if (line.newName !== null) {
          const key = line.newName.toLowerCase();
          itemId = created.get(key) ?? null;
          if (itemId === null) {
            const [row] = await tx
              .insert(stockItems)
              .values({ businessId, name: line.newName, unit: line.base })
              .returning(itemColumns);
            created.set(key, row.id);
            rows.set(row.id, row);
            itemId = row.id;
          }
        }
        const item = rows.get(itemId as string) as ItemRow;
        if (item.unit !== line.base) {
          throw new ModuleError(
            422,
            "unit_mismatch",
            `Línea ${index + 1}: ${item.name} se mide en ${item.unit}.`,
            { line: index },
          );
        }
        const applied = await applyPurchase(tx, {
          businessId,
          locationId: location.id,
          userId,
          item,
          quantity: line.quantity,
          cost: line.cost,
          occurredAt,
          note,
          entryId,
        });
        rows.set(item.id, applied.item);
        movements.push({
          ...applied.movement,
          itemId: item.id,
          itemName: item.name,
          unit: item.unit as StockUnit,
        });
      }
      const items: ItemDTO[] = [];
      for (const id of new Set(movements.map((m) => m.itemId))) {
        items.push(
          toItemDTO(
            rows.get(id) as ItemRow,
            await onHandOf(tx, id, location.id),
            location.id,
          ),
        );
      }
      return { entryId, movements, items };
    });
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      throw new ModuleError(
        409,
        "item_name_taken",
        "Ya hay un insumo activo con ese nombre: elegilo de la lista.",
      );
    }
    throw error;
  }
}

/** `GET /api/modules/stock/movements?limit=50` — el registro de TODOS los insumos del negocio, del
 * mas reciente al mas viejo, con el nombre y la unidad de cada insumo. */
export async function listLog(
  businessId: string,
  rawLimit: string | null,
  rawLocationId?: unknown,
): Promise<LogMovementDTO[]> {
  const location = await resolveLocation(businessId, rawLocationId);
  const rows = await getDb()
    .select({
      ...movementColumns,
      itemId: stockItems.id,
      itemName: stockItems.name,
      unit: stockItems.unit,
    })
    .from(stockMovements)
    .innerJoin(
      stockItems,
      and(
        eq(stockItems.id, stockMovements.itemId),
        eq(stockItems.businessId, businessId),
      ),
    )
    .where(
      and(
        eq(stockMovements.businessId, businessId),
        eq(stockMovements.locationId, location.id),
      ),
    )
    .orderBy(desc(stockMovements.occurredAt), desc(stockMovements.createdAt))
    .limit(parseLimit(rawLimit));
  return rows.map((row) => ({
    ...toMovementDTO(row),
    itemId: row.itemId,
    itemName: row.itemName,
    unit: row.unit as StockUnit,
  }));
}
