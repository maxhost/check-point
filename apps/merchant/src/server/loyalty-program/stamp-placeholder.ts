/**
 * Spec 0069 §D5 — el sello PLACEHOLDER, generado en servidor.
 *
 * El wizard no pide una imagen de sello, asi que un programa recien creado no tiene
 * ninguna. En vez de un hueco, la ruta publica sirve un cuadrado transparente con **la
 * primera letra del nombre del negocio** en `#1A1A1A` — negro NO puro, decision del
 * owner del 2026-09-17: el recuadro del sello siempre es blanco, asi que la letra tiene
 * que leerse ahi.
 *
 * **No pasa por `assets/image.ts`**, que RECHAZA SVG en la subida (y con razon: ahi los
 * bytes vienen del navegador). Aca el SVG lo escribe el servidor con una sola variable
 * escapada, y se rasteriza con `sharp`, que ya es dependencia (0.35.3).
 */
const PLACEHOLDER_COLOR = "#1A1A1A";
const PLACEHOLDER_EDGE = 512;
/** Nombre sin ninguna letra latina (p. ej. 東京) — no hay inicial que mostrar. */
const FALLBACK_GLYPH = "•";

const LATIN_LETTER = /\p{Script=Latin}/u;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * La inicial del negocio: el PRIMER grafema del nombre normalizado que contenga una
 * letra latina, en mayuscula. Se segmenta por grafemas y no por `charAt(0)` para que
 * una letra compuesta (`"Ángel"` escrito como `A` + combinante) no se parta al medio y
 * quede un acento suelto. Un nombre sin letra latina cae a `•`.
 */
export function stampInitial(businessName: string): string {
  const normalized = (businessName ?? "").normalize("NFC");
  const segmenter = new Intl.Segmenter("es", { granularity: "grapheme" });
  for (const { segment } of segmenter.segment(normalized)) {
    if (LATIN_LETTER.test(segment)) return segment.toLocaleUpperCase("es");
  }
  return FALLBACK_GLYPH;
}

/**
 * El SVG del placeholder: cuadrado, **fondo transparente** (no hay `<rect>` de fondo a
 * proposito) y la inicial centrada. `dy="0.35em"` centra verticalmente sin depender de
 * `dominant-baseline`, cuyo soporte en el rasterizador de `sharp` no es uniforme.
 */
export function stampPlaceholderSvg(businessName: string): string {
  const glyph = escapeXml(stampInitial(businessName));
  const half = PLACEHOLDER_EDGE / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PLACEHOLDER_EDGE}" height="${PLACEHOLDER_EDGE}" viewBox="0 0 ${PLACEHOLDER_EDGE} ${PLACEHOLDER_EDGE}">`,
    `<text x="${half}" y="${half}" dy="0.35em" text-anchor="middle"`,
    ` font-family="Helvetica, Arial, DejaVu Sans, sans-serif" font-size="${Math.round(PLACEHOLDER_EDGE * 0.62)}"`,
    ` font-weight="700" fill="${PLACEHOLDER_COLOR}">${glyph}</text>`,
    `</svg>`,
  ].join("");
}

/** El placeholder como PNG con alfa, listo para servirse desde la ruta publica. */
export async function stampPlaceholderPng(
  businessName: string,
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(stampPlaceholderSvg(businessName)))
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export { PLACEHOLDER_COLOR, PLACEHOLDER_EDGE, FALLBACK_GLYPH };
