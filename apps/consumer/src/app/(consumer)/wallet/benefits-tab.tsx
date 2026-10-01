"use client";

import { useState } from "react";
import type { ConsumerCoupon } from "@mi-pasaporte/domain/server/consumer/coupons";

function shortDate(value: Date) {
  return new Date(value).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function statusText(coupon: ConsumerCoupon) {
  if (coupon.status === "valid")
    return `Hasta el ${shortDate(coupon.validUntil)}`;
  if (coupon.status === "scheduled")
    return `Disponible desde el ${shortDate(coupon.validFrom)}`;
  if (coupon.status === "unavailable") return "No disponible por ahora";
  if (coupon.status === "redeemed") return "Ya canjeado";
  return "Vencido";
}

export function BenefitsTab({
  coupons,
  onShowQr,
  onShowPrograms,
}: {
  coupons: ConsumerCoupon[];
  onShowQr: () => void;
  onShowPrograms: () => void;
}) {
  const [selected, setSelected] = useState<ConsumerCoupon | null>(null);
  const available = coupons.filter((coupon) => coupon.status === "valid");
  const upcoming = coupons.filter(
    (coupon) =>
      coupon.status === "scheduled" || coupon.status === "unavailable",
  );
  const history = coupons.filter(
    (coupon) => coupon.status === "redeemed" || coupon.status === "expired",
  );

  function card(coupon: ConsumerCoupon, index: number) {
    return (
      <button
        className="cp-benefit-card"
        type="button"
        key={coupon.id}
        onClick={() => setSelected(coupon)}
      >
        <span className="cp-benefit-topline">
          <span className="cp-benefit-icon" aria-hidden="true">
            ✦
          </span>
          <span>{coupon.businessName}</span>
        </span>
        <strong>{coupon.label}</strong>
        <span className="cp-benefit-bottomline">
          <span>{statusText(coupon)}</span>
          <span aria-hidden="true">
            {index === 0 ? "Ver beneficio ↗" : "↗"}
          </span>
        </span>
      </button>
    );
  }

  return (
    <section aria-labelledby="benefits-tab-title" className="cp-screen">
      <div className="cp-screen-heading">
        <span className="cp-eyebrow">PARA VOS</span>
        <h2 id="benefits-tab-title">Tus beneficios</h2>
        <p>Encontrá lo que podés disfrutar hoy.</p>
      </div>
      <div className="cp-feature-summary">
        <span className="cp-feature-symbol" aria-hidden="true">
          ✦
        </span>
        <div>
          <strong>{available.length}</strong>
          <span>
            {available.length === 1 ? "beneficio listo" : "beneficios listos"}
          </span>
        </div>
      </div>
      {available.length > 0 ? (
        <div className="cp-benefit-list">{available.map(card)}</div>
      ) : (
        <div className="cp-empty">
          <span aria-hidden="true">✦</span>
          <h3>Todavía no hay beneficios listos</h3>
          <p>
            Tus cupones van a aparecer acá. Mientras tanto, mirá cómo vas en tus
            programas.
          </p>
          <button type="button" onClick={onShowPrograms}>
            Ver mis programas
          </button>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="cp-benefit-group">
          <h3>Más adelante</h3>
          <div className="cp-benefit-list">{upcoming.map(card)}</div>
        </div>
      )}
      {history.length > 0 && (
        <details className="cp-history">
          <summary>
            Beneficios anteriores <span>{history.length}</span>
          </summary>
          <div className="cp-benefit-list">{history.map(card)}</div>
        </details>
      )}
      {selected && (
        <div
          className="consumer-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            className="consumer-terms-sheet cp-benefit-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="benefit-detail-title"
          >
            <button
              className="consumer-modal-close"
              type="button"
              aria-label="Cerrar beneficio"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <span className="cp-eyebrow">{selected.businessName}</span>
            <h2 id="benefit-detail-title">{selected.label}</h2>
            <p>{statusText(selected)}</p>
            {selected.rule && (
              <div className="cp-benefit-rule">
                <strong>Condiciones</strong>
                <p>{selected.rule}</p>
              </div>
            )}
            {selected.status === "valid" && (
              <button
                className="cp-primary-action"
                type="button"
                onClick={() => {
                  setSelected(null);
                  onShowQr();
                }}
              >
                Mostrar mi pase para canjear
              </button>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
