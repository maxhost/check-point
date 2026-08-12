"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { read, type DemoState } from "../../demo";
import { Toast } from "../../components/ui";

export default function OwnerHomePage() {
  const [business, setBusiness] = useState<DemoState | null>(null);
  const [readyToast, setReadyToast] = useState<string | null>(null);
  useEffect(() => {
    setBusiness(read());
    const isReady =
      new URLSearchParams(window.location.search).get("toast") === "ready";
    setReadyToast(isReady ? "Tu negocio está listo." : null);
  }, []);
  if (!business)
    return (
      <main className="merchant-shell">
        <div className="backoffice-home empty-state">
          <p className="eyebrow">Backoffice</p>
          <h1>Primero configura tu negocio</h1>
          <p>Necesitamos el nombre de tu negocio y al menos una sucursal.</p>
          <Link className="button" href="/onboarding">
            Ir al onboarding
          </Link>
        </div>
      </main>
    );
  const modules = [
    [
      "campaigns",
      "Campañas",
      "Crea beneficios y experiencias para tus clientes.",
    ],
    [
      "loyalty",
      "Programa de fidelización",
      business.loyaltyProgram.status === "active"
        ? `${business.loyaltyProgram.type === "points" ? "Puntos" : "Sellos"} activo.`
        : "Activa un programa para premiar visitas.",
    ],
    ["locations", "Locales", "Gestiona tus sucursales y sus detalles."],
    ["staff", "Staff", "Organiza el equipo que opera tus locales."],
    ["brand", "Marca", "Personaliza cómo se ve tu negocio."],
    ["settings", "Configuración", "Ajustes generales de tu negocio."],
    ["analytics", "Analíticas", "Entiende visitas, beneficios y actividad."],
  ] as const;
  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <Toast message={readyToast} onDismiss={() => setReadyToast(null)} />
        <header className="owner-header">
          <div className="owner-mark">
            {business.logo
              ? "Logo"
              : business.businessName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="eyebrow">Backoffice</p>
            <h1>{business.businessName}</h1>
            <p>
              {business.branches.length}{" "}
              {business.branches.length === 1 ? "local" : "locales"} · Plan{" "}
              {business.plan === "pilot" ? "Piloto" : "Prueba"}
            </p>
          </div>
        </header>
        <section className="active-campaign">
          <p className="eyebrow">Campaña activa</p>
          <h2>Check-in de bienvenida</h2>
          <p>Activa en todos tus locales</p>
          <div className="campaign-rewards">
            <span>10 puntos</span>
            <span>1 sello</span>
            <span>Cupón 2x1</span>
          </div>
          <Link href="/backoffice/demo/campaigns">Ver campaña →</Link>
        </section>
        <section className="owner-modules">
          <h2>Gestiona tu negocio</h2>
          <div className="module-grid">
            {modules.map(([slug, title, description]) => (
              <Link
                className={`module-card ${slug === "campaigns" ? "primary" : ""}`}
                href={`/backoffice/demo/${slug}`}
                key={slug}
              >
                <strong>{title}</strong>
                <span>{description}</span>
                <small>Ver sección →</small>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
