"use client";
import { useSyncExternalStore } from "react";
import { Alert, Button, SelectField, Text } from "../../../ui";
import type { MeasuredPaymentSession } from "./measured-payment-session";
export function MeasuredCoupon({
  session,
}: {
  session: MeasuredPaymentSession;
}) {
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const couponState = state.resolved?.couponState;
  if (!couponState || couponState.status === "none") return null;
  if (couponState.status === "hint")
    return (
      <Alert title="Este cliente tiene cupones">
        Pídele seleccionar uno en CheckPass Club.
      </Alert>
    );
  if (couponState.status === "used_today")
    return <Alert title="Ya usó un cupón hoy">{couponState.label}</Alert>;
  const { coupon, verdict } = couponState;
  if (state.excluded)
    return (
      <Text variant="muted">
        Beneficio excluido de esta venta: {coupon.label}
      </Text>
    );
  return (
    <div className="grid gap-3">
      <Alert kind={verdict.valid ? "success" : "error"} title={coupon.label}>
        <Text>
          {
            {
              discount: "Descuento",
              free_product: "Producto gratis",
              two_for_one: "2×1",
              custom: "Beneficio especial",
              extra_points: "Puntos extra",
              extra_stamps: "Sellos extra",
            }[coupon.kind]
          }
        </Text>
        {coupon.kind === "discount" && (
          <Text>
            {coupon.discountValue}
            {coupon.discountUnit === "percent"
              ? "%"
              : ` ${coupon.currencyCode ?? state.order.business.currencyCode}`}
          </Text>
        )}
        {coupon.extraUnits !== null && <Text>Extras: {coupon.extraUnits}</Text>}
        {coupon.rule && <Text>{coupon.rule}</Text>}
        {!verdict.valid && <Text>{verdict.message}</Text>}
      </Alert>
      {["free_product", "two_for_one"].includes(coupon.kind) && (
        <SelectField
          label="Línea del beneficio"
          options={state.order.items
            .filter(
              (line) =>
                !coupon.productId || line.productId === coupon.productId,
            )
            .map((line) => ({
              id: line.lineId,
              label: `${line.name} · ${line.quantity} ${line.measure.quantityUnit === "unit" ? "unidades" : line.measure.quantityUnit} · ${line.unitPrice}/${line.measure.priceUnit === "unit" ? "unidad" : line.measure.priceUnit}`,
            }))}
          selectedKey={state.target}
          onSelectionChange={(key) =>
            session.selectTarget(key ? String(key) : null)
          }
          isDisabled={session.busy}
        />
      )}
      <Button
        variant="secondary"
        onPress={() => session.excludeBenefit()}
        isDisabled={session.busy}
      >
        Quitar beneficio de esta venta
      </Button>
    </div>
  );
}
