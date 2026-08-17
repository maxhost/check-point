import { PosterLogo, QrBlock } from "./parts";
import { posterVars, type PosterProps } from "./types";

// Bar & gastronomía: benefit first, with a deliberately obvious scan zone for the counter.
export function TemplateBar(props: PosterProps) {
  const { businessName, logoPath, colors, qrSvg, headline, subheadline } =
    props;
  return (
    <div className="poster tpl-bar" style={posterVars(colors)}>
      <header className="tpl-bar-head">
        <PosterLogo logoPath={logoPath} businessName={businessName} />
        <div>
          <span className="tpl-bar-kicker">Club de beneficios</span>
          <span className="tpl-bar-name">{businessName}</span>
        </div>
      </header>
      <div className="tpl-bar-body">
        <h1 className="tpl-bar-headline">{headline}</h1>
        <p className="tpl-bar-sub">{subheadline}</p>
        <span className="tpl-bar-proof">Gratis · desde tu celular</span>
      </div>
      <div className="tpl-bar-qrcard">
        <span className="tpl-bar-scan">Escaneá y empezá hoy</span>
        <QrBlock svg={qrSvg} />
        <span className="tpl-bar-cta">Abrí la cámara y apuntá al código</span>
      </div>
    </div>
  );
}
