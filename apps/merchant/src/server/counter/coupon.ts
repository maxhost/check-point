import { dispatchGranted } from "../wallet/push";
import {
  CounterError,
  type OperatorBusiness,
  assertLocationInBusiness,
  parseUuid,
  pgErrorCode,
} from "./core";
import {
  type PersistedCoupon,
  assertSameCoupon,
  persistCouponRedemption,
  readCouponByRequest,
} from "./coupon-store";

/**
 * `POST /api/counter/coupon-redeem` (spec 0065 phase C). Same shape as `redeemReward`:
 * parse, scope the location, hand everything to the locked transaction, absorb ONLY the
 * idempotency backstop, dispatch the push best-effort.
 *
 * **Every error is classified explicitly, never by elimination.** An unexpected exception
 * (deadlock, `statement_timeout`, a dropped connection) is rethrown as-is and lands on
 * `counterError`'s 503; it is never re-labelled as a business refusal.
 */

export type CouponRedeemResult = {
  coupon: { label: string; campaignName: string };
};

/** Response allow-list: what the operator has to HAND OVER and which campaign it came
 * from. No coupon id, no consumer id, no membership id, no `client_request_id`. */
function toResult(redemption: PersistedCoupon): CouponRedeemResult {
  return {
    coupon: {
      label: redemption.labelSnapshot,
      campaignName: redemption.campaignName,
    },
  };
}

export async function redeemCoupon(
  business: OperatorBusiness,
  operatorUserId: string,
  raw: Record<string, unknown>,
): Promise<CouponRedeemResult> {
  const clientRequestId = parseUuid(raw.clientRequestId, "clientRequestId");
  const couponId = parseUuid(raw.couponId, "couponId");
  const locationId =
    raw.locationId === null ||
    raw.locationId === undefined ||
    raw.locationId === ""
      ? null
      : await assertLocationInBusiness(
          business.id,
          parseUuid(raw.locationId, "locationId"),
        );

  let redemption: PersistedCoupon;
  try {
    redemption = await persistCouponRedemption({
      businessId: business.id,
      couponId,
      locationId,
      createdByUserId: operatorUserId,
      clientRequestId,
    });
  } catch (error) {
    // Only the idempotency backstop is absorbed. `23505` here can be EITHER unique:
    // `(business_id, client_request_id)` — the legit retry that lost the race — or
    // `coupon_id` — two DIFFERENT requests over the same coupon. They are told apart by
    // whether a row with THIS key exists: if it does not, the collision was on the coupon
    // and the honest answer is `already_redeemed`, not a 503.
    if (pgErrorCode(error) !== "23505") throw error;
    const existing = await readCouponByRequest(business.id, clientRequestId);
    if (!existing)
      throw new CounterError(
        409,
        "already_redeemed",
        "Este cupón ya fue canjeado.",
      );
    assertSameCoupon(existing, couponId);
    // A reread carries no campaign name (the lock is gone); the label is what the
    // operator needs and it is the SNAPSHOT, which is the whole point.
    redemption = { ...existing, campaignName: "", pushQueueId: null };
  }

  // Best-effort inline dispatch (ADR 0037); only fires when THIS call created the row.
  dispatchGranted(redemption.pushQueueId);

  return toResult(redemption);
}
