import { appendModuleEvent } from "../../../server/module-events/append";
import { analyticsMoney } from "../../../server/counter/analytics-events";
import { totalOf, unitQuantityOf, unitPriceOf } from "./lines";
import { and, eq, inArray, sql } from "drizzle-orm";
import { type DbTransaction, withDbTransaction } from "@mi-pasaporte/db";
import { posOrderItems, posOrders } from "@mi-pasaporte/db/schema";
import {
  CounterError,
  type OperatorBusiness,
} from "@mi-pasaporte/domain/server/counter/core";
import { lockModuleEnabled } from "../../guard";
import type { GrantItem } from "../../../server/counter/orders";
import {
  mergeLines,
  normalizeTableLabel,
  parseIncomingLines,
  snapshotNewLines,
} from "./lines";
import { posOrderNotOpen, unknownPosOrder, versionConflict } from "./errors";
import {
  parseLocation,
  parseNote,
  parseVersion,
  withCurrentOrder,
} from "./order-input";
import {
  type ResolvedTable,
  locationOfTable,
  lockTableForOrder,
  lockTablesEnabled,
  parseTable,
  resolveTable,
  translatingOccupied,
} from "./tables";
import { type PosOrderDTO, getPosOrder, readPosOrder } from "./read";

/**
 * Spec 0169 §Reglas — CREAR, EDITAR y ANULAR una orden del POS. El cierre vive en `close.ts`.
 * Toda lectura y escritura filtra por el `business_id` del operador: una orden de otro negocio es
 * 404 `unknown_pos_order`, nunca 403.
 */

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

/** El id de este modulo, para releerlo bajo el lock del toggle. */
const POS_MODULE = "pos";

/** `POST /api/modules/pos/orders`. `items` puede venir vacio. El POS (y Mesas, si hay mesa) se
 * releen bajo el lock COMPARTIDO del toggle en la MISMA transaccion que inserta (ADR 0141 §4). */
export async function createPosOrder(
  business: OperatorBusiness,
  userId: string,
  raw: Record<string, unknown>,
): Promise<PosOrderDTO> {
  // Spec 0182: con mesa, el local y el nombre salen de la mesa (el `tableLabel` del cuerpo se
  // ignora); sin mesa, el texto libre de siempre.
  const table = await parseTable(business.id, raw.tableId);
  const tableLabel = table ? table.name : normalizeTableLabel(raw.tableLabel);
  const locationId = table
    ? await locationOfTable(business.id, table, raw.locationId)
    : await parseLocation(business.id, raw.locationId);
  // Sin orden todavia no hay lineas existentes: un `lineId` aca es `unknown_line`.
  const { added } = mergeLines([], parseIncomingLines(raw.items));
  const note = parseNote(raw.note) ?? null;
  const items = await snapshotNewLines(business.id, locationId, added);

  const id = await translatingOccupied(() =>
    withDbTransaction(async (tx) => {
      await lockModuleEnabled(tx, business.id, POS_MODULE);
      if (table) {
        await lockTablesEnabled(tx, business.id);
        await lockTableForOrder(tx, business.id, table.id, null);
      }
      const [row] = await tx
        .insert(posOrders)
        .values({
          businessId: business.id,
          locationId,
          tableLabel,
          diningTableId: table?.id ?? null,
          note,
          createdByUserId: userId,
        })
        .returning({ id: posOrders.id });
      await insertLines(
        tx,
        row.id,
        items.map((item, i) => ({ item, position: added[i].position })),
      );
      return row.id;
    }),
  );
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
    .select({ status: posOrders.status, locationId: posOrders.locationId })
    .from(posOrders)
    .where(and(eq(posOrders.id, id), eq(posOrders.businessId, businessId)));
  if (!row) return unknownPosOrder();
  if (row.status !== "open") return posOrderNotOpen();
  return versionConflict();
}

/**
 * `PUT /api/modules/pos/orders/:id` — la lista COMPLETA de lineas (`mergeLines`). Las existentes
 * CONSERVAN su snapshot (precio fijo al agregar): cambiar el local NO re-snapshotea. `locationId`
 * ausente conserva el local; `null`/`""` resuelve el único activo; un uuid lo cambia. `tableId` (spec 0182) igual:
 * ausente conserva la mesa, `null` vuelve a texto libre, un uuid la cambia; con mesa, el nombre se
 * refresca y el local es el de la mesa. `note` igual: ausente la conserva, `null`/`""` la borra.
 */
export async function updatePosOrder(
  business: OperatorBusiness,
  id: string,
  raw: Record<string, unknown>,
): Promise<PosOrderDTO> {
  const version = parseVersion(raw.version);
  const incoming = parseIncomingLines(raw.items);
  const note = parseNote(raw.note);
  const current = await readPosOrder(business.id, id);
  if (!current) throw unknownPosOrder();
  const table: ResolvedTable | null =
    raw.tableId === undefined
      ? current.tableId
        ? await resolveTable(business.id, current.tableId)
        : null
      : await parseTable(business.id, raw.tableId);
  const tableLabel = table ? table.name : normalizeTableLabel(raw.tableLabel);
  const locationId = table
    ? await locationOfTable(
        business.id,
        table,
        raw.locationId,
        current.tableId === table.id,
      )
    : raw.locationId === undefined
      ? (current.location?.id ?? (await parseLocation(business.id, undefined)))
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
    await translatingOccupied(() =>
      withDbTransaction(async (tx) => {
        if (table) {
          await lockModuleEnabled(tx, business.id, POS_MODULE);
          await lockTablesEnabled(tx, business.id);
          await lockTableForOrder(tx, business.id, table.id, id);
        }
        const [bumped] = await tx
          .update(posOrders)
          .set({
            tableLabel,
            diningTableId: table?.id ?? null,
            locationId,
            ...(note === undefined ? {} : { note }),
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
          .select({
            id: posOrderItems.id,
            unitPrice: posOrderItems.unitPriceSnapshot,
          })
          .from(posOrderItems)
          .where(eq(posOrderItems.posOrderId, id));
        const merge = mergeLines(
          existing.map((line) => line.id),
          incoming,
        );
        // Validate the complete merged cart before any line write. A failure rolls
        // back the optimistic header update in this same transaction.
        const prices = new Map(
          existing.map((line) => [line.id, line.unitPrice]),
        );
        totalOf([
          ...merge.kept.map((line) => ({
            quantity: line.quantity,
            unitPrice: prices.get(line.id)!,
          })),
          ...snapshots,
        ]);
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
      }),
    );
  } catch (error) {
    await withCurrentOrder(business.id, id, error);
  }
  return getPosOrder(business.id, id);
}

/** `POST /api/modules/pos/orders/:id/void`: `open → voided`. Anular una anulada → 200 idempotente; una
 * cerrada → 409 `pos_order_not_open`. */
export async function voidPosOrder(
  business: OperatorBusiness,
  userId: string,
  id: string,
): Promise<PosOrderDTO> {
  await withDbTransaction(async (tx) => {
    const [row] = await tx
      .select({ status: posOrders.status, locationId: posOrders.locationId })
      .from(posOrders)
      .where(and(eq(posOrders.id, id), eq(posOrders.businessId, business.id)))
      .for("update");
    if (!row) throw unknownPosOrder();
    if (row.status === "voided") return;
    if (row.status !== "open") throw posOrderNotOpen();
    const occurredAt = new Date();
    const lines = await linesForClose(tx, id);
    await appendModuleEvent(tx, {
      businessId: business.id,
      eventType: "pos.order.voided",
      eventVersion: 1,
      sourceId: id,
      locationId: row.locationId,
      payload: {
        eventVersion: 1,
        sourceOrderId: id,
        locationId: row.locationId,
        voidedAt: occurredAt.toISOString(),
        userId,
        lines: lines.map((line) => ({
          sourceLineId: line.sourceLineId,
          productId: line.productId,
          productLabel: line.nameSnapshot,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
        ...analyticsMoney(totalOf(lines), business.currencyCode),
      },
    });
    await tx
      .update(posOrders)
      .set({
        status: "voided",
        closedAt: occurredAt,
        closedByUserId: userId,
        updatedAt: occurredAt,
      })
      .where(eq(posOrders.id, id));
  });
  return getPosOrder(business.id, id);
}

/** Exportado para el cierre: la misma lectura de lineas, en la transaccion del cierre. */
export async function linesForClose(tx: DbTransaction, id: string) {
  const lines = await tx
    .select({
      sourceLineId: posOrderItems.id,
      position: posOrderItems.position,
      productId: posOrderItems.productId,
      nameSnapshot: posOrderItems.nameSnapshot,
      unitPrice: posOrderItems.unitPriceSnapshot,
      quantity: posOrderItems.quantity,
    })
    .from(posOrderItems)
    .where(eq(posOrderItems.posOrderId, id))
    .orderBy(posOrderItems.position, posOrderItems.id);
  return lines.map((line) => ({
    ...line,
    quantity: unitQuantityOf(line.quantity),
    unitPrice: unitPriceOf(line.unitPrice),
  }));
}
