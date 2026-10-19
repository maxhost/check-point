import type { DbTransaction } from "@mi-pasaporte/db";
import {
  buildFinancialSettlementFromSnapshots,
  type FinancialSettlement,
  type PaymentInput,
} from "@mi-pasaporte/domain/financial";
import { computeAccrualFromMoney } from "@mi-pasaporte/domain/server/loyalty-program/accrual";
import {
  CounterError,
  type OperatorBusiness,
} from "@mi-pasaporte/domain/server/counter/core";
import { accrualContext } from "../../../server/counter/grant";
import type { CouponRef } from "../../../server/counter/grant-coupon";
import {
  clearSelectionIf,
  lockBusinessCustomer,
  lockCounterCoupon,
  selectedCouponOf,
} from "../../../server/counter/coupon-locks";
import { assertCouponVerdict } from "../../../server/counter/coupon-verdict";
import { grantCouponExtras } from "../../../server/counter/coupon-extras";
import { insertCounterRedemption } from "../../../server/counter/coupon-store";
import {
  persistMeasuredGrant,
  readOrderByRequest,
  type GrantedOrder,
} from "../../../server/counter/orders";
import type { MeasuredGrantItem } from "../../../server/counter/measured-order-input";
import { decideMeasuredBenefit } from "../measured-benefit";

export type MeasuredAccreditInput = {
  business: OperatorBusiness;
  userId: string;
  membershipId: string;
  clientRequestId: string;
  locationId: string | null;
  note: string | null;
  /** Locked, authorized source snapshots in stable source order, never HTTP prices. */
  items: readonly Omit<MeasuredGrantItem, "lineTotal">[];
  /** Caller validates methods and persists the payment snapshot in this same transaction. */
  payments: readonly PaymentInput[];
  /** Null excludes the benefit locally and leaves the consumer's selection intact. */
  coupon: (CouponRef & { targetSourceLineId?: string }) | null;
  now: Date;
};

function requestReused(): CounterError {
  return new CounterError(
    409,
    "request_reused",
    "Esa solicitud ya se usó para otra venta. Prueba de nuevo.",
  );
}

/** Internal future-close component. Caller owns pos_order lock/version and the transaction,
 * including payments, resources, commission and event. A closed-order replay is answered
 * from its POS settlement BEFORE calling here. A core key already used by another sale
 * is rejected; its missing financial originals must never be reconstructed from totals.
 * No 23505 is caught: a concurrent conflict must abort the caller's transaction.
 */
export async function accreditMeasuredInTx(
  tx: DbTransaction,
  ctx: MeasuredAccreditInput,
): Promise<{ settlement: FinancialSettlement; granted: GrantedOrder }> {
  const { business, now } = ctx;
  const { membership, program, accrual, kind } = await accrualContext(
    business.id,
    ctx.membershipId,
  );
  const consumerId = membership.consumerId;
  const locked = ctx.coupon
    ? await lockCounterCoupon(tx, business.id, consumerId, ctx.coupon.couponId)
    : null;
  if (locked) await lockBusinessCustomer(tx, business.id, consumerId);
  if (await readOrderByRequest(business.id, ctx.clientRequestId, tx))
    throw requestReused();
  const membershipId = locked?.coupon.membershipId ?? membership.id;
  if (locked) {
    if ((await selectedCouponOf(tx, consumerId)) !== locked.coupon.id)
      throw new CounterError(
        409,
        "coupon_not_selected",
        "El cliente no eligió este cupón en su app.",
      );
    await assertCouponVerdict(tx, {
      locked,
      businessId: business.id,
      membershipId,
      now,
    });
  }
  const lines = ctx.items.map((item, position) => ({ ...item, position }));
  const decision = decideMeasuredBenefit({
    currencyCode: business.currencyCode,
    lines,
    coupon: locked
      ? {
          couponId: locked.coupon.id,
          campaignId: locked.campaign.id,
          kind: locked.coupon.kindSnapshot,
          productId: locked.coupon.productId ?? ctx.coupon!.productId,
          discountUnit: locked.coupon.discountUnitSnapshot as
            "percent" | "amount" | null,
          discountValue: locked.coupon.discountValueSnapshot,
          currencyCode: locked.coupon.currencyCodeSnapshot,
          ...(ctx.coupon!.targetSourceLineId !== undefined
            ? { targetSourceLineId: ctx.coupon!.targetSourceLineId }
            : {}),
        }
      : null,
  });
  if (!decision.ok)
    throw new CounterError(
      decision.status,
      decision.code,
      "El cupón no aplica a esta venta.",
    );
  const settlement = buildFinancialSettlementFromSnapshots({
    currencyCode: business.currencyCode,
    lines,
    discount: decision.discount,
    payments: ctx.payments,
  });
  const granted = await persistMeasuredGrant(
    {
      businessId: business.id,
      consumerId,
      membershipId: membership.id,
      programId: program.id,
      locationId: ctx.locationId,
      createdByUserId: ctx.userId,
      clientRequestId: ctx.clientRequestId,
      mode: "detailed",
      note: ctx.note,
      currencyCode: business.currencyCode,
      accrualKind: kind,
      units: computeAccrualFromMoney(accrual, settlement.collected),
      total: settlement.collected,
      items: ctx.items.map((item, position) => ({
        ...item,
        lineTotal: settlement.lines[position].money.gross,
      })),
      settlement,
    },
    tx,
  );
  if (!granted || granted.pushQueueId === null) throw requestReused();
  if (!locked) return { settlement, granted };
  const extra = await grantCouponExtras(tx, {
    businessId: business.id,
    membershipId,
    kindSnapshot: locked.coupon.kindSnapshot,
    extraUnitsSnapshot: locked.coupon.extraUnitsSnapshot,
  });
  await insertCounterRedemption(tx, {
    locked,
    businessId: business.id,
    membershipId,
    locationId: ctx.locationId,
    createdByUserId: ctx.userId,
    clientRequestId: ctx.clientRequestId,
    grant: extra,
    orderId: granted.id,
    discountAmount: settlement.discount,
    salesAmount: settlement.collected,
    currencyCode: settlement.currencyCode,
    now,
  });
  await clearSelectionIf(tx, consumerId, locked.coupon.id);
  return {
    settlement,
    granted: {
      ...granted,
      financialDiscount: decision.discount
        ? { amount: settlement.discount, origin: decision.discount.origin }
        : null,
      balanceAfter: extra?.balanceAfter ?? granted.balanceAfter,
      coupon: {
        label: locked.coupon.labelSnapshot,
        discountAmount: settlement.discount,
        extraUnits: extra?.unitsGranted ?? null,
      },
    },
  };
}
