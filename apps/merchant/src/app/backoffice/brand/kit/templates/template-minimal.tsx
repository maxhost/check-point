import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Minimalista genérica: mostly white, a small logo up top, a large centered QR, and just
// enough copy. The safe choice for any rubro; lets the QR and brand color do the talking.
export function TemplateMinimal(props: PosterProps) {
  const { businessName, logoPath, colors, qrSvg, headline, subheadline } = props;
  return (
    <div className="poster tpl-minimal" style={posterVars(colors)}>
      <header className="tpl-minimal-head">
        <PosterLogo logoPath={logoPath} businessName={businessName} />
        <span className="tpl-minimal-name">{businessName}</span>
      </header>
      <h1 className="tpl-minimal-headline">{headline}</h1>
      <div className="tpl-minimal-qr">
        <QrBlock svg={qrSvg} />
      </div>
      <p className="tpl-minimal-sub">{subheadline}</p>
    </div>
  );
}
