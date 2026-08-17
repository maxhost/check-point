import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Servicios: professional and procedural, reducing uncertainty around the scan.
export function TemplateServices(props: PosterProps) {
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
    <div className="poster tpl-services" style={posterVars(colors)}>
      <span className="tpl-services-bar" />
      <header className="tpl-services-head">
        <PosterLogo logoPath={logoPath} businessName={businessName} />
        <div>
          <span className="tpl-services-kicker">{label}</span>
          <span className="tpl-services-name">{businessName}</span>
        </div>
      </header>
      <div className="tpl-services-body">
        <h1 className="tpl-services-headline">{headline}</h1>
        <p className="tpl-services-sub">{subheadline}</p>
        <div className="tpl-services-promise">
          <span>Más visitas</span>
          <span>Más beneficios</span>
          <span>Cero aplicaciones</span>
        </div>
      </div>
      <div className="tpl-services-panel">
        <ol className="tpl-services-steps">
          <li>
            <b>1</b> Escaneá el código
          </li>
          <li>
            <b>2</b> Registrate con tu teléfono
          </li>
          <li>
            <b>3</b> Empezá a sumar beneficios
          </li>
        </ol>
        <div className="tpl-services-qr">
          <span>Empezá acá</span>
          <QrBlock svg={qrSvg} />
          <small>Escaneá con tu cámara</small>
        </div>
      </div>
    </div>
  );
}
