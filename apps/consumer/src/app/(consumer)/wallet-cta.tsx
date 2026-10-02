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

export function WalletButtons({
  isIos,
  onAction,
}: {
  isIos: boolean;
  onAction?: () => void;
}) {
  if (isIos) {
    return (
      <a
        href="/api/public/wallet/apple.pkpass"
        data-provider="apple"
        onClick={onAction}
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
        <AppleWalletMark />
        <span>Añadir a Apple Wallet</span>
      </a>
    );
  }

  return (
    <a
      href="/api/public/wallet/google"
      data-provider="google"
      onClick={onAction}
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

function AppleWalletMark() {
  return (
    <svg aria-hidden width="17" height="20" viewBox="0 0 814 1000">
      <path
        fill="#fff"
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
      />
    </svg>
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
