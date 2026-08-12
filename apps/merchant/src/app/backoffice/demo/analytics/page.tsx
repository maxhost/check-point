"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useState } from "react";
import {
  analyticsFixtures,
  qualityLabel,
  type AnalyticsSector,
  type Metric,
} from "../../../analytics";
import { read, type DemoState } from "../../../demo";
import { ModuleHeader } from "../../../components/ui";

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <article className="analytics-kpi">
      <p>{metric.label}</p>
      <strong>{metric.value}</strong>
      <small>{metric.detail}</small>
      <em>{qualityLabel[metric.quality]}</em>
    </article>
  );
}

export default function AnalyticsPage() {
  const [business, setBusiness] = useState<DemoState | null>(null);
  const [sector, setSector] = useState<AnalyticsSector>("bar_restaurant");
  useEffect(() => setBusiness(read()), []);
  if (!business)
    return (
      <main className="merchant-shell">
        <div className="module-placeholder">
          <h1>Primero completa el onboarding</h1>
          <Link className="button" href="/onboarding">
            Ir al onboarding
          </Link>
        </div>
      </main>
    );
  const data = analyticsFixtures[sector];
  const maxTrend = Math.max(...data.trend.map((item) => item.value));
  return (
    <main className="merchant-shell">
      <div className="analytics-page">
        <ModuleHeader
          eyebrow="Analíticas"
          title="Entiende lo que está funcionando"
          description="Datos de demostración: los filtros se conectarán a eventos reales."
          closeHref="/backoffice/demo"
        />
        <div className="analytics-filters">
          <label>
            Periodo
            <select aria-label="Periodo">
              <option>Últimos 30 días</option>
            </select>
          </label>
          <label>
            Local
            <select aria-label="Local">
              <option>Todos los locales</option>
            </select>
          </label>
        </div>
        <section
          className="analytics-kpis"
          aria-label="Indicadores principales"
        >
          {data.kpis.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>
        <section className="analytics-section">
          <div>
            <p className="eyebrow">Tendencia</p>
            <h2>Actividad durante la semana</h2>
          </div>
          <div className="trend-bars" aria-label="Actividad por día">
            {data.trend.map((item) => (
              <div key={item.label}>
                <i style={{ height: `${(item.value / maxTrend) * 100}%` }} />
                <span>{item.label}</span>
                <small>{item.value}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="analytics-section">
          <p className="eyebrow">Campaña destacada</p>
          <h2>Check-in de bienvenida</h2>
          <div className="funnel">
            {data.funnel.map((step) => (
              <div key={step.label}>
                <span>{step.label}</span>
                <strong>{step.value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="analytics-section">
          <p className="eyebrow">Distribución temporal</p>
          <h2>Patrón por día y franja</h2>
          <div className="heatmap">
            <span />
            {data.heatmap[0].slots.map((slot) => (
              <strong key={slot.label}>{slot.label}</strong>
            ))}
            {data.heatmap.flatMap((item) => [
              <strong key={`${item.day}-label`}>{item.day}</strong>,
              ...item.slots.map((slot) => (
                <div
                  key={`${item.day}-${slot.label}`}
                  aria-label={`${item.day}, ${slot.label}: ${slot.value} interacciones`}
                  style={{ "--heat": slot.value / 100 } as CSSProperties}
                >
                  <span>{slot.value}</span>
                </div>
              )),
            ])}
          </div>
        </section>
        <section className="analytics-section lens">
          <p className="eyebrow">Lente {data.label}</p>
          <h2>{data.lens.title}</h2>
          <p>{data.lens.description}</p>
          <div className="lens-metrics">
            {data.lens.metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        </section>
      </div>
      <fieldset className="sector-switch">
        <legend>Vista demo</legend>
        {(["bar_restaurant", "hotel", "retail"] as const).map((item) => (
          <label key={item}>
            <input
              type="radio"
              name="analytics-sector"
              checked={sector === item}
              onChange={() => setSector(item)}
            />
            <span>{analyticsFixtures[item].label}</span>
          </label>
        ))}
      </fieldset>
    </main>
  );
}
