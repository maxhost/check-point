import { withDbTransaction } from "@mi-pasaporte/db";
import {
  CounterError,
  type OperatorBusiness,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import {
  clearSelectionIf,
  lockBusinessCustomer,
  lockCounterCoupon,
  selectedCouponOf,
} from "./coupon-locks";
import { loadCounterMembership } from "./coupon-state";

/**
 * `POST /api/counter/coupon-remove` (spec 0148 / ADR 0119 §10; spec 0153 / ADR 0120 §4): the
 * counter TAKES BACK the coupon the consumer CHOSE — valid or not («tenias que consumir 10 y
 * consumiste 8», or it is shown red) — and the consumer gets it back for another time,
 * while its own validity lasts. Under the same locks as the sale: if it is the consumer's
 * current choice, the choice is cleared; anything else (not chosen, chosen another, already
 * tied to a sale — the sale spent the choice) is 409 `coupon_not_removable`.
 *
 * No push (spec 0148, «No entra»).
 */

export type CouponRemoveResult = { removed: "selected" };

const NOT_REMOVABLE = "Este cupón ya no se puede quitar.";

export async function removeCoupon(
  business: OperatorBusiness,
  raw: Record<string, unknown>,
): Promise<CouponRemoveResult> {
  const membershipId = parseUuid(raw.membershipId, "membershipId");
  const couponId = parseUuid(raw.couponId, "couponId");
  const membership = await loadCounterMembership(business.id, membershipId);
  const consumerId = membership.consumerId;

  return withDbTransaction(async (tx) => {
    await lockCounterCoupon(tx, business.id, consumerId, couponId);
    await lockBusinessCustomer(tx, business.id, consumerId);
    if ((await selectedCouponOf(tx, consumerId)) !== couponId)
      throw new CounterError(409, "coupon_not_removable", NOT_REMOVABLE);
    await clearSelectionIf(tx, consumerId, couponId);
    return { removed: "selected" };
  });
}
