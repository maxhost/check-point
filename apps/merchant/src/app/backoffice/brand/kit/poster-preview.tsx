import { styleQr, type QrStyle } from "./qr-render";
import { TemplateBar } from "./templates/template-bar";
import { TemplateLodging } from "./templates/template-lodging";
import { TemplateMinimal } from "./templates/template-minimal";
import { TemplateRetail } from "./templates/template-retail";
import { TemplateServices } from "./templates/template-services";
import type { PosterColors, TemplateId } from "./templates/types";

// Poster preview (spec 0041): takes the chosen template, the (possibly overridden) brand
// colors + copy, the base EC-H QR SVG for the active scope, and the QR style, then styles
// the QR client-side (recolor / logo overlay via qr-render) and dispatches to one of the
// 5 layouts. No server round-trip — the base SVGs are pre-rendered server-side.

export type PosterPreviewProps = {
  templateId: TemplateId;
  businessName: string;
  logoPath: string | null;
  colors: PosterColors;
  /** Base black-module, EC-H QR SVG for the active scope (global or a local). */
  qrSvg: string;
  qrStyle: QrStyle;
  label: string;
  headline: string;
  subheadline: string;
};

const LAYOUTS: Record<TemplateId, (p: TemplateProps) => React.JSX.Element> = {
  bar: TemplateBar,
  lodging: TemplateLodging,
  retail: TemplateRetail,
  services: TemplateServices,
  minimal: TemplateMinimal,
};

type TemplateProps = {
  businessName: string;
  logoPath: string | null;
  colors: PosterColors;
  qrSvg: string;
  label: string;
  headline: string;
  subheadline: string;
};

export function PosterPreview(props: PosterPreviewProps) {
  const { templateId, colors, qrSvg, qrStyle, logoPath, ...rest } = props;
  // Style the QR for this render: tinted uses the primary color; logo overlays the
  // public logo path (only when present — else falls back to black modules).
  const styledQr = styleQr(qrSvg, qrStyle, colors.primary, logoPath);
  const Layout = LAYOUTS[templateId];
  return <Layout colors={colors} qrSvg={styledQr} logoPath={logoPath} {...rest} />;
}
