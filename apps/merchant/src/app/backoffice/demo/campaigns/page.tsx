"use client";
import Link from "next/link";
import { useState } from "react";
import { ModuleHeader, Toast } from "../../../components/ui";

type Campaign = {
  name: string;
  status: "active" | "paused" | "archived";
  template: string;
  start: string;
  end: string;
  hours: string;
  reward: string;
  limit: string;
};
const seed: Campaign = {
  name: "Check-in de bienvenida",
  status: "active",
  template: "Activa tu visita",
  start: "2026-08-10",
  end: "2026-09-10",
  hours: "Todos los días · 16:00–23:00",
  reward: "10 puntos · 1 sello · cupón 2x1",
  limit: "1 por persona al día",
};
export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([seed]);
  const [toast, setToast] = useState<string | null>(null);
  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <ModuleHeader
          eyebrow="Campañas"
          title="Activa beneficios para tus clientes"
          closeHref="/backoffice/demo"
        />
        <Toast message={toast} onDismiss={() => setToast(null)} />
        <Link
          className="button campaign-create"
          href="/backoffice/demo/campaigns/new"
        >
          + Nueva campaña
        </Link>
        <section className="locations-list">
          <h2>Campañas</h2>
          {campaigns.map((c, i) => (
            <article className="campaign-card" key={`${c.name}-${i}`}>
              <div>
                <span className={`status ${c.status}`}>
                  {c.status === "active"
                    ? "Activa"
                    : c.status === "paused"
                      ? "Pausada"
                      : "Archivada"}
                </span>
                <h2>{c.name}</h2>
                <p>
                  {c.template} · {c.hours}
                </p>
                <strong>{c.reward}</strong>
                <small>
                  Resultados: 128 check-ins · 1.280 puntos · 34 cupones
                </small>
              </div>
              <div className="campaign-actions">
                {c.status === "active" && (
                  <button
                    className="archive-button"
                    onClick={() => {
                      setCampaigns(
                        campaigns.map((x, n) =>
                          n === i ? { ...x, status: "paused" } : x,
                        ),
                      );
                      setToast("Campaña pausada.");
                    }}
                  >
                    Detener
                  </button>
                )}
                {c.status === "paused" && (
                  <button
                    className="archive-button"
                    onClick={() => {
                      setCampaigns(
                        campaigns.map((x, n) =>
                          n === i ? { ...x, status: "archived" } : x,
                        ),
                      );
                      setToast("Campaña archivada.");
                    }}
                  >
                    Archivar
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
