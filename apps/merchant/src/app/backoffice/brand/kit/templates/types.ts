// Brand kit (spec 0041): shared shape for the 5 poster templates. Each template is a
// pure-props layout that consumes the brand colors (as CSS vars), the business logo and
// name, the already-styled QR SVG (black/tinted/logo — see qr-render.ts), and the
// editable headline/subheadline. Templates never fetch nor mutate the saved marca.

export type PosterColors = {
  primary: string;
  complementary: string;
  accent: string;
};

export type PosterProps = {
  businessName: string;
  logoPath: string | null;
  colors: PosterColors;
  /** QR SVG string, already run through `styleQr` (black | tinted | logo). Inlined. */
  qrSvg: string;
  /** Small line next to the logo. It is owner-editable, never template copy. */
  label: string;
  headline: string;
  subheadline: string;
};

/** The 5 curated templates, differentiated by rubro. */
export type TemplateId = "bar" | "lodging" | "retail" | "services" | "minimal";

export const TEMPLATES: {
  id: TemplateId;
  label: string;
  rubro: string;
}[] = [
  { id: "bar", label: "Bar & Gastronomía", rubro: "Bares, cafés, restaurantes" },
  { id: "lodging", label: "Alojamiento", rubro: "Hoteles, hostales, cabañas" },
  { id: "retail", label: "Retail", rubro: "Tiendas y comercios" },
  { id: "services", label: "Servicios", rubro: "Estudios, salones, oficios" },
  { id: "minimal", label: "Minimalista", rubro: "Genérica, cualquier rubro" },
];

/** CSS vars the poster layouts read for color. Built from the (possibly overridden) colors. */
export function posterVars(colors: PosterColors): React.CSSProperties {
  return {
    "--poster-primary": colors.primary,
    "--poster-complementary": colors.complementary,
    "--poster-accent": colors.accent,
  } as React.CSSProperties;
}
