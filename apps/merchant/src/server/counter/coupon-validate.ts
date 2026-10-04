import { eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { products } from "@mi-pasaporte/db/schema";
import type { CouponKind } from "@mi-pasaporte/domain/server/marketing/reward-input";
import { dispatchGranted } from "../wallet/push";
import {
  CounterError,
  type OperatorBusiness,
  assertLocationInBusiness,
  parseUuid,
  pgErrorCode,
} from "@mi-pasaporte/domain/server/counter/core";
import {
  assertDailyLimit,
  clearSelectionIf,
  lockBusinessCustomer,
  lockCounterCoupon,
  selectedCouponOf,
} from "./coupon-locks";
import {
  type PersistedCoupon,
  assertCouponRedeemable,
  assertSameCoupon,
  insertCounterRedemption,
  readCouponByRequest,
} from "./coupon-store";
import { grantCouponExtras } from "./coupon-extras";
import { loadCounterMembership } from "./coupon-state";

/**
 * `POST /api/counter/coupon-validate` (spec 0148 / ADR 0119 §6-§7): the counter VALIDATES a
 * 2x1, a free product, a free-text or an extra stamps/points coupon the consumer CHOSE — «Oferta
 * valida» —, usually before the order. It writes the redemption row WITHOUT a sale
 * (`order_id null`): the coupon is «validado», locked for the consumer, and the sale ties it
 * later. A discount is not validated: it applies in the sale.
 *
 * Every error is classified explicitly, never by elimination: an unexpected exception is
 * rethrown as-is and lands on `counterError`'s 503.
 */

export type CouponValidateResult = {
  coupon: {
    label: string;
    kind: CouponKind;
    rule: string | null;
    productName: string | null;
    unitsGranted: number | null;
    balanceAfter: number | null;
  };
};

type Validated = Omit<PersistedCoupon, "pushQueueId"> & {
  pushQueueId: string | null;
  rule: string | null;
  productId: string | null;
};

async function productName(productId: string | null): Promise<string | null> {
  if (productId === null) return null;
  const [row] = await getDb()
    .select({ name: products.name })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  return row?.name ?? null;
}

export async function validateCoupon(
  business: OperatorBusiness,
  operatorUserId: string,
  raw: Record<string, unknown>,
  now: Date = new Date(),
): Promise<CouponValidateResult> {
  const clientRequestId = parseUuid(raw.clientRequestId, "clientRequestId");
  const membershipId = parseUuid(raw.membershipId, "membershipId");
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
  // (1) The membership is of THIS business (else 404) and names the consumer; the coupon has
  // to be of this business AND of that consumer (`lockCounterCoupon`, else 404).
  const membership = await loadCounterMembership(business.id, membershipId);

  let validated: Validated;
  try {
    validated = await withDbTransaction(async (tx) => {
      // (2) Locks in the declared order, then idempotency BEFORE every guard.
      const locked = await lockCounterCoupon(
        tx,
        business.id,
        membership.consumerId,
        couponId,
      );
      await lockBusinessCustomer(tx, business.id, membership.consumerId);
      const extra = {
        rule: locked.coupon.ruleSnapshot,
        productId: locked.coupon.productId,
      };
      const previous = await readCouponByRequest(
        business.id,
        clientRequestId,
        tx,
      );
      if (previous) {
        assertSameCoupon(previous, couponId);
        return { ...previous, ...extra, pushQueueId: null };
      }
      // (3) A discount applies in the sale (ADR 0119 §6).
      if (locked.coupon.kindSnapshot === "discount")
        throw new CounterError(
          409,
          "coupon_applies_in_sale",
          "Este cupón es un descuento: se aplica al cobrar la venta.",
        );
      // (4) The consumer chose it: the counter does not activate coupons (ADR 0119 §3).
      if ((await selectedCouponOf(tx, membership.consumerId)) !== couponId)
        throw new CounterError(
          409,
          "coupon_not_selected",
          "El cliente no eligió este cupón en su app.",
        );
      // (5) Validity, already redeemed, cap — then one coupon per consumer + business + day.
      await assertCouponRedeemable(tx, locked, now);
      await assertDailyLimit(tx, business.id, membership.consumerId, now);
      // (6) Spec 0136: whose membership — the coupon's, or (a cross coupon of a non-member)
      // the scanned one. Spec 0106: an `extra_*` coupon credits the program HERE, and is
      // consumed by it (it cannot be removed afterwards).
      const redemptionMembership = locked.coupon.membershipId ?? membership.id;
      const grant = await grantCouponExtras(tx, {
        businessId: business.id,
        membershipId: redemptionMembership,
        kindSnapshot: locked.coupon.kindSnapshot,
        extraUnitsSnapshot: locked.coupon.extraUnitsSnapshot,
      });
      const row = await insertCounterRedemption(tx, {
        locked,
        businessId: business.id,
        membershipId: redemptionMembership,
        locationId,
        createdByUserId: operatorUserId,
        clientRequestId,
        grant,
        orderId: null,
        discountAmount: null,
        push: true,
        now,
      });
      // (7) The choice is spent.
      await clearSelectionIf(tx, membership.consumerId, couponId);
      return { ...row, ...extra };
    });
  } catch (error) {
    // Only the idempotency backstop is absorbed. `23505` can be the
    // `(business_id, client_request_id)` unique — the retry that lost the race — or
    // `coupon_id` — two DIFFERENT requests over the same coupon: told apart by whether a row
    // with THIS key exists.
    if (pgErrorCode(error) !== "23505") throw error;
    const existing = await readCouponByRequest(business.id, clientRequestId);
    if (!existing)
      throw new CounterError(
        409,
        "already_redeemed",
        "Este cupón ya fue canjeado.",
      );
    assertSameCoupon(existing, couponId);
    validated = { ...existing, pushQueueId: null, rule: null, productId: null };
  }

  // Best-effort inline dispatch (ADR 0037); only when THIS call created the row.
  dispatchGranted(validated.pushQueueId);
  return {
    coupon: {
      label: validated.labelSnapshot,
      kind: validated.kindSnapshot,
      rule: validated.rule,
      productName: await productName(validated.productId),
      unitsGranted: validated.unitsGranted,
      balanceAfter: validated.balanceAfter,
    },
  };
}
