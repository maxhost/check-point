import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProviderButtons } from "./provider-buttons";

/**
 * Spec 0120 — cada boton lleva la marca de SU proveedor (Google tema claro, Apple negro) y
 * ninguno el color del comercio; el orden por sistema de la 0119 se conserva.
 */

function buttons(isIos: boolean) {
  const html = renderToStaticMarkup(
    h(ProviderButtons, { programId: "p-1", loc: "l-1", isIos }),
  );
  const anchors = html.match(/<a [^>]*data-provider="[a-z]+"[^>]*>.*?<\/a>/g);
  return { html, anchors: anchors ?? [] };
}

describe("ProviderButtons — marca de Google y Apple", () => {
  it("Google: fondo blanco, borde #747775, texto #1F1F1F y la G de cuatro colores", () => {
    const google = buttons(false).anchors[0];
    expect(google).toContain('data-provider="google"');
    expect(google).toContain("background:#FFFFFF");
    expect(google).toContain("border:1px solid #747775");
    expect(google).toContain("color:#1F1F1F");
    for (const color of ["#4285F4", "#34A853", "#FBBC05", "#EA4335"])
      expect(google).toContain(`fill="${color}"`);
    expect(google).toContain("Continuar con Google");
  });

  it("Apple: fondo negro, texto blanco y el logo blanco", () => {
    const apple = buttons(true).anchors[0];
    expect(apple).toContain('data-provider="apple"');
    expect(apple).toContain("background:#000000");
    expect(apple).toContain("color:#FFFFFF");
    expect(apple).toContain('fill="#FFFFFF"');
    expect(apple).toContain("Continuar con Apple");
  });

  it("mismo alto en los dos, y el orden por sistema se conserva", () => {
    const ios = buttons(true).anchors;
    const android = buttons(false).anchors;
    expect(ios.map((a) => a.match(/data-provider="(\w+)"/)?.[1])).toEqual([
      "apple",
      "google",
    ]);
    expect(android.map((a) => a.match(/data-provider="(\w+)"/)?.[1])).toEqual([
      "google",
      "apple",
    ]);
    for (const a of ios) expect(a).toContain("height:48px");
  });

  it("los enlaces llevan el programa y el local al start", () => {
    const { html } = buttons(true);
    expect(html).toContain(
      'href="/api/public/auth/apple/start?programId=p-1&amp;loc=l-1"',
    );
  });
});
