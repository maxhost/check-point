// Pure contrast helper for branded surfaces (spec 0039). No dependency: the repo has no
// React Aria / a11y library, so the readable text color over a brand background is resolved
// here from the WCAG relative-luminance formula.

/** Relative luminance (WCAG 2.x) of an sRGB channel value in [0,1]. */
function channelToLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of an sRGB color given its 8-bit r/g/b components. */
function relativeLuminance(r: number, g: number, b: number): number {
  const R = channelToLinear(r / 255);
  const G = channelToLinear(g / 255);
  const B = channelToLinear(b / 255);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG contrast ratio between two relative luminances (order-independent). */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE = "#ffffff";
const BLACK = "#111111";
const WHITE_LUMINANCE = 1; // luminance of pure white (#ffffff)
const BLACK_LUMINANCE = relativeLuminance(0x11, 0x11, 0x11);

/**
 * Picks the readable text color (`'#111111'` or `'#ffffff'`) over a `#RRGGBB` background,
 * by WCAG contrast ratio: compares the ratio against white and against near-black and
 * returns whichever yields the higher contrast.
 *
 * Invalid input (not a `#RRGGBB` hex) → default `'#ffffff'`: brand backgrounds tend to be
 * saturated/dark, so white is the safer fallback than black on an unknown color.
 */
export function readableTextColor(
  hexBackground: string,
): "#111111" | "#ffffff" {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hexBackground.trim());
  if (!match) return WHITE;
  const hex = match[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const bg = relativeLuminance(r, g, b);
  const contrastWithWhite = contrastRatio(bg, WHITE_LUMINANCE);
  const contrastWithBlack = contrastRatio(bg, BLACK_LUMINANCE);
  return contrastWithBlack > contrastWithWhite ? BLACK : WHITE;
}
