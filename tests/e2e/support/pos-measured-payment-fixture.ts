import { buildFinancialSettlementFromSnapshots } from "../../../packages/domain/src/financial";
import { decideMeasuredBenefit } from "../../../apps/merchant/src/modules/pos/measured-benefit";
import type {
  PosResolveV2,
  PosOrderV2,
  PosCouponV2,
} from "../../../apps/merchant/src/modules/pos/contracts";
import { editorOrder } from "./pos-measured-editor-fixture";
export const paymentOrder: PosOrderV2 = structuredClone(editorOrder);
export const paymentCoupon: PosCouponV2 = {
  couponId: "coupon",
  label: "Tu beneficio",
  kind: "discount",
  rule: "Presenta tu pase. Condiciones completas: válido en los productos seleccionados y sujeto a disponibilidad del comercio.",
  productId: null,
  productName: null,
  discountUnit: "percent",
  discountValue: "25",
  currencyCode: null,
  extraUnits: null,
  validUntil: "2027-01-01T00:00:00Z",
};
export const paymentResolved: PosResolveV2 = {
  consumer: { displayName: "Ana" },
  membership: {
    id: "membership-a",
    pointsBalance: 0,
    stampsCount: 0,
    justEnrolled: false,
  },
  program: {
    id: "program",
    kind: "points",
    accrual: { mode: "per_amount", grant: 1, blockAmount: "1.00" },
  },
  couponState: {
    status: "selected",
    coupon: paymentCoupon,
    verdict: { valid: true },
  },
};
export const paymentMethods = [
  {
    id: "cash",
    name: "Efectivo",
    isCash: true,
    status: "active" as const,
    chargeShape: "none" as const,
  },
];

/** Canonical DTO from the same exact kernel, without pretending to run a DB close. */
export function paymentClosed(
  order: PosOrderV2,
  body: import("../../../apps/merchant/src/modules/pos/ui/measured-payment-close").MeasuredPaymentBody,
  coupon = paymentCoupon,
): PosOrderV2 {
  const lines = order.items.map((line, position) => ({
    ...line,
    sourceLineId: line.lineId,
    position,
  }));
  const decision = decideMeasuredBenefit({
    currencyCode: order.business.currencyCode,
    lines,
    coupon: body.coupon
      ? {
          ...coupon,
          productId: coupon.productId ?? body.coupon.productId ?? null,
          campaignId: "campaign",
          targetSourceLineId: body.coupon.targetSourceLineId,
        }
      : null,
  });
  if (!decision.ok) throw new Error(decision.code);
  const settlement = buildFinancialSettlementFromSnapshots({
    currencyCode: order.business.currencyCode,
    lines,
    discount: decision.discount,
    payments: body.payments.map((payment, index) => ({
      ...payment,
      paymentId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    })),
  });
  return {
    ...order,
    status: "closed",
    closedAt: "2026-10-18T12:01:00Z",
    closedBy: "operator",
    settlement,
    sale: body.membershipId
      ? {
          consumer: "Ana",
          total: settlement.collected,
          grossTotal: settlement.gross,
          unitsGranted: 0,
          balanceAfter: 0,
          kind: "points",
          coupon: body.coupon
            ? {
                label: coupon.label,
                discountAmount: settlement.discount,
                extraUnits: null,
              }
            : null,
        }
      : null,
  };
}
