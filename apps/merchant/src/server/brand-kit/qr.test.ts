import { describe, expect, it } from "vitest";
import { renderEnrollQr } from "./qr";
import {
  overlayLogo,
  tintQrModules,
} from "../../app/backoffice/brand/kit/qr-render";

// Anchors the qr-render helpers against the REAL SVG that `renderEnrollQr` (lib `qrcode`,
// EC level H) emits — not just a hand-made fixture. If the lib ever changes its output
// shape (e.g. `fill` instead of `stroke` for dark modules, or drops the viewBox), these
// break loudly instead of the client transforms silently no-op'ing in production.
describe("qr-render over real renderEnrollQr output", () => {
  it("tints the dark modules of a real EC-H QR", async () => {
    const svg = await renderEnrollQr(
      "https://app.example.com/enroll/abc?loc=xyz",
    );
    // The real output must be tint-able: it carries stroked black modules.
    expect(svg).toContain('stroke="#000000"');
    const tinted = tintQrModules(svg, "#176548");
    expect(tinted).toContain('stroke="#176548"');
    expect(tinted).not.toContain('stroke="#000000"');
  });

  it("overlays a centered logo on a real EC-H QR (viewBox present)", async () => {
    const svg = await renderEnrollQr("https://app.example.com/enroll/abc");
    expect(svg).toMatch(/viewBox="0 0 \d+(?:\.\d+)? \d+(?:\.\d+)?"/);
    const withLogo = overlayLogo(svg, "/api/public/brands/biz-1/logo?v=3");
    expect(withLogo).toContain("<image ");
    expect(withLogo).toContain("<rect ");
    expect(withLogo.match(/<\/svg>/g)).toHaveLength(1);
    // Real qrcode output ends with a trailing newline; the overlay stays before </svg>.
    expect(withLogo.trimEnd().endsWith("</svg>")).toBe(true);
    expect(withLogo.indexOf("<image ")).toBeLessThan(
      withLogo.indexOf("</svg>"),
    );
  });
});
