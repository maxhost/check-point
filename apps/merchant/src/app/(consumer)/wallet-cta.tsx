// Shared, platform-aware Wallet calls to action. A pass for the other platform is
// not useful here: iPhone/iPad users get Apple Wallet; all other devices get Google
// Wallet. The component is server-safe so `/wallet` and enrollment can reuse it.

const walletButton: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  textAlign: "center",
  minHeight: 48,
  padding: "11px 16px",
  fontSize: 15,
  fontWeight: 600,
  borderRadius: 8,
  textDecoration: "none",
  marginTop: 12,
};

export function WalletButtons({ isIos }: { isIos: boolean }) {
  if (isIos) {
    return (
      <a
        href="/api/public/wallet/apple.pkpass"
        style={{
          ...walletButton,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: "#000",
          color: "#fff",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          letterSpacing: -0.2,
        }}
      >
        <span aria-hidden style={{ fontSize: 23, lineHeight: 1 }}>
          
        </span>
        <span>Añadir a Apple Wallet</span>
      </a>
    );
  }

  return (
    <a
      href="/api/public/wallet/google"
      style={{
        ...walletButton,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        background: "#fff",
        color: "#202124",
        border: "1px solid #dadce0",
        boxShadow: "0 1px 2px rgba(60, 64, 67, 0.18)",
        fontFamily: "Roboto, Arial, sans-serif",
      }}
    >
      <GoogleWalletMark />
      <span>Añadir a Google Wallet</span>
    </a>
  );
}

function GoogleWalletMark() {
  return (
    <svg aria-hidden width="24" height="18" viewBox="0 0 24 18" fill="none">
      <path
        d="M2 3.5A3.5 3.5 0 0 1 5.5 0H16v18H5.5A3.5 3.5 0 0 1 2 14.5v-11Z"
        fill="#4285F4"
      />
      <path
        d="M16 0h2.5A3.5 3.5 0 0 1 22 3.5v11a3.5 3.5 0 0 1-3.5 3.5H16V0Z"
        fill="#34A853"
      />
      <path d="M16 0v18" stroke="#fff" strokeWidth="2" />
      <path d="M2 6h20" stroke="#FBBC04" strokeWidth="2" />
    </svg>
  );
}
