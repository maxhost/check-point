import {
  buildFinancialAmountsFromSnapshots,
  FinancialError,
  type FinancialDiscountV2,
  type FinancialInputV2,
} from "@mi-pasaporte/domain/financial";
import {
  exact,
  fromExact,
  multiply,
  originalMoney,
  rational,
  subtract,
} from "@mi-pasaporte/domain/financial/rational";
import {
  assertMoneyRange,
  exactSnapshotLineGross,
} from "@mi-pasaporte/domain/measures";
import {
  selectProductCouponLine,
  type PosCouponV2,
  type ProductCouponTarget,
} from "./contracts";

/** Server-authorized coupon metadata, not a close body or an eligibility verdict.
 * Product selection has already resolved the coupon's product or operator choice.
 * Dates, selection, limits, consumption and program extras still require server locks.
 */
export type AuthorizedMeasuredCoupon = Pick<
  PosCouponV2,
  | "couponId"
  | "kind"
  | "productId"
  | "discountUnit"
  | "discountValue"
  | "currencyCode"
> & { campaignId: string; targetSourceLineId?: string };
export type MeasuredBenefitLine = FinancialInputV2["lines"][number] & {
  productId: string | null;
};
export type MeasuredBenefitDecision =
  | { ok: true; discount: FinancialDiscountV2 | null }
  | Exclude<ProductCouponTarget, { ok: true }>
  | { ok: false; status: 409; code: "coupon_currency_mismatch" };

/** Pure shared preview/future-close decision. The caller supplies stable snapshot
 * order. Null explicitly excludes the benefit from this sale only.
 */
export function decideMeasuredBenefit(input: {
  currencyCode: string;
  lines: readonly MeasuredBenefitLine[];
  coupon: AuthorizedMeasuredCoupon | null;
}): MeasuredBenefitDecision {
  const base = buildFinancialAmountsFromSnapshots({ ...input, discount: null });
  const coupon = input.coupon;
  if (!coupon) return { ok: true, discount: null };
  if (!coupon.couponId || !coupon.campaignId)
    throw new FinancialError("invalid_financial_input");
  const origin = {
    type: "campaign_coupon" as const,
    sourceId: coupon.couponId,
    campaignId: coupon.campaignId,
    benefitKind: coupon.kind,
    scope: "order" as const,
  };
  if (
    coupon.kind === "custom" ||
    coupon.kind === "extra_stamps" ||
    coupon.kind === "extra_points"
  )
    return { ok: true, discount: null };
  if (coupon.kind === "discount") {
    const gross = fromExact(base.originals.gross);
    let amount;
    if (coupon.discountUnit === "percent") {
      if (
        typeof coupon.discountValue !== "string" ||
        !/^(?:[1-9]|[1-9]\d|100)$/.test(coupon.discountValue)
      )
        throw new FinancialError("invalid_financial_input");
      amount = multiply(gross, rational(BigInt(coupon.discountValue), 100n));
    } else if (coupon.discountUnit === "amount") {
      if (
        coupon.currencyCode !== null &&
        coupon.currencyCode !== input.currencyCode
      )
        return { ok: false, status: 409, code: "coupon_currency_mismatch" };
      const fixed = originalMoney(coupon.discountValue!);
      assertMoneyRange(fixed);
      amount = subtract(fixed, gross).n > 0n ? gross : fixed;
    } else throw new FinancialError("invalid_financial_input");
    return { ok: true, discount: { originalAmount: exact(amount), origin } };
  }
  if (coupon.kind !== "free_product" && coupon.kind !== "two_for_one")
    throw new FinancialError("invalid_financial_input");
  const target = selectProductCouponLine(
    coupon.kind,
    input.lines.map((line) => ({ ...line, lineId: line.sourceLineId })),
    coupon.productId,
    coupon.targetSourceLineId,
  );
  if (!target.ok) return target;
  const line = input.lines.find(
    (line) => line.sourceLineId === target.targetSourceLineId,
  )!;
  return {
    ok: true,
    discount: {
      originalAmount: exactSnapshotLineGross("1", line.unitPrice, line.measure),
      origin: {
        ...origin,
        scope: "line",
        targetSourceLineId: line.sourceLineId,
      },
    },
  };
}
