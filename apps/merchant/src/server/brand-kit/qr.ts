import { renderQrSvg } from "../wallet/core";

// Brand kit (spec 0041): the enrollment poster QR. Wraps the shared `renderQrSvg`
// (lib `qrcode`, SVG string, no new dependency) at error-correction level **H** so a
// business logo can be overlaid at the center without breaking the code — the higher
// redundancy tolerates the central occlusion. The consumer pass QR keeps the default
// "M"; this variant is used only by the poster.
export function renderEnrollQr(url: string): Promise<string> {
  return renderQrSvg(url, "H");
}
