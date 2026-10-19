import type { OperatorBusiness } from "@mi-pasaporte/domain/server/counter/core";
import { resolveScanContext } from "../../../server/counter/resolve-context";
import {
  counterCouponState,
  type CounterCouponState,
} from "../../../server/counter/coupon-state";
import type { PosCouponStateV2, PosResolveV2 } from "../contracts";

/** Explicit wire allow-list, including the selected coupon's existing verdict and prose. */
function couponDTO(state: CounterCouponState): PosCouponStateV2 {
  switch (state.status) {
    case "selected": {
      const coupon = state.coupon;
      return {
        status: "selected",
        coupon: {
          couponId: coupon.couponId,
          label: coupon.label,
          kind: coupon.kind,
          rule: coupon.rule,
          productId: coupon.productId,
          productName: coupon.productName,
          discountUnit: coupon.discountUnit,
          discountValue: coupon.discountValue,
          currencyCode: coupon.currencyCode,
          extraUnits: coupon.extraUnits,
          validUntil: coupon.validUntil.toISOString(),
        },
        verdict: state.verdict.valid
          ? { valid: true }
          : {
              valid: false,
              code: state.verdict.code,
              message: state.verdict.message,
            },
      };
    }
    case "used_today":
      return { status: "used_today", label: state.label };
    case "hint":
      return { status: "hint", count: state.count };
    case "none":
      return { status: "none" };
  }
}

/** Scan context only. The V2 HTTP route is assembled separately. */
export async function resolveMeasuredScan(
  business: OperatorBusiness,
  qrToken: string,
  selectedLocationId?: string | null,
): Promise<PosResolveV2> {
  const context = await resolveScanContext(
    business,
    qrToken,
    selectedLocationId,
  );
  const { membership, program } = context;
  return {
    consumer: { displayName: context.displayName },
    membership: {
      id: membership.id,
      pointsBalance: membership.pointsBalance,
      stampsCount: membership.stampsCount,
      justEnrolled: membership.justEnrolled,
    },
    program: {
      id: program.id,
      kind: program.kind,
      accrual: {
        mode: program.accrualMode,
        grant: program.accrualGrant,
        blockAmount: program.accrualBlockAmount,
      },
    },
    couponState: couponDTO(
      await counterCouponState(business.id, context.consumerId),
    ),
  };
}
