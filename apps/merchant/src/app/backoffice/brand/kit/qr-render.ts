// Brand kit (spec 0041): pure, DOM-free string transforms over the server-rendered QR
// SVG. `renderQrSvg` (lib `qrcode`) emits `<path fill="#ffffff" .../>` for the quiet
// zone and `<path stroke="#000000" .../>` for the dark modules. These helpers recolor
// those modules and compose a centered logo overlay WITHOUT touching the module matrix
// (the path `d`), so the code keeps scanning. Applied client-side over the pre-rendered
// EC-H SVG — no server round-trip. Testable without a browser.

const HEX = /^#[0-9a-fA-F]{6}$/;

/** QR style options offered in the preview. */
export type QrStyle = "black" | "tinted" | "logo";

/** Recolors the dark modules to `color` (a `#RRGGBB` hex). Invalid color → unchanged.
 * Only the `stroke` attribute is rewritten; the module geometry stays byte-identical. */
export function tintQrModules(svg: string, color: string): string {
  if (!HEX.test(color)) return svg;
  return svg.replace(/stroke="#000000"/g, `stroke="${color}"`);
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Composes a centered logo over the QR: a white rounded backing plate plus an `<image>`.
 * `fraction` is the logo side as a share of the QR side, clamped to [0.1, 0.22] — a
 * conservative window that EC-H (≈30% recovery) tolerates with scan margin. No viewBox
 * (unexpected input) → unchanged. The module matrix is never modified.
 */
export function overlayLogo(
  svg: string,
  logoHref: string,
  fraction = 0.2,
): string {
  const match = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
  if (!match || !logoHref) return svg;
  const width = Number.parseFloat(match[1]);
  const height = Number.parseFloat(match[2]);
  const frac = Math.max(0.1, Math.min(0.22, fraction));
  const size = width * frac;
  const x = (width - size) / 2;
  const y = (height - size) / 2;
  const pad = size * 0.14;
  const plate = `<rect x="${x - pad}" y="${y - pad}" width="${size + pad * 2}" height="${size + pad * 2}" rx="${size * 0.16}" fill="#ffffff"/>`;
  const image = `<image href="${xmlEscape(logoHref)}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
  return svg.replace("</svg>", `${plate}${image}</svg>`);
}

/**
 * Applies a QR style over the base (black-module, EC-H) SVG:
 * - `black`  → unchanged;
 * - `tinted` → modules recolored with the brand primary color;
 * - `logo`   → black modules + centered business logo (needs a `logoHref`).
 */
export function styleQr(
  baseSvg: string,
  style: QrStyle,
  primaryColor: string,
  logoHref: string | null,
): string {
  if (style === "tinted") return tintQrModules(baseSvg, primaryColor);
  if (style === "logo" && logoHref) return overlayLogo(baseSvg, logoHref);
  return baseSvg;
}
