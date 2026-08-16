import { PushPrompt } from "../push-prompt";
import { WalletButtons } from "../wallet-cta";

export function QrTab({
  qrSvg,
  isIos,
  vapidPublicKey,
  onSubscribed,
}: {
  qrSvg: string;
  isIos: boolean;
  vapidPublicKey: string | null;
  onSubscribed: () => void;
}) {
  return (
    <section className="consumer-qr-tab" aria-labelledby="qr-tab-title">
      <h2 id="qr-tab-title">Mi QR</h2>
      <p>Mostrá este código en el local para sumar tus beneficios.</p>
      <div
        className="consumer-qr"
        aria-label="Tu código QR"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="consumer-wallet-buttons">
        <WalletButtons isIos={isIos} />
      </div>
      <PushPrompt vapidPublicKey={vapidPublicKey} onSubscribed={onSubscribed} />
    </section>
  );
}
