import { and, eq } from "drizzle-orm";
import { type DbTransaction, withDbTransaction } from "@mi-pasaporte/db";
import { posOrders } from "@mi-pasaporte/db/schema";
import { computeAccrual } from "@mi-pasaporte/domain/server/loyalty-program/accrual";
import {
  CounterError,
  type OperatorBusiness,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import {
  type GrantItem,
  type GrantedOrder,
  persistGrant,
} from "../counter/orders";
import { accrualContext } from "../counter/grant";
import {
  type CouponRef,
  grantWithCouponInTx,
  parseCouponRef,
} from "../counter/grant-coupon";
import { afterGrant } from "../counter/after-grant";
import { lineTotalOf, totalOf } from "./lines";
import { posOrderNotOpen, unknownPosOrder, versionConflict } from "./errors";
import { linesForClose, parseVersion, withCurrentOrder } from "./orders";
import { type PosOrderDTO, getPosOrder } from "./read";

/**
 * Spec 0169 / ADR 0130 §3-§4 — CERRAR una orden del POS (`POST /api/pos/orders/:id/close`).
 *
 * UNA transaccion, y el orden de bloqueo es el declarado por el ADR:
 * **pos_order `FOR UPDATE` → campaign → campaign_coupon → business_customer** (los tres ultimos
 * los toma `grantWithCouponInTx`, en el orden de `coupon-locks.ts`).
 *
 * - Sin `membershipId`: la orden pasa a `closed` y no se acredita nada (no hay cliente).
 * - Con `membershipId`: LA MISMA acreditacion del mostrador en modo `detailed` — `accrualContext`
 *   (membresia del negocio, programa acreditable, su `accrual`), `persistGrant` o, con cupon, los
 *   seis pasos de `grantWithCouponInTx` — con las lineas de los SNAPSHOTS de la orden, el local de
 *   la orden y `note = "Mesa: <tableLabel>"`. Un error de la acreditacion revierte TODO: la orden
 *   sigue `open` y el cliente ve el codigo del mostrador.
 * - Reintento con el mismo `clientRequestId` sobre una orden ya cerrada con el → el resultado
 *   guardado. `afterGrant` corre DESPUES del commit y solo si ESTE cierre creo la `core.order`.
 */

type CloseInput = {
  clientRequestId: string;
  version: number;
  membershipId: string | null;
  coupon: CouponRef | null;
};

function parseCloseInput(raw: Record<string, unknown>): CloseInput {
  const clientRequestId = parseUuid(raw.clientRequestId, "clientRequestId");
  const version = parseVersion(raw.version);
  const membershipId =
    raw.membershipId === undefined ||
    raw.membershipId === null ||
    raw.membershipId === ""
      ? null
      : parseUuid(raw.membershipId, "membershipId");
  const coupon = parseCouponRef(raw.coupon);
  if (coupon && !membershipId) {
    throw new CounterError(
      422,
      "invalid_input",
      "Para aplicar un cupón escanea el pase del cliente.",
    );
  }
  return { clientRequestId, version, membershipId, coupon };
}

/** La acreditacion del cierre CON pase, dentro de la transaccion que ya tiene la `pos_order`. */
async function accreditInTx(
  tx: DbTransaction,
  ctx: {
    business: OperatorBusiness;
    userId: string;
    input: CloseInput & { membershipId: string };
    order: { locationId: string | null; tableLabel: string };
    items: GrantItem[];
    now: Date;
  },
): Promise<GrantedOrder> {
  const { business, input } = ctx;
  const { membership, program, accrual, kind } = await accrualContext(
    business.id,
    input.membershipId,
  );
  const grossTotal = totalOf(ctx.items);
  const order = {
    businessId: business.id,
    locationId: ctx.order.locationId,
    programId: program.id,
    membershipId: membership.id,
    consumerId: membership.consumerId,
    mode: "detailed",
    currencyCode: business.currencyCode,
    note: `Mesa: ${ctx.order.tableLabel}`,
    accrualKind: kind,
    createdByUserId: ctx.userId,
    clientRequestId: input.clientRequestId,
    items: ctx.items,
  } as const;
  const granted = input.coupon
    ? await grantWithCouponInTx(tx, {
        order,
        accrual,
        grossTotal,
        coupon: input.coupon,
        now: ctx.now,
      })
    : await persistGrant(
        {
          ...order,
          total: grossTotal,
          units: computeAccrual(accrual, Number(grossTotal)),
        },
        tx,
      );
  // `pushQueueId` es null solo si ya EXISTIA una `core.order` con esta clave (el `NOT EXISTS` de
  // `persistGrant` o el `previous` del cupon). Con la `pos_order` abierta y bloqueada no puede
  // ser de este cierre: es otra venta con la misma clave, y enlazarla seria mentir.
  if (!granted || granted.pushQueueId === null) {
    throw new CounterError(
      409,
      "request_reused",
      "Esa solicitud ya se usó para otra venta. Prueba de nuevo.",
    );
  }
  return granted;
}

export async function closePosOrder(
  business: OperatorBusiness,
  userId: string,
  id: string,
  raw: Record<string, unknown>,
  now: Date = new Date(),
): Promise<PosOrderDTO> {
  const input = parseCloseInput(raw);
  // Un objeto y no un `let`: TS no ve la asignacion dentro del callback de la transaccion.
  const outcome: { created: GrantedOrder | null } = { created: null };
  try {
    await withDbTransaction(async (tx) => {
      const [row] = await tx
        .select({
          status: posOrders.status,
          version: posOrders.version,
          closeRequestId: posOrders.closeRequestId,
          locationId: posOrders.locationId,
          tableLabel: posOrders.tableLabel,
        })
        .from(posOrders)
        .where(and(eq(posOrders.id, id), eq(posOrders.businessId, business.id)))
        .for("update");
      if (!row) throw unknownPosOrder();
      // El reintento: ya cerrada CON ESTA clave → el resultado guardado, sin re-acreditar.
      if (
        row.status === "closed" &&
        row.closeRequestId === input.clientRequestId
      )
        return;
      if (row.status !== "open") throw posOrderNotOpen();
      if (row.version !== input.version) throw versionConflict();

      const lines = await linesForClose(tx, id);
      if (lines.length === 0) {
        throw new CounterError(
          422,
          "empty_cart",
          "Agrega al menos un producto.",
        );
      }
      const items: GrantItem[] = lines.map((line) => ({
        productId: line.productId,
        nameSnapshot: line.nameSnapshot,
        unitPrice: Number(line.unitPrice).toFixed(2),
        quantity: line.quantity,
        lineTotal: lineTotalOf(line.unitPrice, line.quantity),
      }));

      let orderId: string | null = null;
      if (input.membershipId) {
        const granted = await accreditInTx(tx, {
          business,
          userId,
          input: { ...input, membershipId: input.membershipId },
          order: row,
          items,
          now,
        });
        orderId = granted.id;
        outcome.created = granted;
      }

      const [closed] = await tx
        .update(posOrders)
        .set({
          status: "closed",
          closedAt: now,
          closedByUserId: userId,
          closeRequestId: input.clientRequestId,
          orderId,
          updatedAt: now,
        })
        .where(and(eq(posOrders.id, id), eq(posOrders.status, "open")))
        .returning({ id: posOrders.id });
      if (!closed) throw posOrderNotOpen();
    });
  } catch (error) {
    outcome.created = null;
    await withCurrentOrder(business.id, id, error);
  }
  // Best-effort y no bloqueante (ADR 0037, spec 0143): el push y la venta cruzada, solo si ESTE
  // cierre creo la orden — nunca en el reintento ni en un rollback.
  if (outcome.created) afterGrant(outcome.created);
  return getPosOrder(business.id, id);
}
