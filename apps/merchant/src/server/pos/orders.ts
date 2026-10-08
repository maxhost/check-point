import { and, eq, inArray, sql } from "drizzle-orm";
import { type DbTransaction, withDbTransaction } from "@mi-pasaporte/db";
import { posOrderItems, posOrders } from "@mi-pasaporte/db/schema";
import {
  CounterError,
  type OperatorBusiness,
  assertLocationInBusiness,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import type { GrantItem } from "../counter/orders";
import {
  mergeLines,
  normalizeTableLabel,
  parseIncomingLines,
  snapshotNewLines,
} from "./lines";
import {
  PosError,
  VERSION_CONFLICT,
  posOrderNotOpen,
  unknownPosOrder,
  versionConflict,
} from "./errors";
import { assertPosEnabledLocked } from "./module";
import { type PosOrderDTO, getPosOrder, readPosOrder } from "./read";

/**
 * Spec 0169 §Reglas — CREAR, EDITAR y ANULAR una orden del POS. El cierre vive en `close.ts`.
 * Toda lectura y escritura filtra por el `business_id` del operador: una orden de otro negocio es
 * 404 `unknown_pos_order`, nunca 403.
 */

/** `locationId` del cuerpo: ausente/null/"" → sin local; un uuid → tiene que ser un local ACTIVO
 * del negocio (`assertLocationInBusiness`, el error de hoy). */
async function parseLocation(
  businessId: string,
  raw: unknown,
): Promise<string | null> {
  if (raw === undefined || raw === null || raw === "") return null;
  return assertLocationInBusiness(businessId, parseUuid(raw, "locationId"));
}

async function insertLines(
  tx: DbTransaction,
  posOrderId: string,
  lines: readonly { item: GrantItem; position: number }[],
): Promise<void> {
  if (lines.length === 0) return;
  await tx.insert(posOrderItems).values(
    lines.map(({ item, position }) => ({
      posOrderId,
      productId: item.productId,
      nameSnapshot: item.nameSnapshot,
      unitPriceSnapshot: item.unitPrice,
      quantity: item.quantity,
      position,
    })),
  );
}

/** `POST /api/pos/orders`. `items` puede venir vacio. El modulo se relee bajo `FOR SHARE` de la
 * fila del negocio en la MISMA transaccion que inserta (`module.ts`). */
export async function createPosOrder(
  business: OperatorBusiness,
  userId: string,
  raw: Record<string, unknown>,
): Promise<PosOrderDTO> {
  const tableLabel = normalizeTableLabel(raw.tableLabel);
  const locationId = await parseLocation(business.id, raw.locationId);
  // Sin orden todavia no hay lineas existentes: un `lineId` aca es `unknown_line`.
  const { added } = mergeLines([], parseIncomingLines(raw.items));
  const items = await snapshotNewLines(business.id, locationId, added);

  const id = await withDbTransaction(async (tx) => {
    await assertPosEnabledLocked(tx, business.id);
    const [row] = await tx
      .insert(posOrders)
      .values({
        businessId: business.id,
        locationId,
        tableLabel,
        createdByUserId: userId,
      })
      .returning({ id: posOrders.id });
    await insertLines(
      tx,
      row.id,
      items.map((item, i) => ({ item, position: added[i].position })),
    );
    return row.id;
  });
  return getPosOrder(business.id, id);
}

/** El 0-filas del `UPDATE … WHERE status='open' AND version=$v`: ¿no esta abierta, o la version
 * es vieja? Se decide releyendo la fila en la misma transaccion. */
async function whyNotUpdated(
  tx: DbTransaction,
  businessId: string,
  id: string,
): Promise<CounterError> {
  const [row] = await tx
    .select({ status: posOrders.status })
    .from(posOrders)
    .where(and(eq(posOrders.id, id), eq(posOrders.businessId, businessId)));
  if (!row) return unknownPosOrder();
  if (row.status !== "open") return posOrderNotOpen();
  return versionConflict();
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

export function parseVersion(raw: unknown): number {
  if (!Number.isInteger(raw) || (raw as number) < 1) {
    throw new CounterError(422, "invalid_input", "La versión no es válida.");
  }
  return raw as number;
}

/**
 * `PUT /api/pos/orders/:id` — la lista COMPLETA de lineas (`mergeLines`). Las existentes
 * CONSERVAN su snapshot (precio fijo al agregar): cambiar el local NO re-snapshotea. `locationId`
 * ausente conserva el local; `null`/`""` lo quita; un uuid lo cambia.
 */
export async function updatePosOrder(
  business: OperatorBusiness,
  id: string,
  raw: Record<string, unknown>,
): Promise<PosOrderDTO> {
  const version = parseVersion(raw.version);
  const tableLabel = normalizeTableLabel(raw.tableLabel);
  const incoming = parseIncomingLines(raw.items);
  const current = await readPosOrder(business.id, id);
  if (!current) throw unknownPosOrder();
  const locationId =
    raw.locationId === undefined
      ? (current.location?.id ?? null)
      : await parseLocation(business.id, raw.locationId);
  // Las nuevas se snapshotean ANTES de la transaccion (lectura del catalogo); cuales son nuevas
  // no depende de la base: son las que vienen sin `lineId`.
  const fresh = incoming
    .map((line, position) => ({ line, position }))
    .filter(({ line }) => line.lineId === null);
  const snapshots = await snapshotNewLines(
    business.id,
    locationId,
    fresh.map(({ line }) => line),
  );

  try {
    await withDbTransaction(async (tx) => {
      const [bumped] = await tx
        .update(posOrders)
        .set({
          tableLabel,
          locationId,
          version: sql`${posOrders.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(posOrders.id, id),
            eq(posOrders.businessId, business.id),
            eq(posOrders.status, "open"),
            eq(posOrders.version, version),
          ),
        )
        .returning({ id: posOrders.id });
      if (!bumped) throw await whyNotUpdated(tx, business.id, id);

      const existing = await tx
        .select({ id: posOrderItems.id })
        .from(posOrderItems)
        .where(eq(posOrderItems.posOrderId, id));
      const merge = mergeLines(
        existing.map((line) => line.id),
        incoming,
      );
      if (merge.removed.length > 0) {
        await tx
          .delete(posOrderItems)
          .where(
            and(
              eq(posOrderItems.posOrderId, id),
              inArray(posOrderItems.id, merge.removed),
            ),
          );
      }
      for (const line of merge.kept) {
        await tx
          .update(posOrderItems)
          .set({ quantity: line.quantity, position: line.position })
          .where(
            and(
              eq(posOrderItems.id, line.id),
              eq(posOrderItems.posOrderId, id),
            ),
          );
      }
      await insertLines(
        tx,
        id,
        snapshots.map((item, i) => ({ item, position: fresh[i].position })),
      );
    });
  } catch (error) {
    await withCurrentOrder(business.id, id, error);
  }
  return getPosOrder(business.id, id);
}

/** `POST /api/pos/orders/:id/void`: `open → voided`. Anular una anulada → 200 idempotente; una
 * cerrada → 409 `pos_order_not_open`. */
export async function voidPosOrder(
  business: OperatorBusiness,
  userId: string,
  id: string,
): Promise<PosOrderDTO> {
  await withDbTransaction(async (tx) => {
    const [row] = await tx
      .select({ status: posOrders.status })
      .from(posOrders)
      .where(and(eq(posOrders.id, id), eq(posOrders.businessId, business.id)))
      .for("update");
    if (!row) throw unknownPosOrder();
    if (row.status === "voided") return;
    if (row.status !== "open") throw posOrderNotOpen();
    await tx
      .update(posOrders)
      .set({
        status: "voided",
        closedAt: new Date(),
        closedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(posOrders.id, id));
  });
  return getPosOrder(business.id, id);
}

/** Exportado para el cierre: la misma lectura de lineas, en la transaccion del cierre. */
export async function linesForClose(tx: DbTransaction, id: string) {
  return tx
    .select({
      productId: posOrderItems.productId,
      nameSnapshot: posOrderItems.nameSnapshot,
      unitPrice: posOrderItems.unitPriceSnapshot,
      quantity: posOrderItems.quantity,
    })
    .from(posOrderItems)
    .where(eq(posOrderItems.posOrderId, id))
    .orderBy(posOrderItems.position, posOrderItems.id);
}
