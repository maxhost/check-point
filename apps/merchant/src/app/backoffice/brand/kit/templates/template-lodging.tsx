import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Alojamiento: a calm, premium welcome card for reception or room folders.
export function TemplateLodging(props: PosterProps) {
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
    <div className="poster tpl-lodging" style={posterVars(colors)}>
      <PosterLogo logoPath={logoPath} businessName={businessName} />
      <div className="tpl-lodging-intro">
        <span className="tpl-lodging-kicker">{label}</span>
        <span className="tpl-lodging-name">{businessName}</span>
        <h1 className="tpl-lodging-headline">{headline}</h1>
        <p className="tpl-lodging-sub">{subheadline}</p>
      </div>
      <div className="tpl-lodging-card">
        <div className="tpl-lodging-perks">
          <span className="poster-eyebrow">Tu próxima visita</span>
          <ul className="poster-benefits">
            <li>Beneficios por hospedarte</li>
            <li>Premios para disfrutar más</li>
            <li>Registro rápido y gratuito</li>
          </ul>
          <span className="tpl-lodging-foot">Abrí la cámara y escaneá</span>
        </div>
        <div className="tpl-lodging-qr">
          <span>Sumate ahora</span>
          <QrBlock svg={qrSvg} />
        </div>
      </div>
    </div>
  );
}
