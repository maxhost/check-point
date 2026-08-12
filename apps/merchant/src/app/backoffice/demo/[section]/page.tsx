"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

const titles: Record<string, string> = {
  campaigns: "Campañas",
  locations: "Locales",
  staff: "Merchant staff",
  brand: "Marca",
  loyalty: "Programa de fidelización",
  settings: "Configuración",
  analytics: "Analíticas",
};

export default function BackofficeModulePage() {
  const { section } = useParams<{ section: string }>();
  const title = titles[section] ?? "Sección";
  return (
    <main className="merchant-shell">
      <div className="backoffice-home module-placeholder">
        <Link className="back-link" href="/backoffice/demo">
          ← Volver al Backoffice
        </Link>
        <p className="eyebrow">Backoffice</p>
        <h1>{title}</h1>
        <p>
          Este módulo se diseñará en el siguiente paso. Por ahora validamos que
          la navegación del owner sea clara.
        </p>
      </div>
    </main>
  );
}
