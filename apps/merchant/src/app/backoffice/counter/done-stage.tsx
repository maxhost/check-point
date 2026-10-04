"use client";

import { RedeemDone } from "./redeem-panel";
import {
  formatMoney,
  unitLabel,
  type GrantResponse,
  type RedeemResponse,
} from "./types";

export function DoneStage({
  result,
  redeemed,
  displayName,
  currencyCode,
  couponKind,
  onNext,
}: {
  result: GrantResponse | null;
  redeemed: RedeemResponse | null;
  displayName: string;
  currencyCode: string;
  couponKind?: string;
  onNext: () => void;
}) {
  if (redeemed)
    return (
      <RedeemDone
        redeemed={redeemed}
        displayName={displayName}
        onNext={onNext}
      />
    );
  if (!result) return null;
  return (
    <section className="counter-panel counter-done">
      <p className="counter-check" aria-hidden>
        ✓
      </p>
      <h2>¡Listo!</h2>
      <p className="counter-granted">
        +{result.order.unitsGranted}{" "}
        {unitLabel(result.order.kind, result.order.unitsGranted)} para{" "}
        {displayName}
      </p>
      <p className="counter-balance">
        Saldo: {result.order.balanceAfter}{" "}
        {unitLabel(result.order.kind, result.order.balanceAfter)}
      </p>
      <div className="counter-ticket">
        <p>
          Subtotal{" "}
          <strong>
            {formatMoney(Number(result.order.grossTotal), currencyCode)}
          </strong>
        </p>
        {result.order.coupon && (
          <p>
            {result.order.coupon.label}
            {couponKind === "two_for_one" || couponKind === "free_product"
              ? " · 1 unidad bonificada"
              : ""}{" "}
            <strong>
              −
              {formatMoney(
                Number(result.order.coupon.discountAmount),
                currencyCode,
              )}
            </strong>
          </p>
        )}
        <p className="counter-ticket-total">
          Total{" "}
          <strong>
            {formatMoney(Number(result.order.total), currencyCode)}
          </strong>
        </p>
      </div>
      <button type="button" className="counter-primary" onClick={onNext}>
        Escanear siguiente
      </button>
    </section>
  );
}
