import { PushPrompt } from "../push-prompt";
import { WalletButtons } from "../wallet-cta";

export function QrTab({
  qrSvg,
  isIos,
  vapidPublicKey,
  onSubscribed,
  showWalletButtons = true,
}: {
  qrSvg: string;
  isIos: boolean;
  vapidPublicKey: string | null;
  onSubscribed: (welcomeIssued: number) => void;
  showWalletButtons?: boolean;
}) {
  return (
    <section
      className="consumer-qr-tab cp-screen"
      aria-labelledby="qr-tab-title"
    >
      <div className="cp-screen-heading">
        <span className="cp-eyebrow">SIEMPRE A MANO</span>
        <h2 id="qr-tab-title">Tu pase</h2>
        <p>Un solo código para todos tus programas.</p>
      </div>
      <div className="cp-pass-card">
        <div className="cp-pass-mark">
          CheckPass <span aria-hidden="true">✦</span>
        </div>
        <div
          className="consumer-qr"
          aria-label="Tu código QR"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <strong>Mostrá este código en caja</strong>
        <small>Sumá puntos, sellos y usá tus beneficios.</small>
      </div>
      {showWalletButtons && (
        <div className="consumer-wallet-buttons">
          <WalletButtons isIos={isIos} />
        </div>
      )}
      <PushPrompt vapidPublicKey={vapidPublicKey} onSubscribed={onSubscribed} />
    </section>
  );
}
