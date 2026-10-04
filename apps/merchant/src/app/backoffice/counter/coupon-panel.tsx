"use client";

import type { CartLine, CounterCouponState } from "./types";

export function CouponPanel({
  state,
  busy,
  mode,
  cart,
  productId,
  onProductId,
  onValidate,
  onRemove,
}: {
  state: CounterCouponState;
  busy: boolean;
  mode: string;
  cart: CartLine[];
  productId: string | null;
  onProductId: (id: string | null) => void;
  onValidate: () => void;
  onRemove: () => void;
}) {
  if (state.status === "none") return null;
  if (state.status === "hint")
    return (
      <div className="counter-coupon">
        <p>
          Este cliente tiene cupones para tu comercio. Recomiéndale seleccionar
          uno en la app de CheckPass Club.
        </p>
      </div>
    );
  if (state.status === "used_today")
    return (
      <div className="counter-coupon">
        <p>
          Ya usó un cupón hoy en este comercio
          {state.label ? `: ${state.label}` : ""}.
        </p>
      </div>
    );
  const coupon = state.coupon;
  const needsProduct =
    mode === "detailed" &&
    !coupon.productId &&
    (coupon.kind === "free_product" || coupon.kind === "two_for_one");
  const canRemove =
    coupon.kind !== "extra_points" && coupon.kind !== "extra_stamps";
  return (
    <div className="counter-coupon">
      <div>
        <p className="eyebrow">
          {state.status === "validated" ? "Cupón validado" : "Cupón elegido"}
        </p>
        <strong>{coupon.label}</strong>
        {coupon.rule && <span>{coupon.rule}</span>}
        {coupon.kind === "discount" && (
          <span>El descuento se aplica al vender.</span>
        )}
        {needsProduct && cart.length > 0 && (
          <label className="counter-coupon-product">
            Producto de la oferta
            <select
              value={productId ?? ""}
              onChange={(event) => onProductId(event.target.value || null)}
            >
              <option value="">Elige un producto</option>
              {cart.map((line) => (
                <option key={line.productId} value={line.productId}>
                  {line.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="counter-coupon-actions">
        {state.status === "selected" && coupon.kind !== "discount" && (
          <button
            className="counter-primary"
            type="button"
            disabled={busy}
            onClick={onValidate}
          >
            Validar
          </button>
        )}
        {canRemove && (
          <button
            className="counter-secondary"
            type="button"
            disabled={busy}
            onClick={onRemove}
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}
