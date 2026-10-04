import { eq, sql } from "drizzle-orm";
import { withDbTransaction } from "@mi-pasaporte/db";
import { campaignTurns, couponRedemptions } from "@mi-pasaporte/db/schema";
import {
  CounterError,
  type OperatorBusiness,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import {
  clearSelectionIf,
  createdToday,
  lockBusinessCustomer,
  lockCounterCoupon,
  selectedCouponOf,
} from "./coupon-locks";
import { loadCounterMembership } from "./coupon-state";

/**
 * `POST /api/counter/coupon-remove` (spec 0148 / ADR 0119 §10): the counter TAKES BACK a
 * coupon that does not meet its rules («tenias que consumir 10 y consumiste 8»), and the
 * consumer gets it back for another time — while its own validity lasts.
 *
 *  - VALIDATED (a row of today, `order_id null`, not `extra_*`): under the same locks as
 *    validate, the turn that points at it loses its outcome and the row is DELETED — back to
 *    «disponible», which frees the campaign's cap and the day's limit;
 *  - CHOSEN (no row, it is the consumer's choice): the choice is cleared;
 *  - anything else — tied to a sale, of another day, `extra_*` (the credit was made), not
 *    chosen — is 409 `coupon_not_removable`.
 *
 * No push (spec 0148, «No entra»): the validation's receipt already went out.
 */

export type CouponRemoveResult = { removed: "validated" | "selected" };

const NOT_REMOVABLE = "Este cupón ya no se puede quitar.";

export async function removeCoupon(
  business: OperatorBusiness,
  raw: Record<string, unknown>,
  now: Date = new Date(),
): Promise<CouponRemoveResult> {
  const membershipId = parseUuid(raw.membershipId, "membershipId");
  const couponId = parseUuid(raw.couponId, "couponId");
  const membership = await loadCounterMembership(business.id, membershipId);
  const consumerId = membership.consumerId;

  return withDbTransaction(async (tx) => {
    await lockCounterCoupon(tx, business.id, consumerId, couponId);
    await lockBusinessCustomer(tx, business.id, consumerId);
    const result = await tx.execute<{
      id: string;
      order_id: string | null;
      kind_snapshot: string;
      today: boolean;
    }>(sql`
      select cr.id, cr.order_id, cr.kind_snapshot, ${createdToday(now)} as today
      from core.coupon_redemption cr
      join core.business b on b.id = cr.business_id
      where cr.coupon_id = ${couponId} and cr.business_id = ${business.id}
    `);
    const [row] = result.rows;
    if (row) {
      const removable =
        row.order_id === null &&
        row.today === true &&
        row.kind_snapshot !== "extra_stamps" &&
        row.kind_snapshot !== "extra_points";
      if (!removable)
        throw new CounterError(409, "coupon_not_removable", NOT_REMOVABLE);
      await tx
        .update(campaignTurns)
        .set({ outcome: null, outcomeRedemptionId: null, outcomeAt: null })
        .where(eq(campaignTurns.outcomeRedemptionId, row.id));
      await tx
        .delete(couponRedemptions)
        .where(eq(couponRedemptions.id, row.id));
      await clearSelectionIf(tx, consumerId, couponId);
      return { removed: "validated" };
    }
    if ((await selectedCouponOf(tx, consumerId)) !== couponId)
      throw new CounterError(409, "coupon_not_removable", NOT_REMOVABLE);
    await clearSelectionIf(tx, consumerId, couponId);
    return { removed: "selected" };
  });
}
