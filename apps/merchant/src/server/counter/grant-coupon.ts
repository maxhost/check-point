import { eq, sql } from "drizzle-orm";
import { withDbTransaction } from "@mi-pasaporte/db";
import { couponRedemptions } from "@mi-pasaporte/db/schema";
import { computeAccrual } from "@mi-pasaporte/domain/server/loyalty-program/accrual";
import type { AccrualInput } from "@mi-pasaporte/domain/server/loyalty-program/core";
import {
  CounterError,
  parseUuid,
  pgErrorCode,
} from "@mi-pasaporte/domain/server/counter/core";
import {
  type GrantedOrder,
  type PersistGrantInput,
  persistGrant,
  readOrderByRequest,
} from "./orders";
import {
  assertDailyLimit,
  clearSelectionIf,
  createdToday,
  lockBusinessCustomer,
  lockCounterCoupon,
  selectedCouponOf,
} from "./coupon-locks";
import {
  assertCouponRedeemable,
  insertCounterRedemption,
} from "./coupon-store";
import { decideCouponDiscount } from "./coupon-discount";

/**
 * THE SALE WITH A COUPON (spec 0148 / ADR 0119 §5-§7, §12-§13; contract M4): `POST
 * /api/counter/grant` with `coupon`. One INTERACTIVE transaction:
 *
 *  1. locks in the declared order (`coupon-locks.ts`); idempotency — an order with this
 *     `clientRequestId` is returned as it is, never re-decided;
 *  2. the coupon has to be CHOSEN by the consumer, or VALIDATED today at this business;
 *  3. the daily limit (its own validated row aside) and, when it was only chosen, validity
 *     and cap (`decideCouponRedemption`);
 *  4. the discount (`coupon-discount.ts`, pure), the order's total = the NET, and the units
 *     over the NET (§12: «si el pago deberia ser 20 y el descuento lo deja en 10, se otorgan
 *     10 puntos»);
 *  5. the order (`persistGrant` in this transaction), then the coupon is tied to it: the
 *     validated row gets `order_id`/`discount_amount`, or a chosen one gets its row now —
 *     with its visit and turn outcome, and no coupon push (the order enqueues its own);
 *  6. the choice is spent.
 */

export type CouponRef = { couponId: string; productId: string | null };

/** `coupon?: { couponId, productId? }` of the grant's body; absent/null → no coupon. */
export function parseCouponRef(raw: unknown): CouponRef | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw))
    throw new CounterError(422, "invalid_input", "El cupón no es válido.");
  const ref = raw as Record<string, unknown>;
  return {
    couponId: parseUuid(ref.couponId, "couponId"),
    productId:
      ref.productId === undefined ||
      ref.productId === null ||
      ref.productId === ""
        ? null
        : parseUuid(ref.productId, "productId"),
  };
}

const NOT_SELECTED = "El cliente no eligió este cupón en su app.";
const toCents = (value: string) => Math.round(Number(value) * 100);
const fromCents = (value: number) => (value / 100).toFixed(2);

export async function grantWithCoupon(ctx: {
  order: Omit<PersistGrantInput, "total" | "units">;
  accrual: AccrualInput;
  grossTotal: string;
  coupon: CouponRef;
  now: Date;
}): Promise<GrantedOrder> {
  const { order, now } = ctx;
  const { businessId, consumerId, clientRequestId } = order;
  try {
    return await withDbTransaction(async (tx) => {
      // (1) Locks, then idempotency before every guard.
      const locked = await lockCounterCoupon(
        tx,
        businessId,
        consumerId,
        ctx.coupon.couponId,
      );
      await lockBusinessCustomer(tx, businessId, consumerId);
      const previous = await readOrderByRequest(
        businessId,
        clientRequestId,
        tx,
      );
      if (previous) return previous;

      // (2) Chosen, or validated today here (a row of another day, sold or `extra_*` is
      // consumed — the same answer: the consumer has nothing to apply).
      const own = await tx.execute<{
        id: string;
        order_id: string | null;
        kind_snapshot: string;
        today: boolean;
      }>(sql`
        select cr.id, cr.order_id, cr.kind_snapshot, ${createdToday(now)} as today
        from core.coupon_redemption cr
        join core.business b on b.id = cr.business_id
        where cr.coupon_id = ${locked.coupon.id}
      `);
      const [row] = own.rows;
      let validatedId: string | null = null;
      if (row) {
        if (
          row.order_id !== null ||
          row.today !== true ||
          row.kind_snapshot === "extra_stamps" ||
          row.kind_snapshot === "extra_points"
        )
          throw new CounterError(409, "coupon_not_selected", NOT_SELECTED);
        validatedId = row.id;
      } else if ((await selectedCouponOf(tx, consumerId)) !== locked.coupon.id)
        throw new CounterError(409, "coupon_not_selected", NOT_SELECTED);

      // (3) One coupon per consumer + business + day; validity and cap if only chosen.
      await assertDailyLimit(tx, businessId, consumerId, now, validatedId);
      if (validatedId === null) await assertCouponRedeemable(tx, locked, now);

      // (4) Discount, net total, units over the net.
      const grossCents = toCents(ctx.grossTotal);
      const decision = decideCouponDiscount({
        kind: locked.coupon.kindSnapshot,
        discountUnit: locked.coupon.discountUnitSnapshot as
          "percent" | "amount" | null,
        discountValue: locked.coupon.discountValueSnapshot,
        currencyCode: locked.coupon.currencyCodeSnapshot,
        businessCurrency: order.currencyCode,
        mode: order.mode,
        items: order.items,
        totalCents: grossCents,
        productId: locked.coupon.productId ?? ctx.coupon.productId,
      });
      if (!decision.ok)
        throw new CounterError(
          decision.status,
          decision.code,
          decision.message,
        );
      const net = fromCents(grossCents - decision.discountCents);
      const discountAmount = fromCents(decision.discountCents);
      const units = computeAccrual(ctx.accrual, Number(net));

      // (5) The order, then the coupon tied to it.
      const granted = await persistGrant({ ...order, total: net, units }, tx);
      if (!granted)
        throw new CounterError(
          503,
          "grant_failed",
          "No pudimos acreditar. Prueba de nuevo.",
        );
      if (validatedId !== null)
        await tx
          .update(couponRedemptions)
          .set({ orderId: granted.id, discountAmount })
          .where(eq(couponRedemptions.id, validatedId));
      else
        await insertCounterRedemption(tx, {
          locked,
          businessId,
          membershipId: locked.coupon.membershipId ?? order.membershipId,
          locationId: order.locationId,
          createdByUserId: order.createdByUserId,
          clientRequestId,
          grant: null,
          orderId: granted.id,
          discountAmount,
          push: false,
          now,
        });
      // (6) The choice is spent.
      await clearSelectionIf(tx, consumerId, locked.coupon.id);
      return {
        ...granted,
        coupon: { label: locked.coupon.labelSnapshot, discountAmount },
      };
    });
  } catch (error) {
    // A concurrent sale with the same key won → its order (no re-grant).
    if (pgErrorCode(error) !== "23505") throw error;
    const winner = await readOrderByRequest(businessId, clientRequestId);
    if (!winner) throw error;
    return winner;
  }
}
