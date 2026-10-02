import Image from "next/image";
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
  onSubscribed: (welcomeIssued: number) => void;
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
        <div className="cp-pass-art">
          <div className="cp-pass-mark">
            <Image
              src="/wallet-logo-trama-v1.png"
              width={30}
              height={30}
              alt=""
            />
            <span>CheckPass Club</span>
          </div>
        </div>
        <div className="cp-pass-code-area">
          <span className="cp-pass-code-label">TU CÓDIGO PERSONAL</span>
          <div
            className="consumer-qr"
            aria-label="Tu código QR"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <strong>Mostrá este código en caja</strong>
          <small>Sumá puntos, sellos y usá tus beneficios.</small>
        </div>
      </div>
      <div className="consumer-wallet-buttons">
        <p>Tu pase para volver a los lugares que hacen ciudad.</p>
        <WalletButtons isIos={isIos} />
      </div>
      <PushPrompt vapidPublicKey={vapidPublicKey} onSubscribed={onSubscribed} />
    </section>
  );
}
