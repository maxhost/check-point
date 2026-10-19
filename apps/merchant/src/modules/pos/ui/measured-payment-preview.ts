import {
  buildFinancialAmountsFromSnapshots,
  type FinancialAmounts,
} from "@mi-pasaporte/domain/financial";
import {
  formatMinor,
  originalMoney,
  toMinor,
} from "@mi-pasaporte/domain/financial/rational";
import { computeAccrualFromMoney } from "@mi-pasaporte/domain/server/loyalty-program/accrual";
import type { PosOrderV2, PosResolveV2, PosCouponV2 } from "../contracts";
import { decideMeasuredBenefit } from "../measured-benefit";

export type MeasuredPaymentPreview = {
  amounts: FinancialAmounts | null;
  coupon: PosCouponV2 | null;
  targetSourceLineId: string | null;
  error: string | null;
  baseUnits: number | null;
  extraUnits: number;
  change: string | null;
  missing: string | null;
  canConfirm: boolean;
};
export function measuredPaymentPreview(
  order: PosOrderV2,
  resolved: PosResolveV2 | null,
  target: string | null = null,
  excluded = false,
  received: string | null = null,
): MeasuredPaymentPreview {
  const result: MeasuredPaymentPreview = {
    amounts: null,
    coupon: null,
    targetSourceLineId: null,
    error: null,
    baseUnits: null,
    extraUnits: 0,
    change: null,
    missing: null,
    canConfirm: false,
  };
  const fail = (error: string) => ({ ...result, error });
  try {
    if (order.status !== "open" || !order.items.length)
      return fail("Revisa una orden abierta con líneas antes de cobrar.");
    const state = resolved?.couponState;
    const coupon =
      state?.status === "selected" && !excluded ? state.coupon : null;
    if (coupon && state?.status === "selected" && !state.verdict.valid)
      return fail(
        state.verdict.message + " Excluye el beneficio para cobrar sin él.",
      );
    const selected = order.items.find((line) => line.lineId === target);
    const lines = order.items.map((line, position) => ({
      ...line,
      sourceLineId: line.lineId,
      position,
    }));
    const decision = decideMeasuredBenefit({
      currencyCode: order.business.currencyCode,
      lines,
      coupon: coupon
        ? {
            ...coupon,
            productId: coupon.productId ?? selected?.productId ?? null,
            campaignId: coupon.couponId,
            ...(target ? { targetSourceLineId: target } : {}),
          }
        : null,
    });
    if (!decision.ok)
      return fail(
        decision.code === "coupon_measure_not_supported"
          ? "Gratis y 2×1 no aplican a productos por peso"
          : "Revisa la línea del beneficio o exclúyelo de esta venta.",
      );
    result.coupon = coupon;
    result.targetSourceLineId =
      decision.discount?.origin.targetSourceLineId ?? null;
    result.amounts = buildFinancialAmountsFromSnapshots({
      currencyCode: order.business.currencyCode,
      lines,
      discount: decision.discount,
    });
    if (resolved) {
      const { kind, accrual } = resolved.program;
      if (
        !["points", "stamps"].includes(kind) ||
        !["per_amount", "per_purchase"].includes(accrual.mode ?? "") ||
        (kind === "points" && accrual.mode !== "per_amount") ||
        (accrual.mode === "per_purchase" && accrual.blockAmount !== null)
      )
        return fail("Revisa el programa o quita el cliente explícitamente.");
      result.baseUnits = computeAccrualFromMoney(
        {
          mode: accrual.mode as "per_amount" | "per_purchase",
          grant: accrual.grant!,
          blockAmount: accrual.blockAmount,
        },
        result.amounts.collected,
      );
      if (coupon?.kind === "extra_points" || coupon?.kind === "extra_stamps") {
        if (
          (coupon.kind === "extra_points" ? "points" : "stamps") !== kind ||
          !Number.isInteger(coupon.extraUnits) ||
          coupon.extraUnits! < 1
        )
          return fail("Los extras no son compatibles con el programa.");
        result.extraUnits = coupon.extraUnits!;
      }
    }
    if (received !== null) {
      // Partial strings remain in the view; only a complete decimal reaches the kernel.
      const value = received.trim().replace(",", ".");
      if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value))
        return fail("Completa el importe recibido con hasta 2 decimales.");
      const minor = result.amounts.minorUnit;
      const delta =
        toMinor(originalMoney(value), minor) -
        toMinor(originalMoney(result.amounts.collected), minor);
      result.change = formatMinor(delta > 0n ? delta : 0n, minor);
      result.missing = formatMinor(delta < 0n ? -delta : 0n, minor);
      result.canConfirm = delta >= 0n;
    } else result.canConfirm = true;
    return result;
  } catch {
    return fail(
      "No pudimos calcular el cobro. Revisa la orden y el beneficio.",
    );
  }
}
