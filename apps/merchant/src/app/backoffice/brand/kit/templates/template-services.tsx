import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Servicios: clean and professional. A vertical accent bar, header with logo + name, a
// short "how it works" list beside the QR. Fits a studio, salon or office wall.
export function TemplateServices(props: PosterProps) {
  const { businessName, logoPath, colors, qrSvg, headline, subheadline } = props;
  return (
    <div className="poster tpl-services" style={posterVars(colors)}>
      <span className="tpl-services-bar" />
      <header className="tpl-services-head">
        <PosterLogo logoPath={logoPath} businessName={businessName} />
        <span className="tpl-services-name">{businessName}</span>
      </header>
      <h1 className="tpl-services-headline">{headline}</h1>
      <p className="tpl-services-sub">{subheadline}</p>
      <div className="tpl-services-panel">
        <ol className="tpl-services-steps">
          <li>Escaneá el código</li>
          <li>Ingresá tu teléfono</li>
          <li>Empezá a sumar beneficios</li>
        </ol>
        <div className="tpl-services-qr">
          <QrBlock svg={qrSvg} />
        </div>
      </div>
    </div>
  );
}
