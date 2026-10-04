"use client";

import type { ReactNode } from "react";
import { ModuleHeader, Toast } from "../../components/ui";
import { DetailedSale, QuickSale } from "./sale-forms";
import { RedeemPanel } from "./redeem-panel";
import { CouponPanel } from "./coupon-panel";
import { PointsPreview } from "./points-preview";
export { LocationGate } from "./location-gate";
import {
  type CartLine,
  type CounterProduct,
  type Mode,
  type ResolveResponse,
  balanceFor,
  cartTotal,
  formatMoney,
  previewNetTotal,
  unitLabel,
} from "./types";

/** The three actions of a resolved scan: two sales (spec 0030) and the redemption
 * (spec 0055). Rendered from a list so a fourth one never means a fourth copy. */
const MODE_TABS: { id: Mode; label: string }[] = [
  { id: "detailed", label: "Venta detallada" },
  { id: "quick", label: "Venta rápida" },
  { id: "redeem", label: "Canjear" },
];

/** Shell + header + toasts, shared by every stage. */
export function Console({
  children,
  error,
  onDismissError,
  notice,
  onDismissNotice,
}: {
  children: ReactNode;
  error: string | null;
  onDismissError: () => void;
  notice?: string | null;
  onDismissNotice?: () => void;
}) {
  return (
    <main className="merchant-shell counter-shell">
      <ModuleHeader
        eyebrow="Mostrador"
        title="Acreditar puntos"
        description="Escanea el QR del cliente y suma su compra."
        closeHref="/backoffice"
      />
      {children}
      {notice && onDismissNotice && (
        <Toast kind="success" message={notice} onDismiss={onDismissNotice} />
      )}
      {error && (
        <Toast kind="error" message={error} onDismiss={onDismissError} />
      )}
    </main>
  );
}

export function ResolvedStage({
  resolved,
  currencyCode,
  mode,
  setMode,
  cart,
  onAdd,
  onQty,
  onLinePrice,
  onRepeat,
  quick,
  selectedRewardId,
  onSelectReward,
  couponProductId,
  onCouponProductId,
  onValidateCoupon,
  onRemoveCoupon,
  busy,
  canConfirm,
  onConfirm,
  onCancel,
}: {
  resolved: ResolveResponse;
  currencyCode: string;
  mode: Mode;
  setMode: (m: Mode) => void;
  cart: CartLine[];
  onAdd: (p: CounterProduct) => void;
  onQty: (id: string, delta: number) => void;
  onLinePrice: (id: string, value: number) => void;
  onRepeat: () => void;
  quick: {
    amount: string;
    onAmount: (v: string) => void;
    note: string;
    onNote: (v: string) => void;
  };
  selectedRewardId: string | null;
  onSelectReward: (rewardId: string) => void;
  couponProductId: string | null;
  onCouponProductId: (id: string | null) => void;
  onValidateCoupon: () => void;
  onRemoveCoupon: () => void;
  busy: boolean;
  canConfirm: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const balance = balanceFor(resolved.program.kind, resolved.membership);
  return (
    <section
      className={`counter-panel ${mode === "detailed" ? "counter-panel-detailed" : ""}`}
    >
      <header className="counter-consumer">
        <h2>{resolved.consumer.displayName}</h2>
        {resolved.membership.justEnrolled ? (
          <span className="counter-badge">Nuevo · recién enrolado</span>
        ) : (
          <span className="counter-balance">
            {balance} {unitLabel(resolved.program.kind, balance)}
          </span>
        )}
      </header>

      <CouponPanel
        state={resolved.couponState}
        busy={busy}
        mode={mode}
        cart={cart}
        productId={couponProductId}
        onProductId={onCouponProductId}
        onValidate={onValidateCoupon}
        onRemove={onRemoveCoupon}
      />

      <div className="counter-toggle" role="tablist">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            className={mode === tab.id ? "is-active" : ""}
            onClick={() => setMode(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "redeem" ? (
        <RedeemPanel
          resolved={resolved}
          selectedRewardId={selectedRewardId}
          onSelect={onSelectReward}
        />
      ) : mode === "detailed" ? (
        <DetailedSale
          products={resolved.catalog.products}
          categories={resolved.catalog.categories}
          habitualProductIds={resolved.catalog.habitualProductIds}
          lastPurchase={resolved.catalog.lastPurchase}
          currencyCode={currencyCode}
          cart={cart}
          onAdd={onAdd}
          onQty={onQty}
          onLinePrice={onLinePrice}
          onRepeat={onRepeat}
        />
      ) : (
        <QuickSale
          amount={quick.amount}
          onAmount={quick.onAmount}
          note={quick.note}
          onNote={quick.onNote}
          currencyCode={currencyCode}
        />
      )}

      {mode === "quick" && (
        <PointsPreview
          accrual={resolved.program.accrual}
          kind={resolved.program.kind}
          total={previewNetTotal(
            Number(quick.amount) || 0,
            resolved.couponState,
            [],
            null,
          )}
        />
      )}

      {mode === "detailed" ? (
        <div className="counter-detailed-footer">
          <details className="counter-summary">
            <summary>
              <span>
                {cart.reduce((sum, line) => sum + line.quantity, 0)} artículos ·{" "}
                {formatMoney(
                  previewNetTotal(
                    cartTotal(cart),
                    resolved.couponState,
                    cart,
                    couponProductId,
                  ),
                  currencyCode,
                )}
              </span>
              <small>Ver detalle</small>
            </summary>
            <ul>
              {cart.map((line) => (
                <li key={line.productId}>
                  {line.quantity} × {line.name}{" "}
                  <strong>
                    {formatMoney(line.quantity * line.unitPrice, currencyCode)}
                  </strong>
                </li>
              ))}
            </ul>
            <p>
              Total registrado en CheckPass ·{" "}
              {formatMoney(
                previewNetTotal(
                  cartTotal(cart),
                  resolved.couponState,
                  cart,
                  couponProductId,
                ),
                currencyCode,
              )}
            </p>
          </details>
          <PointsPreview
            accrual={resolved.program.accrual}
            kind={resolved.program.kind}
            total={previewNetTotal(
              cartTotal(cart),
              resolved.couponState,
              cart,
              couponProductId,
            )}
          />
          <div className="counter-actions">
            <button
              type="button"
              className="counter-secondary"
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="counter-primary"
              disabled={!canConfirm}
              onClick={onConfirm}
            >
              {busy ? "Acreditando…" : "Acreditar compra"}
            </button>
          </div>
        </div>
      ) : (
        <div className="counter-actions">
          <button
            type="button"
            className="counter-secondary"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="counter-primary"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {busy
              ? mode === "redeem"
                ? "Canjeando…"
                : "Acreditando…"
              : "Confirmar"}
          </button>
        </div>
      )}
    </section>
  );
}
