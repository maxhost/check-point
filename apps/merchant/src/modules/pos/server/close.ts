import {
  freezeSaleCommission,
  prepareSaleCommission,
} from "../../../server/business/commission-close";
import { captureSaleResources } from "../../../server/module-events/publish";
import {
  minorUnitForCurrency,
  normalizeMoney,
} from "@mi-pasaporte/domain/financial";
import {
  parsePayments,
  settle,
  persistPaymentSnapshot,
  paymentMetadata,
} from "./settlement";
import { paymentMethodsForClose } from "./payment-methods";
import { after } from "next/server";
import {
  publishSaleClosed,
  retryModuleEvents,
} from "../../../server/module-events";
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
} from "../../../server/counter/orders";
import { accrualContext } from "../../../server/counter/grant";
import {
  type CouponRef,
  grantWithCouponInTx,
  parseCouponRef,
} from "../../../server/counter/grant-coupon";
import { afterGrant } from "../../../server/counter/after-grant";
import { lineTotalOf, totalOf } from "./lines";
import { posOrderNotOpen, unknownPosOrder, versionConflict } from "./errors";
import { linesForClose } from "./orders";
import { parseVersion, withCurrentOrder } from "./order-input";
import { type PosOrderDTO, getPosOrder } from "./read";

/** Durable close: order lock → coupon locks → immutable financial snapshot + event.
 * Subscriber application remains outside the sale commit (ADR0145). */

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
  const minorUnit = minorUnitForCurrency(business.currencyCode);
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
        settlementMinorUnit: minorUnit,
      })
    : await persistGrant(
        {
          ...order,
          total: normalizeMoney(grossTotal, minorUnit),
          units: computeAccrual(
            accrual,
            Number(normalizeMoney(grossTotal, minorUnit)),
          ),
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
        sourceLineId: line.sourceLineId,
        productId: line.productId,
        nameSnapshot: line.nameSnapshot,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: lineTotalOf(line.unitPrice, line.quantity),
      }));

      let orderId: string | null = null;
      const payments = parsePayments(raw.payments);
      const methods = await paymentMethodsForClose(
        tx,
        business.id,
        payments.map((payment) => payment.methodId),
      );
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

      const financialInput = {
        currencyCode: business.currencyCode,
        lines,
        discount: outcome.created?.financialDiscount ?? null,
      };
      // Same approved net as accreditation; one coupon decision under its own locks.
      const settlement = settle({ ...financialInput, payments });
      if (
        outcome.created &&
        normalizeMoney(outcome.created.total, settlement.minorUnit) !==
          settlement.collected
      )
        throw new Error("Accreditation net conflict");
      const paymentsMetadata = paymentMetadata(settlement, methods, "core");
      const storedSettlement = {
        ...settlement,
        payments: settlement.payments.map((payment) => ({
          ...payment,
          ...paymentsMetadata.find(
            (metadata) => metadata.paymentId === payment.paymentId,
          )!,
        })),
      };
      await persistPaymentSnapshot(
        tx,
        business.id,
        id,
        settlement,
        methods,
        "core",
      );

      if (!row.locationId)
        throw new CounterError(
          422,
          "location_required",
          "La orden necesita un local válido.",
        );
      const capture = await captureSaleResources(tx, {
        businessId: business.id,
        settlement,
        lines,
      });
      const commissionInput = {
        businessId: business.id,
        sourceProviderId: "pos",
        sourceOrderId: id,
        locationId: row.locationId,
        settlement,
        paymentsMetadata,
        capture,
      };
      const preparedCommission = await prepareSaleCommission(
        tx,
        commissionInput,
      );
      const event = await publishSaleClosed(tx, {
        commissionByLine: preparedCommission.lineCommissions,
        capture,
        businessId: business.id,
        sourceOrderId: id,
        locationId: row.locationId,
        closedAt: now,
        userId,
        settlement,
        paymentsMetadata,
        lines: lines.map(
          ({ sourceLineId, productId, quantity, nameSnapshot }) => ({
            productLabel: nameSnapshot,
            sourceLineId,
            productId,
            quantity,
          }),
        ),
      });
      await freezeSaleCommission(
        tx,
        { ...commissionInput, eventId: event.eventId },
        preparedCommission,
      );
      const closedAt = event?.closedAt ?? now;
      const [closed] = await tx
        .update(posOrders)
        .set({
          status: "closed",
          closedAt,
          closedByUserId: userId,
          closeRequestId: input.clientRequestId,
          orderId,
          settlement: storedSettlement,
          updatedAt: closedAt,
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
  // Durable deliveries survive request completion; acceleration is bounded and cannot fail this sale.
  const retry = () =>
    retryModuleEvents({
      eventTypes: [
        "sale.closed",
        "recipes.consumption.applied",
        "sale.commission.frozen",
      ],
      businessId: business.id,
      budgetMs: 20000,
      batchSize: 50,
    }).then(
      () => undefined,
      () => undefined,
    );
  try {
    after(retry);
  } catch {
    void retry();
  }
  return getPosOrder(business.id, id);
}
