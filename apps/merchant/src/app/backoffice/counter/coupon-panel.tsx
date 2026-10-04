"use client";

import type { CartLine, CounterCouponState } from "./types";

export function CouponPanel({
  state,
  busy,
  mode,
  cart,
  productId,
  onProductId,
  onRemove,
}: {
  state: CounterCouponState;
  busy: boolean;
  mode: string;
  cart: CartLine[];
  productId: string | null;
  onProductId: (id: string | null) => void;
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
    state.verdict.valid &&
    mode === "detailed" &&
    !coupon.productId &&
    (coupon.kind === "free_product" || coupon.kind === "two_for_one");
  return (
    <div className="counter-coupon" data-valid={state.verdict.valid}>
      <div>
        <p className="counter-coupon-verdict">
          <span aria-hidden="true">{state.verdict.valid ? "✓" : "✗"}</span>
          {state.verdict.valid ? "Cupón válido" : "Cupón no válido"}
        </p>
        <strong>{coupon.label}</strong>
        {!state.verdict.valid && (
          <span className="counter-coupon-reason" role="status">
            {state.verdict.message}
          </span>
        )}
        {coupon.rule && <span>{coupon.rule}</span>}
        {state.verdict.valid && coupon.kind === "discount" && (
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
        <button
          className="counter-secondary"
          type="button"
          disabled={busy}
          onClick={onRemove}
        >
          Quitar
        </button>
      </div>
    </div>
  );
}
