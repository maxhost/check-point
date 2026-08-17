import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Retail: bright and blocky. Primary header band, an accent "tag" motif for the headline,
// the QR in a crisp white block. Made to catch the eye near a till or shelf.
export function TemplateRetail(props: PosterProps) {
  const { businessName, logoPath, colors, qrSvg, headline, subheadline } = props;
  return (
    <div className="poster tpl-retail" style={posterVars(colors)}>
      <header className="tpl-retail-band">
        <PosterLogo logoPath={logoPath} businessName={businessName} />
        <span className="tpl-retail-name">{businessName}</span>
      </header>
      <div className="tpl-retail-tag">
        <h1 className="tpl-retail-headline">{headline}</h1>
      </div>
      <p className="tpl-retail-sub">{subheadline}</p>
      <div className="tpl-retail-qr">
        <QrBlock svg={qrSvg} />
        <span className="tpl-retail-cta">Escaneá y registrate gratis</span>
      </div>
    </div>
  );
}
