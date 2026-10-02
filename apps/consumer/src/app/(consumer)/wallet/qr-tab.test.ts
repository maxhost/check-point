import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QrTab } from "./qr-tab";

const sampleQr =
  '<svg viewBox="0 0 3 3" data-test-qr="sample"><path d="M0 0h1v1H0z"/></svg>';

function render(isIos: boolean) {
  return renderToStaticMarkup(
    createElement(QrTab, {
      qrSvg: sampleQr,
      isIos,
      vapidPublicKey: null,
      onSubscribed: () => {},
    }),
  );
}

describe("Pase PWA Trama viva", () => {
  it("conserva el SVG del QR y separa el arte del área escaneable", () => {
    const html = render(true);
    expect(html).toContain(sampleQr);
    expect(html).toContain("wallet-logo-trama-v1.png");
    expect(html.indexOf('class="cp-pass-art"')).toBeLessThan(
      html.indexOf('class="consumer-qr"'),
    );
    expect(html).toContain("Mostrá este código en caja");
  });

  it("en iOS muestra solo Apple Wallet desde el primer render", () => {
    const html = render(true);
    expect(html).toContain('data-provider="apple"');
    expect(html).toContain('href="/api/public/wallet/apple.pkpass"');
    expect(html).toContain("Añadir a Apple Wallet");
    expect(html).toContain('fill="#fff"');
    expect(html).not.toContain('data-provider="google"');
  });

  it("fuera de iOS muestra solo Google Wallet desde el primer render", () => {
    const html = render(false);
    expect(html).toContain('data-provider="google"');
    expect(html).toContain('href="/api/public/wallet/google"');
    expect(html).toContain("Añadir a Google Wallet");
    expect(html).toContain('fill="#4285F4"');
    expect(html).not.toContain('data-provider="apple"');
  });
});
