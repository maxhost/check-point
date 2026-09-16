/**
 * Spec 0065 fase D / ADR 0068: la tercera pestaña es «Configuración», y es una PESTAÑA y no
 * una ruta por decisión del owner — el portal es este SPA, no un árbol de rutas. Costo
 * declarado en el ADR: la sección no tiene URL propia y la barra pasa de dos botones a tres
 * (`grid-template-columns` de `.consumer-bottom-nav` en `globals.css`).
 */
export type WalletTab = "programs" | "qr" | "settings";

export function BottomNav({
  activeTab,
  onChange,
}: {
  activeTab: WalletTab;
  onChange: (tab: WalletTab) => void;
}) {
  return (
    <nav
      className="consumer-bottom-nav"
      aria-label="Secciones de CheckPass Club"
    >
      <button
        type="button"
        aria-current={activeTab === "programs" ? "page" : undefined}
        onClick={() => onChange("programs")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M7 9h10M7 13h6" />
        </svg>
        <span>Programas</span>
      </button>
      <button
        type="button"
        aria-current={activeTab === "qr" ? "page" : undefined}
        onClick={() => onChange("qr")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M8 8h2v2H8zM14 8h2v2h-2zM8 14h2v2H8zM14 14h2v2h-2z" />
        </svg>
        <span>Mi QR</span>
      </button>
      <button
        type="button"
        aria-current={activeTab === "settings" ? "page" : undefined}
        onClick={() => onChange("settings")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.7-1.3-1.9-3.3-2 .8a7.6 7.6 0 0 0-2.6-1.5L14.2 3H9.8l-.4 2.2a7.6 7.6 0 0 0-2.6 1.5l-2-.8-1.9 3.3 1.7 1.3a7.6 7.6 0 0 0 0 3l-1.7 1.3 1.9 3.3 2-.8a7.6 7.6 0 0 0 2.6 1.5l.4 2.2h4.4l.4-2.2a7.6 7.6 0 0 0 2.6-1.5l2 .8 1.9-3.3z" />
        </svg>
        <span>Configuración</span>
      </button>
    </nav>
  );
}
