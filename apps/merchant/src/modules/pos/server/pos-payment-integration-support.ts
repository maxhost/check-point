import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { campaignCoupons, posOrders } from "@mi-pasaporte/db/schema";
import {
  minorUnitForCurrency,
  normalizeMoney,
} from "@mi-pasaporte/domain/financial";
import { formatDecimal, fromDb } from "../../decimal";
import { decideCouponDiscount } from "../../../server/counter/coupon-discount";
import { callModuleRoute } from "../../modules-integration-support";
import { pos, scopedPos } from "./pos-integration-support";

/** Explicit fixture adapter for pre-P1 positive-close oracles. The raw pos.close
 * stays unchanged for validation tests: production never supplies a missing payment. */
export async function closeWithCash(
  cookie: string,
  id: string,
  body: Record<string, unknown>,
  options?: { scope: string },
) {
  const caller = options
    ? scopedPos(cookie, options.scope)
    : {
        read: (id: string) => pos.read(cookie, id),
        close: (id: string, value: unknown) => pos.close(cookie, id, value),
        paymentMethods: () =>
          callModuleRoute("GET", "/api/modules/pos/payment-methods", cookie),
      };
  if (body.payments !== undefined) return caller.close(id, body);
  const read = await caller.read(id);
  if (read.status !== 200) return caller.close(id, body);
  const order = await read.json();
  const methodsResponse = await caller.paymentMethods();
  if (methodsResponse.status !== 200) return caller.close(id, body);
  const methods = await methodsResponse.json();
  let cents = fromDb(order.total, 2);
  const couponId = (body.coupon as { couponId?: string } | undefined)?.couponId;
  if (couponId && body.membershipId) {
    const [source] = await getDb()
      .select({ businessId: posOrders.businessId })
      .from(posOrders)
      .where(eq(posOrders.id, id));
    const [coupon] = await getDb()
      .select()
      .from(campaignCoupons)
      .where(
        and(
          eq(campaignCoupons.businessId, source.businessId),
          eq(campaignCoupons.id, couponId),
        ),
      );
    if (coupon) {
      const decision = decideCouponDiscount({
        kind: coupon.kindSnapshot,
        discountUnit: coupon.discountUnitSnapshot as
          "percent" | "amount" | null,
        discountValue: coupon.discountValueSnapshot,
        currencyCode: coupon.currencyCodeSnapshot,
        businessCurrency: order.business.currencyCode,
        mode: "detailed",
        items: order.items,
        totalCents: Number(cents),
        productId:
          coupon.productId ??
          (body.coupon as { productId?: string }).productId ??
          null,
      });
      if (decision.ok) cents -= BigInt(decision.discountCents);
    }
  }
  const amount = normalizeMoney(
    formatDecimal(cents, 2),
    minorUnitForCurrency(order.business.currencyCode),
  );
  return caller.close(id, {
    ...body,
    payments:
      fromDb(amount, 2) === 0n
        ? []
        : [{ methodId: methods.defaultMethodId, amount }],
  });
}
