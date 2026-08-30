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
          <p>Escaneá el QR del cliente para acreditar su compra.</p>
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
      <section className="locations-list">
        <h2>Acreditaciones de hoy</h2>
        {history.length === 0 ? (
          <p className="counter-hint">Todavía no hay acreditaciones hoy.</p>
        ) : (
          history.map((row) => (
            <article className="location-card" key={row.id}>
              <div>
                <strong>{row.consumer || "Cliente"}</strong>
                <span>
                  {formatTime(row.createdAt)} ·{" "}
                  {row.accrualKind === "stamps" ? "Sellos" : "Puntos"}
                </span>
                <small>Operó {row.operator}</small>
              </div>
              <div className="counter-history-units">
                +{row.unitsGranted}{" "}
                {unitLabel(row.accrualKind, row.unitsGranted)}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
