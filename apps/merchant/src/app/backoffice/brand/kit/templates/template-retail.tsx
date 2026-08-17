import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Retail: an offer-ticket composition designed to stop the eye in a busy checkout.
export function TemplateRetail(props: PosterProps) {
  const {
    businessName,
    logoPath,
    colors,
    qrSvg,
    label,
    headline,
    subheadline,
  } = props;
  return (
    <div className="poster tpl-retail" style={posterVars(colors)}>
      <header className="tpl-retail-band">
        <PosterLogo logoPath={logoPath} businessName={businessName} />
        <div>
          <span className="tpl-retail-kicker">{label}</span>
          <span className="tpl-retail-name">{businessName}</span>
        </div>
      </header>
      <div className="tpl-retail-tag">
        <span className="tpl-retail-taglabel">Club de beneficios</span>
        <h1 className="tpl-retail-headline">{headline}</h1>
      </div>
      <p className="tpl-retail-sub">{subheadline}</p>
      <ul className="poster-benefits tpl-retail-benefits">
        <li>
          <b>01</b> Comprá y acumulá
        </li>
        <li>
          <b>02</b> Desbloqueá recompensas
        </li>
        <li>
          <b>03</b> Volvé por tu próximo premio
        </li>
      </ul>
      <div className="tpl-retail-qr">
        <div className="poster-qr-copy">
          <span className="tpl-retail-scan">Escaneá para sumarte</span>
          <small>Apuntá la cámara al código</small>
        </div>
        <QrBlock svg={qrSvg} />
      </div>
    </div>
  );
}
