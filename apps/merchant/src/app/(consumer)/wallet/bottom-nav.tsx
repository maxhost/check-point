export type WalletTab = "programs" | "qr";

export function BottomNav({
  activeTab,
  onChange,
}: {
  activeTab: WalletTab;
  onChange: (tab: WalletTab) => void;
}) {
  return (
    <nav className="consumer-bottom-nav" aria-label="Secciones de CheckPass Club">
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
    </nav>
  );
}
