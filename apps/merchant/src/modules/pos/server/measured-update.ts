import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { type DbTransaction, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  businessConfiguration,
  diningTables,
  locations,
  posOrderItems,
  posOrders,
} from "@mi-pasaporte/db/schema";
import { buildFinancialAmountsFromSnapshots } from "@mi-pasaporte/domain/financial";
import {
  MeasureError,
  parseQuantity,
  trustedUnitSnapshotPrice,
  trustedUnitSnapshotQuantity,
} from "@mi-pasaporte/domain/measures";
import { lockBusiness } from "@mi-pasaporte/domain/server/catalog/measured-contract";
import {
  CounterError,
  type OperatorBusiness,
} from "@mi-pasaporte/domain/server/counter/core";
import { lockModuleEnabled } from "../../guard";
import type { PosUpdateV2, PosNewLineV2, PosLineV2 } from "../contracts";
import {
  PosError,
  posOrderNotOpen,
  unknownPosOrder,
  versionConflict,
  VERSION_CONFLICT,
} from "./errors";
import { parsePosUpdateV2 } from "./measured-input";
import { resolveExistingMeasuredLine } from "./measured-line-input";
import { captureMeasuredLines } from "./measured-capture";
import {
  persistedSaleType,
  posUpgradeRequired,
  snapshotMeasure,
} from "./measured-read";
import { getPosOrderV2 } from "./read";
import {
  lockTableForOrder,
  lockTablesEnabled,
  translatingOccupied,
} from "./tables";

type StoredOrder = typeof posOrders.$inferSelect;
async function context(
  tx: DbTransaction,
  businessId: string,
  order: StoredOrder,
  command: PosUpdateV2,
) {
  const sameTable = command.tableId === order.diningTableId;
  const sameLocation = command.locationId === order.locationId;
  // Historical context remains valid when preserved, even after archival/toggle changes.
  if (sameTable && sameLocation)
    return {
      locationId: order.locationId,
      tableLabel: command.tableId
        ? order.tableLabel
        : command.saleType === "counter"
          ? persistedSaleType(order.saleType, order.diningTableId) === "counter"
            ? order.tableLabel
            : `Mostrador ${order.id.slice(0, 8)}`
          : command.orderLabel,
    };
  let table: { locationId: string; name: string } | undefined;
  if (command.tableId) {
    await lockTablesEnabled(tx, businessId);
    await lockTableForOrder(tx, businessId, command.tableId, order.id);
    [table] = await tx
      .select({ locationId: diningTables.locationId, name: diningTables.name })
      .from(diningTables)
      .where(
        and(
          eq(diningTables.id, command.tableId),
          eq(diningTables.businessId, businessId),
        ),
      )
      .for("share");
    if (command.locationId !== null && command.locationId !== table.locationId)
      throw new CounterError(
        422,
        "table_location_mismatch",
        "La mesa no pertenece a ese local.",
      );
  }
  const requested = table?.locationId ?? command.locationId;
  const rows = await tx
    .select({ id: locations.id, status: locations.status })
    .from(locations)
    .where(
      and(
        eq(locations.businessId, businessId),
        requested
          ? eq(locations.id, requested)
          : eq(locations.status, "active"),
      ),
    )
    .orderBy(asc(locations.createdAt), asc(locations.id))
    .for("share");
  if (requested && !rows[0])
    throw new CounterError(404, "location_not_found", "Ese local no existe.");
  if (requested && rows[0].status !== "active")
    throw new CounterError(
      409,
      "location_archived",
      "Ese local está archivado. Elige un local activo.",
    );
  if (!requested && rows.length !== 1)
    throw new CounterError(
      422,
      "location_required",
      "Elige un local activo para la orden.",
    );
  return {
    locationId: rows[0].id,
    tableLabel:
      table?.name ??
      (command.saleType === "counter"
        ? `Mostrador ${order.id.slice(0, 8)}`
        : command.orderLabel),
  };
}

/** Authoritative sources only. Disabled units may preserve exactly the previous capture. */
export function resolveUpdateSource(
  input: Parameters<typeof resolveExistingMeasuredLine>[0],
  source: Parameters<typeof resolveExistingMeasuredLine>[1],
  enabledUnits: readonly string[],
) {
  const resolved = resolveExistingMeasuredLine(input, source);
  if (
    resolved.measure.kind === "mass" &&
    !enabledUnits.includes(resolved.measure.quantityUnit) &&
    (resolved.quantity !== source!.quantity ||
      resolved.measure.quantityUnit !== source!.measure.quantityUnit)
  )
    throw new CounterError(
      422,
      "invalid_unit",
      "La unidad no está habilitada en tu negocio.",
    );
  return resolved;
}

function rethrowStorageError(error: unknown): never {
  let current = error;
  const visited = new Set<unknown>();
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const db = current as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };
    if (
      db.code === "23514" &&
      [
        "pos_order_item_quantity_legacy_check",
        "pos_order_item_price_legacy_check",
        "pos_order_item_measure_legacy_check",
      ].includes(db.constraint ?? "")
    )
      posUpgradeRequired();
    current = db.cause;
  }
  if (error instanceof MeasureError)
    throw new CounterError(
      422,
      error.code,
      "La cantidad, medida o tarifa no es válida.",
    );
  throw error;
}

export async function updatePosOrderV2(
  business: OperatorBusiness,
  id: string,
  raw: unknown,
) {
  try {
    await translatingOccupied(() =>
      withDbTransaction(async (tx) => {
        // Same prefix as creation. Configuration always precedes product locks.
        await lockModuleEnabled(tx, business.id, "pos");
        await lockBusiness(tx, business.id);
        const [authoritative] = await tx
          .select({ currencyCode: businesses.currencyCode })
          .from(businesses)
          .where(eq(businesses.id, business.id))
          .for("share");
        const [order] = await tx
          .select()
          .from(posOrders)
          .where(
            and(eq(posOrders.id, id), eq(posOrders.businessId, business.id)),
          )
          .for("update");
        if (!order) throw unknownPosOrder();
        if (order.status !== "open") throw posOrderNotOpen();
        const command = parsePosUpdateV2(raw, {
          saleType: persistedSaleType(order.saleType, order.diningTableId),
        });
        if (command.version !== order.version) throw versionConflict();
        const destination = await context(tx, business.id, order, command);
        const stored = await tx
          .select()
          .from(posOrderItems)
          .where(eq(posOrderItems.posOrderId, id))
          .orderBy(asc(posOrderItems.position), asc(posOrderItems.id))
          .for("update");
        const sources = new Map(
          stored.map((row) => {
            const measure = snapshotMeasure(row);
            return [
              row.id,
              {
                lineId: row.id,
                productId: row.productId,
                name: row.nameSnapshot,
                quantity:
                  measure.kind === "unit"
                    ? trustedUnitSnapshotQuantity(row.quantity)
                    : parseQuantity(row.quantity),
                unitPrice:
                  measure.kind === "unit"
                    ? trustedUnitSnapshotPrice(row.unitPriceSnapshot)
                    : row.unitPriceSnapshot,
                measure,
              } satisfies Pick<
                PosLineV2,
                | "lineId"
                | "productId"
                | "name"
                | "quantity"
                | "unitPrice"
                | "measure"
              >,
            ] as const;
          }),
        );
        const [config] = await tx
          .select({ units: businessConfiguration.salesMassUnits })
          .from(businessConfiguration)
          .where(eq(businessConfiguration.businessId, business.id));
        const fresh = command.items.filter(
          (line): line is PosNewLineV2 => !line.lineId,
        );
        const captured = await captureMeasuredLines(
          tx,
          business.id,
          destination.locationId!,
          authoritative.currencyCode,
          fresh,
        );
        let next = 0;
        const lines = command.items.map((input, position) => {
          if (!input.lineId) return { ...captured.lines[next++], position };
          const source = resolveUpdateSource(
            input,
            sources.get(input.lineId),
            config?.units ?? ["kg"],
          );
          return { ...source, sourceLineId: source.lineId, position };
        });
        const total = lines.length
          ? buildFinancialAmountsFromSnapshots({
              currencyCode: authoritative.currencyCode,
              discount: null,
              lines,
            }).gross
          : "0.00";
        await tx
          .update(posOrders)
          .set({
            locationId: destination.locationId,
            diningTableId: command.tableId,
            tableLabel: destination.tableLabel,
            saleType: command.saleType,
            note: command.note,
            totalSnapshot: total,
            version: sql`${posOrders.version} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(eq(posOrders.id, id), eq(posOrders.businessId, business.id)),
          );
        const kept = new Set(lines.map((line) => line.sourceLineId));
        const removed = stored
          .filter((row) => !kept.has(row.id))
          .map((row) => row.id);
        if (removed.length)
          await tx
            .delete(posOrderItems)
            .where(
              and(
                eq(posOrderItems.posOrderId, id),
                inArray(posOrderItems.id, removed),
              ),
            );
        for (const line of lines) {
          if (sources.has(line.sourceLineId))
            await tx
              .update(posOrderItems)
              .set({
                quantity: line.quantity,
                quantityUnit: line.measure.quantityUnit,
                position: line.position,
              })
              .where(
                and(
                  eq(posOrderItems.id, line.sourceLineId),
                  eq(posOrderItems.posOrderId, id),
                ),
              );
          else
            await tx.insert(posOrderItems).values({
              id: line.sourceLineId,
              posOrderId: id,
              productId: line.productId,
              nameSnapshot: line.name,
              unitPriceSnapshot: line.unitPrice,
              quantity: line.quantity,
              position: line.position,
              measureKind: line.measure.kind,
              quantityUnit: line.measure.quantityUnit,
              priceUnit: line.measure.priceUnit,
              conversionVersion: line.measure.conversionVersion,
            });
        }
      }),
    );
  } catch (error) {
    if (error instanceof CounterError && error.code === VERSION_CONFLICT)
      throw new PosError(error.status, error.code, error.message, {
        order: await getPosOrderV2(business.id, id),
      });
    rethrowStorageError(error);
  }
  return getPosOrderV2(business.id, id);
}
