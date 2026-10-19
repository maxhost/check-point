import { and, asc, eq, sql } from "drizzle-orm";
import { withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  locations,
  posOrderItems,
  posOrders,
} from "@mi-pasaporte/db/schema";
import {
  buildFinancialSettlementFromSnapshots,
  FinancialError,
} from "@mi-pasaporte/domain/financial";
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
import { after } from "next/server";
import { lockModuleEnabled, moduleLockKey } from "../../guard";
import {
  freezeSaleCommission,
  prepareSaleCommission,
} from "../../../server/business/commission-close";
import { afterGrant } from "../../../server/counter/after-grant";
import {
  readOrderByRequest,
  type GrantedOrder,
} from "../../../server/counter/orders";
import {
  publishMeasuredSaleClosed,
  retryModuleEvents,
} from "../../../server/module-events";
import { captureSaleResources } from "../../../server/module-events/publish";
import {
  beginRequestMeasurement,
  measureRequestPhase,
} from "../../../server/request-measurement";
import {
  PosError,
  posOrderNotOpen,
  unknownPosOrder,
  versionConflict,
  VERSION_CONFLICT,
} from "./errors";
import { accreditMeasuredInTx } from "./measured-accredit";
import { parseMeasuredCloseInput } from "./measured-close-input";
import { inputUuid } from "./measured-line-input";
import { snapshotMeasure } from "./measured-read";
import { paymentMethodsForClose } from "./payment-methods";
import { getPosOrderV2 } from "./read";
import { paymentMetadata, persistPaymentSnapshot } from "./settlement";

/** Internal V2 close; HTTP activation and legacy close deliberately remain separate. */
export async function closeMeasuredPosOrder(
  business: OperatorBusiness,
  userId: string,
  id: string,
  raw: unknown,
  now: Date = new Date(),
) {
  id = inputUuid(id, "id");
  const input = parseMeasuredCloseInput(raw);
  const outcome: { created: GrantedOrder | null; closed: boolean } = {
    created: null,
    closed: false,
  };
  try {
    await withDbTransaction(async (tx) => {
      // Same common prefix as create/PUT. Acquire without validating activation so a
      // frozen replay works even after a toggle; never lock POS before configuration.
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
      if (
        row.status === "closed" &&
        row.closeRequestId === input.clientRequestId
      )
        return;
      if (row.status !== "open") throw posOrderNotOpen();
      if (row.version !== input.version) throw versionConflict();
      await lockModuleEnabled(tx, business.id, "pos");
      const [used] = await tx
        .select({ id: posOrders.id })
        .from(posOrders)
        .where(
          and(
            eq(posOrders.businessId, business.id),
            eq(posOrders.closeRequestId, input.clientRequestId),
          ),
        );
      if (
        used ||
        (!input.membershipId &&
          (await readOrderByRequest(business.id, input.clientRequestId, tx)))
      )
        throw new CounterError(
          409,
          "request_reused",
          "Esa solicitud ya se usó para otra venta. Prueba de nuevo.",
        );
      const currentBusiness = {
        ...business,
        currencyCode: authoritative.currencyCode,
      };
      const [location] = await tx
        .select({ id: locations.id })
        .from(locations)
        .where(
          and(
            eq(locations.businessId, business.id),
            eq(
              locations.id,
              row.locationId ?? "00000000-0000-0000-0000-000000000000",
            ),
          ),
        )
        .for("share");
      // Historical archived locations remain valid; closing never changes context.
      if (!location)
        throw new CounterError(
          422,
          "location_required",
          "La orden necesita un local válido.",
        );
      const stored = await tx
        .select()
        .from(posOrderItems)
        .where(eq(posOrderItems.posOrderId, id))
        .orderBy(asc(posOrderItems.position), asc(posOrderItems.id))
        .for("update");
      if (!stored.length)
        throw new CounterError(
          422,
          "empty_cart",
          "Agrega al menos un producto.",
        );
      const lines = stored.map((line, position) => {
        const measure = snapshotMeasure(line);
        return {
          sourceLineId: line.id,
          productId: line.productId,
          nameSnapshot: line.nameSnapshot,
          quantity:
            measure.kind === "unit"
              ? trustedUnitSnapshotQuantity(line.quantity)
              : parseQuantity(line.quantity),
          unitPrice:
            measure.kind === "unit"
              ? trustedUnitSnapshotPrice(line.unitPriceSnapshot)
              : line.unitPriceSnapshot,
          position,
          measure,
        };
      });
      const accredited = input.membershipId
        ? await accreditMeasuredInTx(tx, {
            business: currentBusiness,
            userId,
            membershipId: input.membershipId,
            clientRequestId: input.clientRequestId,
            locationId: row.locationId,
            note: row.note,
            items: lines,
            payments: input.payments,
            coupon: input.coupon
              ? { ...input.coupon, productId: input.coupon.productId ?? null }
              : null,
            now,
          })
        : null;
      const settlement =
        accredited?.settlement ??
        buildFinancialSettlementFromSnapshots({
          currencyCode: authoritative.currencyCode,
          lines,
          discount: null,
          payments: input.payments,
        });
      const methods = await paymentMethodsForClose(
        tx,
        business.id,
        input.payments.map((payment) => payment.methodId),
      );
      const paymentsMetadata = paymentMetadata(settlement, methods, "core");
      await persistPaymentSnapshot(
        tx,
        business.id,
        id,
        settlement,
        methods,
        "core",
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
        locationId: location.id,
        settlement,
        paymentsMetadata,
        capture,
      };
      const prepared = await prepareSaleCommission(tx, commissionInput);
      const event = await publishMeasuredSaleClosed(tx, {
        businessId: business.id,
        sourceOrderId: id,
        locationId: location.id,
        userId,
        settlement,
        capture,
        paymentsMetadata,
        commissionByLine: prepared.lineCommissions,
        lines: lines.map((line) => ({
          ...line,
          productLabel: line.nameSnapshot,
        })),
      });
      await freezeSaleCommission(
        tx,
        { ...commissionInput, eventId: event.eventId },
        prepared,
      );
      await tx
        .update(posOrders)
        .set({
          status: "closed",
          closedAt: event.closedAt,
          closedByUserId: userId,
          closeRequestId: input.clientRequestId,
          orderId: accredited?.granted.id ?? null,
          settlement: {
            ...settlement,
            payments: settlement.payments.map((payment) => ({
              ...payment,
              ...paymentsMetadata.find(
                (metadata) => metadata.paymentId === payment.paymentId,
              )!,
            })),
          },
          updatedAt: event.closedAt,
        })
        .where(eq(posOrders.id, id));
      outcome.created = accredited?.granted ?? null;
      outcome.closed = true;
    });
  } catch (error) {
    if (error instanceof CounterError && error.code === VERSION_CONFLICT)
      throw new PosError(error.status, error.code, error.message, {
        order: await getPosOrderV2(business.id, id),
      });
    if (error instanceof FinancialError)
      throw new PosError(
        422,
        error.code,
        "El importe cambió o los pagos no coinciden. Revisa el cobro y vuelve a confirmar.",
        error.details ?? {},
      );
    if (error instanceof MeasureError)
      throw new CounterError(
        422,
        error.code,
        "La cantidad, medida o tarifa no es válida.",
      );
    throw error;
  }
  if (outcome.created) {
    const finish = beginRequestMeasurement("after-grant-schedule");
    try {
      afterGrant(outcome.created);
    } catch {
      /* The durable sale already committed. */
    } finally {
      finish();
    }
  }
  if (outcome.closed) {
    const retry = () =>
      measureRequestPhase("module-events-aftercommit", () =>
        retryModuleEvents({
          eventTypes: [
            "sale.closed",
            "recipes.consumption.applied",
            "sale.commission.frozen",
          ],
          businessId: business.id,
          budgetMs: 20000,
          batchSize: 50,
        }),
      ).then(
        () => undefined,
        () => undefined,
      );
    try {
      after(retry);
    } catch {
      void retry();
    }
  }
  return getPosOrderV2(business.id, id);
}
