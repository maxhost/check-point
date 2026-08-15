"use client";

import type { ReactNode } from "react";
import { ModuleHeader, Toast } from "../../components/ui";
import { DetailedSale, QuickSale } from "./sale-forms";
import {
  type CartLine,
  type CounterLocation,
  type CounterProduct,
  type GrantResponse,
  type ResolveResponse,
  balanceFor,
  unitLabel,
} from "./types";

type Mode = "detailed" | "quick";

/** Shell + header + error toast, shared by every stage. */
export function Console({
  children,
  error,
  onDismiss,
}: {
  children: ReactNode;
  error: string | null;
  onDismiss: () => void;
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
      {error && <Toast kind="error" message={error} onDismiss={onDismiss} />}
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
        <button
          type="button"
          role="tab"
          aria-selected={mode === "detailed"}
          className={mode === "detailed" ? "is-active" : ""}
          onClick={() => setMode("detailed")}
        >
          Venta detallada
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "quick"}
          className={mode === "quick" ? "is-active" : ""}
          onClick={() => setMode("quick")}
        >
          Venta rápida
        </button>
      </div>

      {mode === "detailed" ? (
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
          {busy ? "Acreditando…" : "Confirmar"}
        </button>
      </div>
    </section>
  );
}

export function DoneStage({
  result,
  displayName,
  onNext,
}: {
  result: GrantResponse;
  displayName: string;
  onNext: () => void;
}) {
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
