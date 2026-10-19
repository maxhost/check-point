import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { type DbTransaction, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  diningTables,
  locations,
  posOrderItems,
  posOrders,
} from "@mi-pasaporte/db/schema";
import {
  CounterError,
  type OperatorBusiness,
} from "@mi-pasaporte/domain/server/counter/core";
import { lockBusiness } from "@mi-pasaporte/domain/server/catalog/measured-contract";
import { lockModuleEnabled } from "../../guard";
import type { PosCreateV2 } from "../contracts";
import { createIntentFingerprint } from "./create-intent";
import { parsePosCreateV2 } from "./measured-input";
import { captureMeasuredLines } from "./measured-capture";
import { getPosOrderV2 } from "./read";
import { posUpgradeRequired } from "./measured-read";
import {
  lockTableForOrder,
  lockTablesEnabled,
  translatingOccupied,
} from "./tables";

async function orderContext(
  tx: DbTransaction,
  businessId: string,
  command: PosCreateV2,
) {
  let table: { id: string; name: string; locationId: string } | undefined;
  if (command.tableId) {
    await lockTablesEnabled(tx, businessId);
    // Reuse occupancy/active validation, then capture the same row under its held lock.
    await lockTableForOrder(tx, businessId, command.tableId, null);
    [table] = await tx
      .select({
        id: diningTables.id,
        name: diningTables.name,
        locationId: diningTables.locationId,
      })
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
    tableLabel: table?.name ?? command.orderLabel ?? "",
  };
}

/** Match only known expand-phase barriers; all unknown DB failures remain failures. */
function rethrowCreateError(error: unknown): never {
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
  throw error;
}

export async function createPosOrderV2(
  business: OperatorBusiness,
  userId: string,
  raw: unknown,
) {
  const command = parsePosCreateV2(raw);
  const fingerprint = createIntentFingerprint(command);
  let id: string;
  try {
    id = await translatingOccupied(() =>
      withDbTransaction(async (tx) => {
        await lockModuleEnabled(tx, business.id, "pos");
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${"pos-create/" + business.id + "/" + command.createRequestId},0))`,
        );
        const [existing] = await tx
          .select({
            id: posOrders.id,
            fingerprint: posOrders.createRequestFingerprint,
          })
          .from(posOrders)
          .where(
            and(
              eq(posOrders.businessId, business.id),
              eq(posOrders.createRequestId, command.createRequestId),
            ),
          );
        if (existing) {
          if (existing.fingerprint !== fingerprint)
            throw new CounterError(
              409,
              "create_request_reused",
              "Esta solicitud ya se usó para otra orden.",
            );
          // Replay returns today's canonical resource, including edits/closure/voiding.
          return existing.id;
        }
        await lockBusiness(tx, business.id);
        const [authoritative] = await tx
          .select({ currencyCode: businesses.currencyCode })
          .from(businesses)
          .where(eq(businesses.id, business.id))
          .for("share");
        const context = await orderContext(tx, business.id, command);
        const captured = await captureMeasuredLines(
          tx,
          business.id,
          context.locationId,
          authoritative.currencyCode,
          command.items,
        );
        const orderId = randomUUID();
        await tx.insert(posOrders).values({
          id: orderId,
          businessId: business.id,
          locationId: context.locationId,
          diningTableId: command.tableId,
          saleType: command.saleType,
          tableLabel:
            command.saleType === "counter"
              ? `Mostrador ${orderId.slice(0, 8)}`
              : context.tableLabel,
          note: command.note,
          createdByUserId: userId,
          createRequestId: command.createRequestId,
          createRequestFingerprint: fingerprint,
          totalSnapshot: captured.total,
        });
        if (captured.lines.length)
          await tx.insert(posOrderItems).values(
            captured.lines.map((line) => ({
              id: line.sourceLineId,
              posOrderId: orderId,
              productId: line.productId,
              nameSnapshot: line.name,
              unitPriceSnapshot: line.unitPrice,
              quantity: line.quantity,
              position: line.position,
              measureKind: line.measure.kind,
              quantityUnit: line.measure.quantityUnit,
              priceUnit: line.measure.priceUnit,
              conversionVersion: line.measure.conversionVersion,
            })),
          );
        return orderId;
      }),
    );
  } catch (error) {
    rethrowCreateError(error);
  }
  return getPosOrderV2(business.id, id);
}
