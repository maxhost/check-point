import { and, asc, eq, sql } from "drizzle-orm";
import { withDbTransaction } from "@mi-pasaporte/db";
import { businesses, posOrderItems, posOrders } from "@mi-pasaporte/db/schema";
import {
  buildFinancialAmountsFromSnapshots,
  FinancialError,
} from "@mi-pasaporte/domain/financial";
import {
  formatMinor,
  minorUnitForCurrency,
  originalMoney,
  toMinor,
} from "@mi-pasaporte/domain/financial/rational";
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
import { lockModuleEnabled, moduleLockKey } from "../../guard";
import { appendModuleEvent } from "../../../server/module-events/append";
import type { PosOrderV2, PosVoidV2 } from "../contracts";
import {
  PosError,
  posOrderNotOpen,
  unknownPosOrder,
  versionConflict,
  VERSION_CONFLICT,
} from "./errors";
import { inputObject, inputUuid, invalidPosInput } from "./measured-line-input";
import { snapshotMeasure } from "./measured-read";
import { getPosOrderV2 } from "./read";
import type { OrderVoidedV2 } from "./void-snapshot";

export function parseMeasuredVoidInput(raw: unknown = {}): PosVoidV2 {
  const value = inputObject(raw, ["version"]);
  if (
    Object.hasOwn(value, "version") &&
    (typeof value.version !== "number" ||
      !Number.isInteger(value.version) ||
      value.version < 1 ||
      value.version > 2147483647)
  )
    invalidPosInput();
  return Object.hasOwn(value, "version")
    ? { version: value.version as number }
    : {};
}

/** Internal command: the future HTTP handler owns guard/scope and activation. */
export async function voidMeasuredPosOrder(
  business: OperatorBusiness,
  userId: string,
  id: string,
  raw?: unknown,
  now: Date = new Date(),
): Promise<PosOrderV2> {
  id = inputUuid(id, "id");
  const input = parseMeasuredVoidInput(raw);
  try {
    await withDbTransaction(async (tx) => {
      // Same lock prefix as create/PUT/close, including disabled-module replay.
      await tx.execute(
        sql`select pg_advisory_xact_lock_shared(hashtextextended(${moduleLockKey(business.id)},0))`,
      );
      await lockBusiness(tx, business.id);
      const [authoritative] = await tx
        .select({ currencyCode: businesses.currencyCode })
        .from(businesses)
        .where(eq(businesses.id, business.id))
        .for("share");
      const [row] = await tx
        .select()
        .from(posOrders)
        .where(and(eq(posOrders.id, id), eq(posOrders.businessId, business.id)))
        .for("update");
      if (!row) throw unknownPosOrder();
      if (row.status === "voided") return;
      if (row.status !== "open") throw posOrderNotOpen();
      if (input.version !== undefined && row.version !== input.version)
        throw versionConflict();
      await lockModuleEnabled(tx, business.id, "pos");
      const stored = await tx
        .select()
        .from(posOrderItems)
        .where(eq(posOrderItems.posOrderId, id))
        .orderBy(asc(posOrderItems.position), asc(posOrderItems.id))
        .for("update");
      const lines = stored.map((line) => {
        const measure = snapshotMeasure(line);
        return {
          sourceLineId: line.id,
          productId: line.productId,
          productLabel: line.nameSnapshot,
          position: line.position,
          measure,
          quantity:
            measure.kind === "unit"
              ? trustedUnitSnapshotQuantity(line.quantity)
              : parseQuantity(line.quantity),
          unitPrice:
            measure.kind === "unit"
              ? trustedUnitSnapshotPrice(line.unitPriceSnapshot)
              : line.unitPriceSnapshot,
        };
      });
      const minorUnit = minorUnitForCurrency(authoritative.currencyCode);
      const zero = { numerator: "0", denominator: "1", scale: 2 as const };
      const originals = { gross: zero, discount: zero, net: zero };
      const empty = formatMinor(0n, minorUnit);
      const money = lines.length
        ? buildFinancialAmountsFromSnapshots({
            currencyCode: authoritative.currencyCode,
            discount: null,
            lines,
          })
        : {
            gross: empty,
            discount: empty,
            collected: empty,
            roundingAdjustment: empty,
            currencyCode: authoritative.currencyCode,
            minorUnit,
            originals,
            normalizationAdjustments: originals,
            lines: [],
          };
      for (const line of money.lines)
        await tx
          .update(posOrderItems)
          .set({ financialSnapshot: line })
          .where(
            and(
              eq(posOrderItems.id, line.sourceLineId),
              eq(posOrderItems.posOrderId, id),
            ),
          );
      const financial = new Map(
        money.lines.map((line) => [line.sourceLineId, line]),
      );
      const payload: OrderVoidedV2 = {
        eventVersion: 2,
        sourceOrderId: id,
        locationId: row.locationId,
        voidedAt: now.toISOString(),
        userId,
        lines: lines.map((line) => ({
          ...line,
          ...financial.get(line.sourceLineId)!,
        })),
        money,
        amountMinor: String(
          toMinor(originalMoney(money.gross), money.minorUnit),
        ),
        currencyCode: money.currencyCode,
        minorUnit: money.minorUnit,
      };
      await appendModuleEvent(tx, {
        businessId: business.id,
        eventType: "pos.order.voided",
        eventVersion: 2,
        sourceId: id,
        locationId: row.locationId,
        payload,
      });
      await tx
        .update(posOrders)
        .set({
          status: "voided",
          totalSnapshot: money.gross,
          closedAt: now,
          closedByUserId: userId,
          updatedAt: now,
        })
        .where(eq(posOrders.id, id));
    });
  } catch (error) {
    if (error instanceof CounterError && error.code === VERSION_CONFLICT)
      throw new PosError(error.status, error.code, error.message, {
        order: await getPosOrderV2(business.id, id),
      });
    if (error instanceof FinancialError || error instanceof MeasureError)
      throw new CounterError(
        422,
        error.code,
        "La cantidad, medida o tarifa no es válida.",
      );
    throw error;
  }
  return getPosOrderV2(business.id, id);
}
