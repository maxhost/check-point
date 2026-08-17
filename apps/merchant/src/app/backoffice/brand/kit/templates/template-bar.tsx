import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Bar & gastronomía: benefit first, with a deliberately obvious scan zone for the counter.
export function TemplateBar(props: PosterProps) {
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
    <div className="poster tpl-bar" style={posterVars(colors)}>
      <header className="tpl-bar-head">
        <PosterLogo logoPath={logoPath} businessName={businessName} />
        <div>
          <span className="tpl-bar-kicker">{label}</span>
          <span className="tpl-bar-name">{businessName}</span>
        </div>
      </header>
      <div className="tpl-bar-body">
        <span className="poster-eyebrow">Tu mesa también suma</span>
        <h1 className="tpl-bar-headline">{headline}</h1>
        <p className="tpl-bar-sub">{subheadline}</p>
        <ul className="poster-benefits tpl-bar-benefits">
          <li>Sumá en cada visita</li>
          <li>Canjeá premios exclusivos</li>
          <li>Todo desde tu celular</li>
        </ul>
      </div>
      <div className="tpl-bar-qrcard">
        <div className="poster-qr-copy">
          <span className="poster-step">01</span>
          <span className="tpl-bar-scan">Escaneá y empezá hoy</span>
        </div>
        <QrBlock svg={qrSvg} />
        <span className="tpl-bar-cta">Gratis · sin descargar una app</span>
      </div>
    </div>
  );
}
