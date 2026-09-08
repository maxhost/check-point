"use client";

import type { ReactNode } from "react";
import { ModuleHeader, Toast } from "../../components/ui";
import { DetailedSale, QuickSale } from "./sale-forms";
import { RedeemDone, RedeemPanel } from "./redeem-panel";
import {
  type CartLine,
  type CounterLocation,
  type CounterProduct,
  type GrantResponse,
  type Mode,
  type RedeemResponse,
  type ResolveResponse,
  balanceFor,
  cartTotal,
  previewUnits,
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
        description="Escaneá el QR del cliente y sumá su compra."
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

/** Location gate shown before scanning when the business has >1 location. */
export function LocationGate({
  locations,
  onPick,
}: {
  locations: CounterLocation[];
  onPick: (id: string) => void;
}) {
  return (
    <section className="counter-panel">
      <h2>¿En qué local estás?</h2>
      <p className="counter-hint">
        Elegí el local para registrar las ventas ahí.
      </p>
      <div className="counter-locations">
        {locations.map((loc) => (
          <button key={loc.id} type="button" onClick={() => onPick(loc.id)}>
            {loc.name}
          </button>
        ))}
      </div>
    </section>
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
  quick,
  selectedRewardId,
  onSelectReward,
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
  quick: {
    amount: string;
    onAmount: (v: string) => void;
    note: string;
    onNote: (v: string) => void;
  };
  selectedRewardId: string | null;
  onSelectReward: (rewardId: string) => void;
  busy: boolean;
  canConfirm: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const balance = balanceFor(resolved.program.kind, resolved.membership);
  return (
    <section className="counter-panel">
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
          currencyCode={currencyCode}
          cart={cart}
          onAdd={onAdd}
          onQty={onQty}
          onLinePrice={onLinePrice}
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

      {mode !== "redeem" && (
        <PointsPreview
          accrual={resolved.program.accrual}
          kind={resolved.program.kind}
          total={
            mode === "detailed" ? cartTotal(cart) : Number(quick.amount) || 0
          }
        />
      )}

      <div className="counter-actions">
        <button type="button" className="counter-secondary" onClick={onCancel}>
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
    </section>
  );
}

/** Read-only reference of what the current sale would grant — helps the operator
 * catch a pricing/catalog mistake before confirming (spec 0030 QA feedback). */
function PointsPreview({
  accrual,
  kind,
  total,
}: {
  accrual: {
    mode: string | null;
    grant: number | null;
    blockAmount: number | null;
  };
  kind: string;
  total: number;
}) {
  const units = previewUnits(accrual, total);
  return (
    <p className="counter-points-preview">
      Esta venta otorga <strong>{units}</strong> {unitLabel(kind, units)}
    </p>
  );
}

/** Done screen of the resolved stage. A scan ends in exactly one of the two events of
 * value, so the redemption takes over the whole panel when it is the one that happened. */
export function DoneStage({
  result,
  redeemed,
  displayName,
  onNext,
}: {
  result: GrantResponse | null;
  redeemed: RedeemResponse | null;
  displayName: string;
  onNext: () => void;
}) {
  if (redeemed) {
    return (
      <RedeemDone
        redeemed={redeemed}
        displayName={displayName}
        onNext={onNext}
      />
    );
  }
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
      <button type="button" className="counter-primary" onClick={onNext}>
        Escanear siguiente
      </button>
    </section>
  );
}
