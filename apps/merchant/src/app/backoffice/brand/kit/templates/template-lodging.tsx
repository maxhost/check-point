import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Alojamiento: a calm, premium welcome card for reception or room folders.
export function TemplateLodging(props: PosterProps) {
  const { businessName, logoPath, colors, qrSvg, headline, subheadline } =
    props;
  return (
    <div className="poster tpl-lodging" style={posterVars(colors)}>
      <PosterLogo logoPath={logoPath} businessName={businessName} />
      <span className="tpl-lodging-kicker">Invitación para huéspedes</span>
      <span className="tpl-lodging-name">{businessName}</span>
      <h1 className="tpl-lodging-headline">{headline}</h1>
      <p className="tpl-lodging-sub">{subheadline}</p>
      <div className="tpl-lodging-qr">
        <span>Sumate gratis</span>
        <QrBlock svg={qrSvg} />
      </div>
      <span className="tpl-lodging-foot">
        Escaneá con la cámara de tu teléfono
      </span>
    </div>
  );
}
