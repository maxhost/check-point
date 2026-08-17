import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Alojamiento: calm and elegant. Light complementary field, centered serif headline,
// thin accent rules framing the QR. Suits a reception desk or a room folder.
export function TemplateLodging(props: PosterProps) {
  const { businessName, logoPath, colors, qrSvg, headline, subheadline } = props;
  return (
    <div className="poster tpl-lodging" style={posterVars(colors)}>
      <PosterLogo logoPath={logoPath} businessName={businessName} />
      <span className="tpl-lodging-name">{businessName}</span>
      <span className="tpl-lodging-rule" />
      <h1 className="tpl-lodging-headline">{headline}</h1>
      <p className="tpl-lodging-sub">{subheadline}</p>
      <div className="tpl-lodging-qr">
        <QrBlock svg={qrSvg} />
      </div>
      <span className="tpl-lodging-foot">Escaneá con la cámara de tu teléfono</span>
    </div>
  );
}
