import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Bar & gastronomía: energetic, full-bleed primary background, bold uppercase headline,
// the QR sitting on a bright card at the foot. Reads well pinned behind a counter.
export function TemplateBar(props: PosterProps) {
  const { businessName, logoPath, colors, qrSvg, headline, subheadline } = props;
  return (
    <div className="poster tpl-bar" style={posterVars(colors)}>
      <header className="tpl-bar-head">
        <PosterLogo logoPath={logoPath} businessName={businessName} />
        <span className="tpl-bar-name">{businessName}</span>
      </header>
      <div className="tpl-bar-body">
        <h1 className="tpl-bar-headline">{headline}</h1>
        <p className="tpl-bar-sub">{subheadline}</p>
      </div>
      <div className="tpl-bar-qrcard">
        <QrBlock svg={qrSvg} />
        <span className="tpl-bar-cta">Escaneá para sumarte</span>
      </div>
    </div>
  );
}
