import { renderQrSvg } from "../wallet/core";

// Brand kit (spec 0041): the enrollment poster QR. Wraps the shared `renderQrSvg`
// (lib `qrcode`, SVG string, no new dependency) at error-correction level **H** so a
// business logo can be overlaid at the center without breaking the code — the higher
// redundancy tolerates the central occlusion. The consumer pass QR keeps the default
// "M"; this variant is used only by the poster.
export function renderEnrollQr(url: string): Promise<string> {
  return renderQrSvg(url, "H");
}

/** Lado del PNG del QR descargable (spec 0069 §D6). */
export const ENROLL_QR_PNG_EDGE = 1024;

/**
 * El mismo QR EC-H, rasterizado a PNG de 1024×1024 (spec 0069 §D6) para que el
 * comerciante pueda **guardarlo en el telefono**. Se rasteriza con `sharp`, que ya es
 * dependencia (0.35.3) y decodifica SVG: no hace falta ninguna libreria nueva.
 *
 * **NO se le fija `density`, y eso esta MEDIDO al reves de lo que parece.** `sharp`
 * rasteriza el vector **directo al tamaño pedido por el `resize`**, asi que el borde sale
 * duro solo. Fijarle un `density` alto lo obliga a rasterizar primero a ese tamaño
 * intermedio y despues **agrandar**, que es lo que introduce el dentado. Medido sobre el
 * SVG de un enroll real (`viewBox 0 0 47 47`): sin `density` el crudo sale 1024 y el PNG
 * final tiene **0 pixeles intermedios en 24.407 bytes**; con `density: 600` el crudo sale
 * 392×392 y el final tiene **38.273 pixeles intermedios en 42.557 bytes**. Un docblock
 * anterior afirmaba lo contrario; lo cazo el revisor de la 0069.
 *
 * `fit: "contain"` con fondo blanco mantiene la **zona tranquila** que el lector necesita.
 */
export async function renderEnrollQrPng(url: string): Promise<Buffer> {
  const svg = await renderEnrollQr(url);
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(svg))
    .resize({
      width: ENROLL_QR_PNG_EDGE,
      height: ENROLL_QR_PNG_EDGE,
      fit: "contain",
      background: "#FFFFFF",
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
