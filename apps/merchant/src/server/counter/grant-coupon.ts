import { withDbTransaction } from "@mi-pasaporte/db";
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
  clearSelectionIf,
  lockBusinessCustomer,
  lockCounterCoupon,
  selectedCouponOf,
} from "./coupon-locks";
import { insertCounterRedemption } from "./coupon-store";
import { assertCouponVerdict } from "./coupon-verdict";
import { decideCouponDiscount } from "./coupon-discount";
import { grantCouponExtras } from "./coupon-extras";

/**
 * THE SALE WITH A COUPON (spec 0148 / ADR 0119 §5-§7, §12-§13; spec 0153 / ADR 0120: the
 * system validates, not the counter; contract M4): `POST /api/counter/grant` with `coupon`.
 * One INTERACTIVE transaction:
 *
 *  1. locks in the declared order (`coupon-locks.ts`); idempotency — an order with this
 *     `clientRequestId` is returned as it is, never re-decided;
 *  2. the coupon has to be the consumer's CURRENT choice (else 409 `coupon_not_selected`:
 *     they changed it — the counter re-reads M1);
 *  3. its VERDICT (`decideCouponVerdict`, the same rule `couponState` paints) over facts
 *     re-read under the locks: an invalid one is a 409 with the verdict's `code`;
 *  4. the discount (`coupon-discount.ts`, pure; `extra_*` takes 0 off), the order's total =
 *     the NET, and the units over the NET (§12: «si el pago deberia ser 20 y el descuento lo
 *     deja en 10, se otorgan 10 puntos»);
 *  5. the order (`persistGrant` in this transaction), THEN an `extra_*` coupon credits its
 *     units (`grantCouponExtras`, ADR 0120 §5) — after the order, so the card is taken by the
 *     sale first and then the program, like every balance writer; a refusal rolls the whole
 *     sale back —, then the coupon's row tied to the order, with its visit and turn outcome,
 *     and no coupon push (the order enqueues its own);
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

      // (2) The consumer's CURRENT choice — nothing else applies at the counter.
      if ((await selectedCouponOf(tx, consumerId)) !== locked.coupon.id)
        throw new CounterError(409, "coupon_not_selected", NOT_SELECTED);

      // (3) The verdict, under the locks: dates, redeemed, one a day, cap, program.
      const membershipId = locked.coupon.membershipId ?? order.membershipId;
      await assertCouponVerdict(tx, { locked, businessId, membershipId, now });

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

      // (5) The order, then the coupon's extra units, then its row tied to the order.
      const granted = await persistGrant({ ...order, total: net, units }, tx);
      if (!granted)
        throw new CounterError(
          503,
          "grant_failed",
          "No pudimos acreditar. Prueba de nuevo.",
        );
      const extra = await grantCouponExtras(tx, {
        businessId,
        membershipId,
        kindSnapshot: locked.coupon.kindSnapshot,
        extraUnitsSnapshot: locked.coupon.extraUnitsSnapshot,
      });
      await insertCounterRedemption(tx, {
        locked,
        businessId,
        membershipId,
        locationId: order.locationId,
        createdByUserId: order.createdByUserId,
        clientRequestId,
        grant: extra,
        orderId: granted.id,
        discountAmount,
        now,
      });
      // (6) The choice is spent.
      await clearSelectionIf(tx, consumerId, locked.coupon.id);
      return {
        ...granted,
        // The FINAL balance: the sale's, plus the coupon's extra when there was one.
        balanceAfter: extra?.balanceAfter ?? granted.balanceAfter,
        coupon: {
          label: locked.coupon.labelSnapshot,
          discountAmount,
          extraUnits: extra?.unitsGranted ?? null,
        },
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
