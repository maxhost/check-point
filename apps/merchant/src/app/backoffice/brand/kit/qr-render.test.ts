import { describe, expect, it } from "vitest";
import { overlayLogo, styleQr, tintQrModules } from "./qr-render";

// A faithful miniature of the `qrcode` SVG output: white quiet-zone rect + a stroked
// path carrying the module matrix.
const MODULE_PATH = "M1 1.5h7m2 0h1m1 0h4M1 2.5h1m5 0h1";
const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 39 39" shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h39v39H0z"/><path stroke="#000000" d="${MODULE_PATH}"/></svg>`;

describe("tintQrModules", () => {
  it("recolors the dark modules to the brand color", () => {
    const out = tintQrModules(SAMPLE, "#176548");
    expect(out).toContain('stroke="#176548"');
    expect(out).not.toContain('stroke="#000000"');
  });

  it("leaves the module matrix (path d) untouched", () => {
    const out = tintQrModules(SAMPLE, "#176548");
    expect(out).toContain(`d="${MODULE_PATH}"`);
  });

  it("ignores an invalid color (returns the SVG unchanged)", () => {
    expect(tintQrModules(SAMPLE, "red")).toBe(SAMPLE);
    expect(tintQrModules(SAMPLE, "#12")).toBe(SAMPLE);
  });
});

describe("overlayLogo", () => {
  it("inserts a centered image and a white backing plate before </svg>", () => {
    const out = overlayLogo(SAMPLE, "/api/public/brands/biz-1/logo?v=3");
    expect(out).toContain("<image ");
    expect(out).toContain('href="/api/public/brands/biz-1/logo?v=3"');
    expect(out).toContain("<rect ");
    // Still a single, well-closed SVG.
    expect(out.match(/<\/svg>/g)).toHaveLength(1);
    expect(out.endsWith("</svg>")).toBe(true);
  });

  it("does not alter the module matrix", () => {
    const out = overlayLogo(SAMPLE, "/logo.png");
    expect(out).toContain(`d="${MODULE_PATH}"`);
    expect(out).toContain('stroke="#000000"');
  });

  it("escapes special characters in the href", () => {
    const out = overlayLogo(SAMPLE, "/logo?a=1&b=2");
    expect(out).toContain("a=1&amp;b=2");
  });

  it("returns the SVG unchanged when there is no viewBox or no href", () => {
    expect(overlayLogo("<svg></svg>", "/logo.png")).toBe("<svg></svg>");
    expect(overlayLogo(SAMPLE, "")).toBe(SAMPLE);
  });
});

describe("styleQr", () => {
  it("black → unchanged", () => {
    expect(styleQr(SAMPLE, "black", "#176548", "/logo.png")).toBe(SAMPLE);
  });

  it("tinted → recolored modules", () => {
    expect(styleQr(SAMPLE, "tinted", "#176548", null)).toContain(
      'stroke="#176548"',
    );
  });

  it("logo → overlays when a logoHref is present, else falls back to black", () => {
    expect(styleQr(SAMPLE, "logo", "#176548", "/logo.png")).toContain(
      "<image ",
    );
    expect(styleQr(SAMPLE, "logo", "#176548", null)).toBe(SAMPLE);
  });
});
