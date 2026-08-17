import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Retail: an offer-ticket composition designed to stop the eye in a busy checkout.
export function TemplateRetail(props: PosterProps) {
  const { businessName, logoPath, colors, qrSvg, headline, subheadline } =
    props;
  return (
    <div className="poster tpl-retail" style={posterVars(colors)}>
      <header className="tpl-retail-band">
        <PosterLogo logoPath={logoPath} businessName={businessName} />
        <div>
          <span className="tpl-retail-kicker">Club de clientes</span>
          <span className="tpl-retail-name">{businessName}</span>
        </div>
      </header>
      <div className="tpl-retail-tag">
        <span className="tpl-retail-taglabel">Tus compras tienen premio</span>
        <h1 className="tpl-retail-headline">{headline}</h1>
      </div>
      <p className="tpl-retail-sub">{subheadline}</p>
      <div className="tpl-retail-qr">
        <span className="tpl-retail-scan">Escaneá para registrarte</span>
        <QrBlock svg={qrSvg} />
        <span className="tpl-retail-cta">Gratis · sin descargar nada</span>
      </div>
    </div>
  );
}
