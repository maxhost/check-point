"use client";

import { useState } from "react";
import type { ConsumerProgramSummary } from "@mi-pasaporte/domain/server/consumer/programs";
import type { WelcomeCouponSummary } from "@mi-pasaporte/domain/server/consumer/welcome-coupons";
import { ProgramCard } from "./program-card";

export function visiblePrograms(
  programs: ConsumerProgramSummary[],
  showClosed: boolean,
) {
  return showClosed
    ? programs
    : programs.filter((program) => program.programStatus === "active");
}

export function ProgramsTab({
  programs,
  welcomeCoupons = [],
  onShowQr,
}: {
  programs: ConsumerProgramSummary[];
  welcomeCoupons?: WelcomeCouponSummary[];
  onShowQr?: () => void;
}) {
  const [showClosed, setShowClosed] = useState(false);
  const visible = visiblePrograms(programs, showClosed);
  const hasClosed = programs.some(
    (program) => program.programStatus !== "active",
  );
  return (
    <section aria-labelledby="programs-tab-title">
      {welcomeCoupons.length > 0 && (
        <div
          className="consumer-welcome-coupons"
          aria-label="Beneficios de bienvenida"
        >
          {welcomeCoupons.map((coupon) => (
            <article className="consumer-welcome-coupon" key={coupon.id}>
              <span className="consumer-welcome-coupon-tag">
                BENEFICIO DE BIENVENIDA
              </span>
              <h3>{coupon.label}</h3>
              <p>{coupon.businessName}</p>
              {coupon.rule && <p>{coupon.rule}</p>}
              <p>
                {coupon.available
                  ? `Válido hasta ${new Date(coupon.validUntil).toLocaleDateString("es", { day: "numeric", month: "long", timeZone: coupon.timeZone })}`
                  : `Disponible desde ${new Date(coupon.validFrom).toLocaleDateString("es", { day: "numeric", month: "long", timeZone: coupon.timeZone })}`}
              </p>
              {onShowQr && (
                <button type="button" onClick={onShowQr}>
                  Ver mi código QR
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      <div className="consumer-programs-heading">
        <div>
          <h2 id="programs-tab-title">Tus programas</h2>
          <p>Todos tus beneficios, en un solo lugar.</p>
        </div>
        {hasClosed && (
          <label className="consumer-closed-toggle">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(event) => setShowClosed(event.target.checked)}
            />{" "}
            Ver programas cerrados
          </label>
        )}
      </div>
      {visible.length ? (
        <div className="consumer-program-list">
          {visible.map((program) => (
            <ProgramCard key={program.membershipId} program={program} />
          ))}
        </div>
      ) : (
        <div className="consumer-empty">
          <h3>No hay programas para mostrar</h3>
          <p>
            {showClosed
              ? "Todavía no pertenecés a ningún programa."
              : "Activá el filtro para ver programas anteriores."}
          </p>
        </div>
      )}
    </section>
  );
}
