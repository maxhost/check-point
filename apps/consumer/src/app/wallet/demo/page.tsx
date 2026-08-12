"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type DemoReward, readDemoReward } from "../../demo";

const previewReward: DemoReward = { points: 10, stamps: 2 };

export default function DemoWalletPage() {
  const [reward, setReward] = useState<DemoReward>(previewReward);
  const [isPreview, setIsPreview] = useState(true);

  useEffect(() => {
    const stored = readDemoReward(window.sessionStorage);
    if (stored) {
      setReward(stored);
      setIsPreview(false);
    }
  }, []);

  return (
    <main className="merchant-wallet">
      <header className="merchant-cover">
        <div className="cover-content">
          <Link className="back-link" href="/check-in/demo-bar">
            ← Mi Pasaporte
          </Link>
          <header className="merchant-header">
            <div className="merchant-logo" aria-hidden="true">
              BD
            </div>
            <div>
              <p className="eyebrow">Tu comercio</p>
              <h1>Bar Demo</h1>
              <p className="muted">Av. Solano 12-34 · Cuenca</p>
              <p className="location">⌖ Estás en este local</p>
            </div>
          </header>
        </div>
      </header>
      <div className="wallet-content">
        <section className="promotion-banner">
          <span>Exclusivo en este local · hoy</span>
          <strong>Un espacio para tus próximas campañas</strong>
          <small>Promociones por horario, evento o visita.</small>
        </section>
        <section className="points-summary">
          <div>
            <span>Puntos acumulados</span>
            <strong>{reward.points} pts</strong>
          </div>
          <small>Ganados en tu check-in de hoy</small>
        </section>

        <h2 className="section-title">Tus cupones disponibles</h2>
        <div className="horizontal-scroll" aria-label="Cupones disponibles">
          <article className="coupon-card coupon-primary">
            <span>Bar Demo</span>
            <strong>2x1 en tu próxima pinta</strong>
            <small>Disponible hasta el viernes</small>
          </article>
          <article className="coupon-card coupon-secondary">
            <span>Bar Demo</span>
            <strong>10% en una tabla para compartir</strong>
            <small>Disponible hasta el domingo</small>
          </article>
        </div>

        <h2 className="section-title">Canjea tus puntos</h2>
        <div className="redemptions">
          <article className="redemption-card">
            <div>
              <strong>50 pts</strong>
              <span> Bebida de cortesía</span>
            </div>
            <button disabled>Te faltan 40</button>
          </article>
          <article className="redemption-card">
            <div>
              <strong>100 pts</strong>
              <span> Premio sorpresa</span>
            </div>
            <button disabled>Te faltan 90</button>
          </article>
        </div>

        <h2 className="section-title">Tu progreso en Bar Demo</h2>
        <div className="asset">
          <strong>{reward.stamps} de 5 sellos</strong>
          <span>
            Ruta de la cerveza · te faltan 3 visitas para completar el reto
          </span>
        </div>
        <div className="asset">
          <strong>Logro desbloqueado: Primera visita</strong>
          <span>Tu primer lugar en Mi Pasaporte</span>
        </div>
        {isPreview && (
          <p className="notice">
            Vista precargada para revisar la UI mientras el check-in real
            requiere HTTPS.
          </p>
        )}
      </div>
    </main>
  );
}
