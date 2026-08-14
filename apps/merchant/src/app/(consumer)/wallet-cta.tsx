// Shared "Add to Wallet" buttons (spec 0029). Presentational + server-safe, so
// both the server `/wallet` page and the client enroll confirmation reuse it.
// The links hit the session-authorized endpoints; both buttons are ALWAYS
// rendered (never hidden by UA detection) — `isIos` only reorders them.

const walletButton: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  textAlign: "center",
  padding: "13px 14px",
  fontSize: 16,
  borderRadius: 10,
  textDecoration: "none",
  marginTop: 12,
};

export function WalletButtons({ isIos }: { isIos: boolean }) {
  const apple = (
    <a
      key="apple"
      href="/api/public/wallet/apple.pkpass"
      style={{ ...walletButton, background: "#000", color: "#fff" }}
    >
      Añadir a Apple Wallet
    </a>
  );
  const google = (
    <a
      key="google"
      href="/api/public/wallet/google"
      style={{ ...walletButton, background: "#0f2a3a", color: "#fff" }}
    >
      Añadir a Google Wallet
    </a>
  );
  return <>{isIos ? [apple, google] : [google, apple]}</>;
}
