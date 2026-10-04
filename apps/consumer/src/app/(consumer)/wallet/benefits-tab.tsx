"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ConsumerCoupon,
  ConsumerCouponList,
} from "@mi-pasaporte/domain/server/consumer/coupons";

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
  const [list, setList] = useState<ConsumerCouponList>({ here: null, coupons });
  const [selected, setSelected] = useState<ConsumerCoupon | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const couponUrl = useRef("/api/public/consumer/coupons");
  const requestNumber = useRef(0);

  useEffect(() => {
    let alive = true;
    async function refresh(coords?: GeolocationCoordinates) {
      const query = coords
        ? `?lat=${coords.latitude}&lng=${coords.longitude}`
        : "";
      if (coords) couponUrl.current = `/api/public/consumer/coupons${query}`;
      const sequence = ++requestNumber.current;
      try {
        const response = await fetch(couponUrl.current, {
          cache: "no-store",
        });
        if (!response.ok)
          throw new Error("No pudimos actualizar tus beneficios.");
        const data = (await response.json()) as ConsumerCouponList;
        if (alive && sequence === requestNumber.current) setList(data);
      } catch (cause) {
        if (alive)
          setError(
            cause instanceof Error
              ? cause.message
              : "No pudimos actualizar tus beneficios.",
          );
      }
    }
    void refresh();
    if (navigator.geolocation && navigator.permissions) {
      void navigator.permissions
        .query({ name: "geolocation" })
        .then((permission) => {
          if (permission.state === "granted") {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                if (alive) void refresh(position.coords);
              },
              () => {},
              { timeout: 5000, maximumAge: 60000 },
            );
          }
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, []);

  async function choose(couponId: string | null) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/public/consumer/coupon-selection", {
        method: couponId ? "PUT" : "DELETE",
        headers: couponId ? { "content-type": "application/json" } : undefined,
        body: couponId ? JSON.stringify({ couponId }) : undefined,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error ?? "No pudimos cambiar tu cupón.");
      const fresh = await fetch(couponUrl.current, {
        cache: "no-store",
      });
      if (!fresh.ok) throw new Error("No pudimos actualizar tus beneficios.");
      setList((await fresh.json()) as ConsumerCouponList);
      setSelected(null);
      if (couponId) onShowQr();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No pudimos cambiar tu cupón.",
      );
    } finally {
      setBusy(false);
    }
  }

  const current =
    selected && list.coupons.find((coupon) => coupon.id === selected.id);
  const available = list.coupons.filter((coupon) => coupon.status === "valid");
  const upcoming = list.coupons.filter(
    (coupon) =>
      coupon.status === "scheduled" || coupon.status === "unavailable",
  );
  const history = list.coupons.filter(
    (coupon) => coupon.status === "redeemed" || coupon.status === "expired",
  );

  function card(coupon: ConsumerCoupon, index: number) {
    return (
      <button
        className={`cp-benefit-card ${coupon.selected ? "is-selected" : ""}`}
        type="button"
        key={coupon.id}
        onClick={() => setSelected(coupon)}
      >
        <span className="cp-benefit-topline">
          <span className="cp-benefit-icon" aria-hidden="true">
            ✦
          </span>
          <span>
            {coupon.businessName}
            {coupon.selected ? " · Elegido" : ""}
          </span>
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

  function groupedCards(items: ConsumerCoupon[]) {
    return (
      <div className="cp-benefit-groups">
        {Array.from(new Set(items.map((coupon) => coupon.businessId))).map(
          (businessId) => {
            const group = items.filter(
              (coupon) => coupon.businessId === businessId,
            );
            return (
              <div className="cp-benefit-group" key={businessId}>
                <h3>{group[0].businessName}</h3>
                <div className="cp-benefit-list">{group.map(card)}</div>
              </div>
            );
          },
        )}
      </div>
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
      {list.here && (
        <p className="cp-benefit-here">Acá · {list.here.businessName}</p>
      )}
      {error && !current && (
        <p role="alert" className="cp-benefit-error">
          {error}
        </p>
      )}
      {available.length > 0 ? (
        groupedCards(available)
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
          {groupedCards(upcoming)}
        </div>
      )}
      {history.length > 0 && (
        <details className="cp-history">
          <summary>
            Beneficios anteriores <span>{history.length}</span>
          </summary>
          {groupedCards(history)}
        </details>
      )}
      {current && (
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
            <span className="cp-eyebrow">{current.businessName}</span>
            <h2 id="benefit-detail-title">{current.label}</h2>
            <p>{statusText(current)}</p>
            {error && (
              <p role="alert" className="cp-benefit-error">
                {error}
              </p>
            )}
            {current.rule && (
              <div className="cp-benefit-rule">
                <strong>Condiciones</strong>
                <p>{current.rule}</p>
              </div>
            )}
            {current.status === "valid" && (
              <button
                className="cp-primary-action"
                type="button"
                disabled={busy}
                onClick={() =>
                  void choose(current.selected ? null : current.id)
                }
              >
                {current.selected ? "No usar este cupón" : "Usar este cupón"}
              </button>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
