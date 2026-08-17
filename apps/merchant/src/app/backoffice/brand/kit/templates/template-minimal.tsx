import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Minimalista genérica: editorial and extremely legible, with one oversized action.
export function TemplateMinimal(props: PosterProps) {
  const { businessName, logoPath, colors, qrSvg, label, headline, subheadline } =
    props;
  return (
    <div className="poster tpl-minimal" style={posterVars(colors)}>
      <header className="tpl-minimal-head">
        <PosterLogo logoPath={logoPath} businessName={businessName} />
        <div>
          <span className="tpl-minimal-kicker">{label}</span>
          <span className="tpl-minimal-name">{businessName}</span>
        </div>
      </header>
      <h1 className="tpl-minimal-headline">{headline}</h1>
      <div className="tpl-minimal-qr">
        <span className="tpl-minimal-scan">Escaneá para sumarte</span>
        <QrBlock svg={qrSvg} />
      </div>
      <p className="tpl-minimal-sub">{subheadline}</p>
      <span className="tpl-minimal-proof">Gratis · desde tu celular</span>
    </div>
  );
}
