import {
  formatMoney,
  previewUnits,
  unitLabel,
  type ResolveResponse,
  type CounterCoupon,
} from "../counter/types";
import type { PosOrder } from "./pos-types";

export type PaymentPreview = {
  grossCents: number | null;
  discountCents: number;
  netCents: number | null;
  coupon: CounterCoupon | null;
  error: string | null;
  canConfirm: boolean;
  changeCents: number | null;
  missingCents: number | null;
  rule: string | null;
  baseUnits: number | null;
  extraUnits: number;
  kind: string | null;
};
/** Decimal money from saved snapshots, never from the current catalogue. */
export function moneyCents(value: string | number): number | null {
  if (typeof value === "string" && !/^\d+(?:\.\d{1,2})?$/.test(value))
    return null;
  const number = Number(value);
  const cents = Math.round(number * 100);
  return Number.isFinite(number) &&
    number >= 0 &&
    Number.isSafeInteger(cents) &&
    Math.abs(number * 100 - cents) < 0.000001
    ? cents
    : null;
}
export function paymentPreview(
  order: PosOrder,
  resolved: ResolveResponse | null,
  productId: string | null = null,
  excludedId: string | null = null,
  received: number | null = null,
): PaymentPreview {
  const gross = moneyCents(order.total);
  const output: PaymentPreview = {
    grossCents: gross,
    discountCents: 0,
    netCents: gross,
    coupon: null,
    error: null,
    canConfirm: false,
    changeCents: null,
    missingCents: null,
    rule: null,
    baseUnits: null,
    extraUnits: 0,
    kind: null,
  };
  const fail = (message: string) => {
    output.error = message;
    return output;
  };
  if (
    gross === null ||
    !order.items.length ||
    !/^[A-Z]{3}$/.test(order.business.currencyCode)
  )
    return fail("No pudimos calcular el importe guardado. Revisa la orden.");
  for (const line of order.items) {
    if (
      moneyCents(line.unitPrice) === null ||
      moneyCents(line.lineTotal) === null ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1
    )
      return fail("Hay un precio o cantidad no válido. Revisa la orden.");
  }
  const state = resolved?.couponState;
  if (state?.status === "selected" && state.coupon.couponId !== excludedId) {
    if (!state.verdict.valid)
      return fail(
        state.verdict.message + " Excluye el beneficio para cobrar sin él.",
      );
    const coupon = state.coupon;
    output.coupon = coupon;
    if (coupon.kind === "discount") {
      const value = Number(coupon.discountValue);
      if (coupon.discountValue === null || !Number.isFinite(value) || value < 0)
        return fail("El descuento no es válido.");
      if (coupon.discountUnit === "percent") {
        if (!Number.isInteger(value) || value < 1 || value > 100)
          return fail("El porcentaje del cupón no es válido.");
        output.discountCents = Math.floor((gross * value + 50) / 100);
      } else if (coupon.discountUnit === "amount") {
        const cents = moneyCents(coupon.discountValue);
        if (cents === null) return fail("El importe del cupón no es válido.");
        if (
          coupon.currencyCode !== null &&
          coupon.currencyCode !== order.business.currencyCode
        )
          return fail("El cupón está en otra moneda que la de tu comercio.");
        output.discountCents = Math.min(cents, gross);
      } else return fail("El descuento no es válido.");
    } else if (
      coupon.kind === "free_product" ||
      coupon.kind === "two_for_one"
    ) {
      const effectiveProductId = coupon.productId ?? productId;
      const line = effectiveProductId
        ? order.items.find((item) => item.productId === effectiveProductId)
        : undefined;
      if (!line)
        return fail(
          "Elige un producto presente en la orden o excluye el beneficio.",
        );
      if (coupon.kind === "two_for_one" && line.quantity < 2)
        return fail(
          "El 2x1 necesita al menos 2 unidades en la primera línea del producto.",
        );
      output.discountCents = moneyCents(line.unitPrice)!;
    } else if (
      coupon.kind === "extra_stamps" ||
      coupon.kind === "extra_points"
    ) {
      const kind = coupon.kind === "extra_stamps" ? "stamps" : "points";
      if (
        resolved?.program.kind !== kind ||
        !Number.isInteger(coupon.extraUnits) ||
        (coupon.extraUnits ?? 0) < 1
      )
        return fail("Los extras del cupón no son compatibles con el programa.");
      output.extraUnits = coupon.extraUnits!;
    } else if (coupon.kind !== "custom")
      return fail("El beneficio no es válido.");
  }
  output.netCents = Math.max(0, gross - output.discountCents);
  if (resolved) {
    const { kind, accrual } = resolved.program;
    if (
      !["points", "stamps"].includes(kind) ||
      !accrual ||
      !Number.isInteger(accrual.grant) ||
      (accrual.grant ?? 0) < 1 ||
      !["per_purchase", "per_amount"].includes(accrual.mode ?? "") ||
      (kind === "points" && accrual.mode !== "per_amount") ||
      (accrual.mode === "per_purchase" && accrual.blockAmount != null) ||
      (accrual.mode === "per_amount" &&
        (typeof accrual.blockAmount !== "number" ||
          !Number.isFinite(accrual.blockAmount) ||
          accrual.blockAmount <= 0))
    )
      return fail(
        "No pudimos calcular la acreditación. Vuelve a escanear el pase o quita el cliente.",
      );
    output.kind = kind;
    output.baseUnits = previewUnits(accrual, output.netCents / 100);
    output.rule = `${accrual.grant} ${unitLabel(kind, accrual.grant!)} ${accrual.mode === "per_purchase" ? "por compra" : `por cada ${formatMoney(accrual.blockAmount!, order.business.currencyCode)}`}`;
  }
  if (received !== null) {
    const cents = moneyCents(received);
    if (cents === null)
      return fail(
        "Recibido debe ser un importe no negativo con hasta 2 decimales.",
      );
    output.changeCents = Math.max(0, cents - output.netCents);
    output.missingCents = Math.max(0, output.netCents - cents);
  }
  output.canConfirm = !output.missingCents;
  return output;
}
