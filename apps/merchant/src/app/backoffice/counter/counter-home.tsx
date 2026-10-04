"use client";

import { SignOutButton } from "../../components/sign-out-button";
import type { AccreditationRow } from "./types";
import { unitLabel } from "./types";

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-EC", { timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return "";
  }
}

/** The counter's idle console (owner + staff): operator header, day history and the big
 * Escanear button that launches the scan/accreditation flow. */
export function CounterHome({
  operatorName,
  history,
  onScan,
}: {
  operatorName: string;
  history: AccreditationRow[];
  onScan: () => void;
}) {
  return (
    <main className="merchant-shell counter-shell">
      <header className="owner-header">
        <div>
          <p className="eyebrow">Mostrador</p>
          <h1>Hola, {operatorName}</h1>
          <p>Escanea el QR del cliente para acreditar su compra.</p>
        </div>
        <SignOutButton />
      </header>
      <button
        className="button counter-scan-cta"
        type="button"
        onClick={onScan}
      >
        Escanear
      </button>
      <details className="counter-history">
        <summary>Movimientos de hoy ({history.length})</summary>
        {history.length === 0 ? (
          <p className="counter-hint">Todavía no hay movimientos hoy.</p>
        ) : (
          history.map((row) => {
            // A redemption DEBITS (spec 0055): same row, opposite sign, and it is the
            // only kind that names the reward that was handed over.
            const isRedemption = row.entryKind === "redemption";
            const isCoupon = row.entryKind === "coupon";
            return (
              <article className="location-card" key={row.id}>
                <div>
                  <strong>{row.consumer || "Cliente"}</strong>
                  <span>
                    {formatTime(row.createdAt)} ·{" "}
                    {isCoupon
                      ? `Cupón${row.rewardLabel ? ` · ${row.rewardLabel}` : ""}`
                      : isRedemption
                        ? `Canje${row.rewardLabel ? ` · ${row.rewardLabel}` : ""}`
                        : row.accrualKind === "stamps"
                          ? "Sellos"
                          : "Puntos"}
                  </span>
                  <small>Operó {row.operator}</small>
                </div>
                {!isCoupon ||
                row.accrualKind === "stamps" ||
                row.accrualKind === "points" ? (
                  <div
                    className={`counter-history-units ${isRedemption ? "is-debit" : ""}`}
                  >
                    {isRedemption ? "−" : "+"}
                    {row.unitsGranted}{" "}
                    {unitLabel(row.accrualKind, row.unitsGranted)}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </details>
    </main>
  );
}
