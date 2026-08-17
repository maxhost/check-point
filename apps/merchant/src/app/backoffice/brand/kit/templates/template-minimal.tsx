import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Minimalista genérica: editorial and extremely legible, with one oversized action.
export function TemplateMinimal(props: PosterProps) {
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
    <div className="poster tpl-minimal" style={posterVars(colors)}>
      <header className="tpl-minimal-head">
        <PosterLogo logoPath={logoPath} businessName={businessName} />
        <div>
          <span className="tpl-minimal-kicker">{label}</span>
          <span className="tpl-minimal-name">{businessName}</span>
        </div>
      </header>
      <div className="tpl-minimal-message">
        <span className="poster-eyebrow">Cada visita cuenta</span>
        <h1 className="tpl-minimal-headline">{headline}</h1>
        <p className="tpl-minimal-sub">{subheadline}</p>
        <ul className="poster-benefits tpl-minimal-benefits">
          <li>Sumá</li>
          <li>Canjeá</li>
          <li>Disfrutá</li>
        </ul>
      </div>
      <div className="tpl-minimal-qr">
        <span className="tpl-minimal-scan">Escaneá. Sumate. Listo.</span>
        <QrBlock svg={qrSvg} />
        <span className="tpl-minimal-proof">Gratis · sin descargar nada</span>
      </div>
    </div>
  );
}
